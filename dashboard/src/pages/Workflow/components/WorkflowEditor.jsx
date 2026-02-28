import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    ReactFlow,
    addEdge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    reconnectEdge,
    useOnSelectionChange,
    ReactFlowProvider,
    useReactFlow,
} from '@xyflow/react';
import { io } from 'socket.io-client';
import '@xyflow/react/dist/style.css';
import * as Icons from 'lucide-react';
import {
    Play,
    Save,
    Settings2,
    Trash2,
    Binary,
    ArrowLeft,
    Edit3,
    Terminal,
    ChevronUp,
    ChevronDown,
    X,
    Loader2,
    ZapOff,
    Link2Off,
    MousePointer2,
    BoxSelect,
    Download,
    Upload
} from 'lucide-react';
import { showToast } from '../../../components/Toast';
import { AccountsService, ProxiesService, WorkflowsService } from '../../../services/apiService';
import { STATUS_MAP } from '../../../lib/ui';
import Select from '../../../components/Select';
import Modal from '../../../components/Modal';
import TaskNode from './TaskNode';
import SourceNode from './SourceNode';
import LibrarySidebar from './LibrarySidebar';
import { NODE_TEMPLATES } from '../constants';

const nodeTypes = {
    taskNode: TaskNode,
    sourceNode: SourceNode
};

export default function WorkflowEditor(props) {
    return (
        <ReactFlowProvider>
            <WorkflowEditorInternal {...props} />
        </ReactFlowProvider>
    );
}

function WorkflowEditorInternal({ workflow, onBack, onUpdate }) {
    const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes || []);

    // Danh sách taskNode chỉ có 1 đầu ra (handle 'default') — phải khớp với TaskNode.jsx
    const SINGLE_OUTPUT_LABELS = [
        'Chờ đợi', 'Khai báo biến', 'Cập nhật trạng thái', 'Cập nhật mật khẩu',
        'Xoá profile', 'Xoá profile local', 'Đóng trình duyệt', 'Xoá tất cả Mail',
    ];

    /**
     * normalizeEdges: chuẩn hoá sourceHandle cho edges
     * - sourceNode (START): handle id = 'true'  → giữ 'true'
     * - taskNode single-output: handle id = 'default' → giữ 'default'
     * - taskNode branch (điều kiện, loop, click...): 'true'/'false' → giữ nguyên
     * - null/undefined/sai → tự suy ra từ node type
     * - Loại bỏ duplicate edges theo id
     */
    const normalizeEdges = (rawEdges = [], currentNodes = []) => {
        const seen = new Set();
        return rawEdges
            .map(e => {
                const sourceNode = currentNodes.find(n => n.id === e.source);
                let sourceHandle = e.sourceHandle;

                if (sourceNode?.type === 'sourceNode') {
                    // START node luôn dùng handle 'true'
                    sourceHandle = 'true';
                } else if (sourceNode?.type === 'taskNode') {
                    const isSingle = SINGLE_OUTPUT_LABELS.includes(sourceNode.data?.label);
                    if (isSingle) {
                        // Single-output: phải dùng 'default'
                        sourceHandle = 'default';
                    } else if (!sourceHandle || sourceHandle === 'default') {
                        // Branch node không có handle → mặc định 'true'
                        sourceHandle = 'true';
                    }
                    // Nếu đã là 'true' hoặc 'false' → giữ nguyên
                }
                return { ...e, sourceHandle };
            })
            .filter(e => {
                if (seen.has(e.id)) return false;
                seen.add(e.id);
                return true;
            });
    };

    const [edges, setEdges, onEdgesChange] = useEdgesState(
        normalizeEdges(workflow.edges, workflow.nodes || [])
    );
    const [selectedNode, setSelectedNode] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState({ name: workflow.name, description: workflow.description || '' });
    const [selectedEdge, setSelectedEdge] = useState(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [showHints, setShowHints] = useState(true);

    // Chup toan bo flow thanh anh PNG
    const handleCaptureFlow = useCallback(async () => {
        try {
            const { toPng } = await import('html-to-image');
            const el = document.querySelector('.react-flow__renderer');
            if (!el) return;
            const dataUrl = await toPng(el, { backgroundColor: '#0f1117', quality: 1, pixelRatio: 2 });
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `flow_${Date.now()}.png`;
            a.click();
        } catch (err) {
            console.error('Capture flow error:', err);
        }
    }, []);

    // Execution States
    const [isExecuting, setIsExecuting] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState([]);
    const [logHeight, setLogHeight] = useState(256);              // px, default 256 = h-64
    const logDragRef = useRef(null);                              // { startY, startH }
    const [currentExecutionId, setCurrentExecutionId] = useState(null);
    const [activeNodeId, setActiveNodeId] = useState(null);       // Node dang chay
    const [autoFollow, setAutoFollow] = useState(true);            // Tu dong cuon toi node dang chay
    const [browserPort, setBrowserPort] = useState(null);         // Port CDP khi mo browser
    const [editingPort, setEditingPort] = useState(false);        // Đang sửa port
    const [profileId, setProfileId] = useState(null);             // Profile ID đang chạy
    const [editingProfileId, setEditingProfileId] = useState(false); // Đang sửa Profile ID

    // Hook layout cua ReactFlow
    const { setCenter, getNode } = useReactFlow();

    // Auto-follow: cuon toi node dang chay
    useEffect(() => {
        if (!autoFollow || !activeNodeId) return;
        const node = getNode(activeNodeId);
        if (!node) return;
        const x = node.position.x + (node.measured?.width || 200) / 2;
        const y = node.position.y + (node.measured?.height || 80) / 2;
        setCenter(x, y, { zoom: 1, duration: 400 });
    }, [activeNodeId, autoFollow, getNode, setCenter]);

    // Run Modal State
    const [showRunModal, setShowRunModal] = useState(false);
    const [runConfig, setRunConfig] = useState({
        account_group_id: '',
        proxy_group_id: '',
        target_statuses: ['active'],
        new_password: localStorage.getItem('task_new_password') || '',
        limit: '',
    });

    const [accountGroups, setAccountGroups] = useState([]);
    const [proxyGroups, setProxyGroups] = useState([]);

    const reactFlowWrapper = useRef(null);
    const logContainerRef = useRef(null);
    const importFileRef = useRef(null);
    const clipboardRef = useRef(null);  // { nodes, edges } khi Ctrl+C

    // Ctrl+C / Ctrl+V: copy-paste nhom node
    useEffect(() => {
        const onKeyDown = (e) => {
            // Bo qua khi dang go vao input/textarea
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

            const isCtrl = e.ctrlKey || e.metaKey;
            if (!isCtrl) return;

            if (e.key === 'c' || e.key === 'C') {
                const sel = selectedNodes.filter(n => n.type !== 'sourceNode');
                if (sel.length === 0) return;
                const selIds = new Set(sel.map(n => n.id));
                // Giu lai edge noi 2 node trong phan copy
                const selEdges = edges.filter(ed => selIds.has(ed.source) && selIds.has(ed.target));
                clipboardRef.current = { nodes: sel, edges: selEdges };
                e.preventDefault();
            }

            if (e.key === 'v' || e.key === 'V') {
                if (!clipboardRef.current) return;
                e.preventDefault();
                const { nodes: copiedNodes, edges: copiedEdges } = clipboardRef.current;
                const OFFSET = 40;
                const idMap = {};  // old id → new id

                const newNodes = copiedNodes.map(n => {
                    const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                    idMap[n.id] = newId;
                    return {
                        ...n,
                        id: newId,
                        selected: false,
                        position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
                        data: { ...n.data, _active: false },
                    };
                });

                const newEdges = copiedEdges.map(ed => ({
                    ...ed,
                    id: `e_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    source: idMap[ed.source] || ed.source,
                    target: idMap[ed.target] || ed.target,
                }));

                setNodes(prev => [...prev, ...newNodes]);
                setEdges(prev => [...prev, ...newEdges]);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedNodes, edges]);

    useEffect(() => {
        const load = async () => {
            try {
                const [accRes, proxyRes] = await Promise.all([
                    AccountsService.getGroups(),
                    ProxiesService.getGroups()
                ]);
                setAccountGroups(accRes.data || []);
                setProxyGroups(proxyRes.data || []);
            } catch (e) { console.error(e); }
        };
        load();
    }, []);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // Cap nhat data._active, _onResume, _browserPort cho all nodes
    useEffect(() => {
        setNodes(nds => nds.map(n => ({
            ...n,
            data: {
                ...n.data,
                _active: n.id === activeNodeId,
                _browserPort: browserPort,
                _onResume: handleResumeFrom,
            }
        })));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeNodeId, browserPort, nodes.length, setNodes]);

    const addLog = (message, type = 'info') => {
        setLogs(prev => [...prev, {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message,
            type,
            time: new Date().toLocaleTimeString()
        }]);
    };

    // Chay tiep tu 1 node cu the (co san browser port)
    const handleResumeFrom = useCallback(async (nodeId) => {
        if (!runConfig.account_group_id) {
            showToast('Chua chon Nhom tai khoan. Bam Chay thu truoc.', 'warning');
            return;
        }
        try {
            setIsExecuting(true);
            setShowLogs(true);
            setLogs([]);
            addLog(`▶️ Tiep tuc tu khoi: ${nodeId}`, 'info');
            if (browserPort) addLog(`🔌 Ket noi browser: ws://127.0.0.1:${browserPort}`, 'info');

            await handleSave(true);

            const res = await WorkflowsService.run(workflow._id, {
                ...runConfig,
                start_node_id: nodeId,
                ws_endpoint: browserPort ? `ws://127.0.0.1:${browserPort}` : undefined,
                profile_id: profileId || undefined,
            });
            const executionId = res.data?.executionId || res.executionId;
            if (!executionId) throw new Error('Khong nhan duoc ID thuc thi');
            setCurrentExecutionId(executionId);
            addLog(`✅ Server tiep nhan. ID: ${executionId}`, 'success');

            const socket = io('http://localhost:3000');
            socket.on('connect', () => socket.emit('join-execution', executionId));
            socket.on('workflow-log', (newLog) => {
                setLogs(prev => [...prev, {
                    ...newLog,
                    id: newLog.id || `${Date.now()}-${Math.random()}`,
                    time: newLog.timestamp ? new Date(newLog.timestamp).toLocaleTimeString('vi-VN') : new Date().toLocaleTimeString('vi-VN'),
                }]);
                const portMatch = newLog?.message?.match(/CDP Port: (\d+)/);
                if (portMatch) setBrowserPort(portMatch[1]);
            });
            socket.on('workflow-node-active', ({ nodeId }) => setActiveNodeId(nodeId));
            socket.on('workflow-status', (data) => {
                if (['completed', 'failed', 'stopped'].includes(data.status)) {
                    setIsExecuting(false); setCurrentExecutionId(null); setActiveNodeId(null);
                    socket.disconnect();
                }
            });
            socket.on('disconnect', () => setIsExecuting(false));
        } catch (e) {
            addLog(`❌ Loi: ${e.message}`, 'error');
            setIsExecuting(false);
            setCurrentExecutionId(null);
        }
    }, [browserPort, runConfig, workflow._id]);

    const handleSave = async (silent = false) => {
        try {
            await WorkflowsService.update(workflow._id, {
                nodes,
                edges: normalizeEdges(edges, nodes),
            });
            onUpdate();
            if (!silent) showToast('Đã lưu quy trình thành công');
        } catch (e) {
            console.error('[handleSave]', e);
            if (!silent) showToast(e.message || 'Lỗi khi lưu quy trình', 'error');
        }
    };

    const handleRun = () => {
        const sourceNode = nodes.find(n => n.type === 'sourceNode');
        if (!sourceNode) return showToast('Vui lòng thêm khối START để khởi chạy', 'warning');
        setShowRunModal(true);
    };

    const handleConfirmRun = async () => {
        if (!runConfig.account_group_id) return showToast('Vui lòng chọn Nhóm tài khoản', 'warning');
        setShowRunModal(false);
        try {
            setIsExecuting(true);
            setShowLogs(true);
            setLogs([]);
            addLog(`🚀 Bắt đầu khởi chạy quy trình: ${workflow.name}`, 'info');

            await handleSave(true);
            addLog(`💾 Đã lưu phiên bản mới nhất...`, 'info');

            const res = await WorkflowsService.run(workflow._id, runConfig);
            const executionId = res.data?.executionId || res.executionId;

            if (!executionId) throw new Error('Không nhận được ID thực thi từ server');
            setCurrentExecutionId(executionId);

            addLog(`✅ Server đã tiếp nhận yêu cầu. ID: ${executionId}`, 'success');
            if (runConfig.test_mode) addLog(`ℹ️ Chế độ Chạy thử: Chỉ xử lý 1 tài khoản đầu tiên.`, 'info');

            // Setup WebSocket connection
            const socket = io('http://localhost:3000'); // TODO: Use env variable for base URL

            socket.on('connect', () => {
                socket.emit('join-execution', executionId);
                addLog(`📡 Đã kết nối luồng cập nhật trực tiếp.`, 'info');
            });

            socket.on('workflow-log', (newLog) => {
                setLogs(prev => [...prev, {
                    ...newLog,
                    id: newLog.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    time: newLog.timestamp
                        ? new Date(newLog.timestamp).toLocaleTimeString('vi-VN')
                        : new Date().toLocaleTimeString('vi-VN'),
                }]);
            });

            socket.on('workflow-status', (data) => {
                if (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped') {
                    setIsExecuting(false);
                    setCurrentExecutionId(null);
                    setActiveNodeId(null);   // Reset highlight
                    socket.disconnect();
                }
            });

            // Highlight khối đang chạy
            socket.on('workflow-node-active', ({ nodeId }) => {
                setActiveNodeId(nodeId);
            });

            // Phat hien port va profileId tu log
            socket.on('workflow-log', (newLog) => {
                const portMatch = newLog?.message?.match(/CDP Port: (\d+)/);
                if (portMatch) setBrowserPort(portMatch[1]);
                const profileMatch = newLog?.message?.match(/Profile ID: ([a-f0-9\-]{30,})/);
                if (profileMatch) setProfileId(profileMatch[1]);
            });

            socket.on('disconnect', () => {
                setIsExecuting(false);
            });

        } catch (e) {
            addLog(`❌ Lỗi: ${e.message}`, 'error');
            setIsExecuting(false);
            setCurrentExecutionId(null);
        }
    };

    const handleStop = async () => {
        if (!currentExecutionId) return;
        try {
            await WorkflowsService.stop(currentExecutionId);
            showToast('Đang gửi yêu cầu dừng...');
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const handleUpdateDetails = async () => {
        if (!editData.name.trim()) return showToast('Tên quy trình không được để trống', 'warning');
        try {
            await WorkflowsService.update(workflow._id, editData);
            showToast('✅ Cập nhật thông tin thành công');
            setShowEditModal(false);
            onUpdate();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 } }, eds)),
        [setEdges]
    );

    const onNodeClick = (_, node) => {
        setSelectedNode(node);
        setSelectedEdge(null);
    };

    const onEdgeClick = (_, edge) => {
        setSelectedEdge(edge);
        setSelectedNode(null);
    };

    const onPaneClick = () => {
        setSelectedNode(null);
        setSelectedEdge(null);
        setSelectedNodes([]);
    };

    useOnSelectionChange({
        onChange: ({ nodes, edges }) => {
            setSelectedNodes(nodes);
            if (nodes.length === 1) setSelectedNode(nodes[0]);
            else setSelectedNode(null);

            if (edges.length === 1 && nodes.length === 0) setSelectedEdge(edges[0]);
            else setSelectedEdge(null);
        },
    });

    const addNode = (template) => {
        const id = `${template.type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newNode = {
            id,
            type: template.type,
            position: { x: 400, y: 150 },
            data: JSON.parse(JSON.stringify(template)),
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const onDragStart = (event, nodeType, template) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.setData('application/template', JSON.stringify(template));
        event.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const templateStr = event.dataTransfer.getData('application/template');

            if (!type || !templateStr) return;

            const template = JSON.parse(templateStr);
            const position = reactFlowWrapper.current.getBoundingClientRect();

            const x = event.clientX - position.left;
            const y = event.clientY - position.top;

            const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const newNode = {
                id,
                type,
                position: { x, y },
                data: template,
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [setNodes]
    );

    const deleteNode = () => {
        if (!selectedNode) return;
        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
        setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
        setSelectedNode(null);
    };

    const deleteEdge = () => {
        if (!selectedEdge) return;
        setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
        setSelectedEdge(null);
    };

    const deleteSelected = () => {
        const selectedNodeIds = selectedNodes.map(n => n.id);
        if (selectedNodeIds.length === 0) return;

        setNodes(nds => nds.filter(n => !selectedNodeIds.includes(n.id)));
        setEdges(eds => eds.filter(e => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)));

        setSelectedNodes([]);
        setSelectedNode(null);
        showToast(`Đã xoá ${selectedNodeIds.length} khối`);
    };

    const onReconnect = useCallback(
        (oldEdge, newConnection) => setEdges((els) => reconnectEdge(oldEdge, newConnection, els)),
        [setEdges]
    );

    const updateNodeConfig = (nodeId, key, value, extraData = {}) => {
        setNodes(nds => nds.map(n => {
            if (n.id === nodeId) {
                return {
                    ...n,
                    data: {
                        ...n.data,
                        config: {
                            ...n.data.config,
                            [key]: value,
                            ...extraData
                        }
                    }
                };
            }
            return n;
        }));
    };

    const toggleStatus = (nodeId, currentStatuses, status) => {
        const next = [...currentStatuses];
        const idx = next.indexOf(status);
        if (idx > -1) {
            if (next.length > 1) next.splice(idx, 1);
        } else {
            next.push(status);
        }
        updateNodeConfig(nodeId, 'target_statuses', next);
    };

    const handleExport = () => {
        const data = {
            name: workflow.name,
            description: workflow.description,
            nodes,
            edges,
            exported_at: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflow.name.replace(/\s+/g, '_')}_workflow.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('✅ Đã xuất kịch bản ra file JSON');
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
                    return showToast('File JSON không hợp lệ (thiếu nodes/edges)', 'error');
                }
                setNodes(data.nodes);
                setEdges(normalizeEdges(data.edges, data.nodes));
                showToast(`✅ Đã nhập kịch bản: ${data.name || file.name}`);
            } catch {
                showToast('❌ File JSON bị lỗi hoặc sai định dạng', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#0f1117] animate-in slide-in-from-right duration-500">
            {/* Action Bar */}
            <div className="h-14 border-b border-white/5 glass px-4 flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="h-7 w-px bg-white/5 mx-1" />
                    <div className="flex items-center gap-2">
                        {/* Tên workflow + nút edit */}
                        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-tight">{workflow.name}</h2>
                        <button onClick={() => setShowEditModal(true)} className="text-slate-600 hover:text-blue-400 transition-colors">
                            <Edit3 size={13} />
                        </button>

                        {/* Separator | */}
                        {(browserPort || editingPort || profileId) && (
                            <div className="w-px h-6 bg-white/10 mx-1" />
                        )}

                        {/* Cột bên phải: Port + ProfileId xếp dọc */}
                        <div className="flex flex-col gap-0.5">
                            {/* CDP Port Badge */}
                            {browserPort && !editingPort && (
                                <div className="flex items-center gap-1.5">
                                    <Icons.Plug size={11} className="text-cyan-400" />
                                    <span className="text-[11px] font-mono font-bold text-cyan-400">:{browserPort}</span>
                                    <button onClick={() => navigator.clipboard.writeText(`ws://127.0.0.1:${browserPort}`)} className="text-cyan-700 hover:text-cyan-300 transition-colors" title="Copy ws endpoint"><Icons.Copy size={10} /></button>
                                    <button onClick={() => setEditingPort(true)} className="text-slate-600 hover:text-amber-400 transition-colors" title="Sua port"><Icons.Pen size={10} /></button>
                                    <button onClick={() => setBrowserPort(null)} className="text-slate-600 hover:text-red-400 transition-colors" title="Reset port"><Icons.X size={10} /></button>
                                </div>
                            )}

                            {/* Inline edit port */}
                            {editingPort && (
                                <div className="flex items-center gap-1">
                                    <Icons.Plug size={11} className="text-cyan-400" />
                                    <span className="text-[11px] text-slate-500 font-mono">127.0.0.1:</span>
                                    <input autoFocus defaultValue={browserPort || ''} className="w-14 bg-transparent border-b border-cyan-500/50 text-[11px] font-mono text-cyan-300 focus:outline-none px-0.5" placeholder="PORT"
                                        onKeyDown={(e) => { if (e.key === 'Enter') { setBrowserPort(e.target.value || null); setEditingPort(false); } if (e.key === 'Escape') setEditingPort(false); }}
                                        onBlur={(e) => { setBrowserPort(e.target.value || null); setEditingPort(false); }}
                                    />
                                </div>
                            )}

                            {/* Nut them port (khi chua co) */}
                            {!browserPort && !editingPort && (
                                <button onClick={() => setEditingPort(true)} className="flex items-center gap-1 text-slate-600 hover:text-cyan-400 transition-colors text-[10px]" title="Them CDP port">
                                    <Icons.Plug size={10} /><span>Port</span>
                                </button>
                            )}

                            {/* Profile ID - hàng 2 trong cột */}
                            {profileId && !editingProfileId && (
                                <div className="flex items-center gap-1.5">
                                    <Icons.Fingerprint size={10} className="text-violet-400" />
                                    <span className="text-[10px] font-mono text-violet-400 cursor-default" title={profileId}>{profileId.substring(0, 8)}&hellip;</span>
                                    <button onClick={() => navigator.clipboard.writeText(profileId)} className="text-violet-700 hover:text-violet-300 transition-colors" title={"Copy: " + profileId}><Icons.Copy size={9} /></button>
                                    <button onClick={() => setEditingProfileId(true)} className="text-slate-600 hover:text-amber-400 transition-colors" title="Sua Profile ID"><Icons.Pen size={9} /></button>
                                    <button onClick={() => setProfileId(null)} className="text-slate-600 hover:text-red-400 transition-colors" title="Reset"><Icons.X size={9} /></button>
                                </div>
                            )}

                            {/* Inline edit Profile ID */}
                            {editingProfileId && (
                                <div className="flex items-center gap-1">
                                    <Icons.Fingerprint size={10} className="text-violet-400" />
                                    <input
                                        autoFocus
                                        defaultValue={profileId || ''}
                                        className="w-32 bg-transparent border-b border-violet-500/50 text-[10px] font-mono text-violet-300 focus:outline-none px-0.5"
                                        placeholder="Profile ID..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { setProfileId(e.target.value || null); setEditingProfileId(false); }
                                            if (e.key === 'Escape') setEditingProfileId(false);
                                        }}
                                        onBlur={(e) => { setProfileId(e.target.value || null); setEditingProfileId(false); }}
                                    />
                                </div>
                            )}

                            {/* Nut them Profile ID khi chua co */}
                            {!profileId && !editingProfileId && (
                                <button onClick={() => setEditingProfileId(true)} className="flex items-center gap-1 text-slate-600 hover:text-violet-400 transition-colors text-[10px]" title="Them Profile ID">
                                    <Icons.Fingerprint size={10} /><span>Profile ID</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => handleSave()} className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/10 transition-all">
                        <Save size={14} /> Lưu lại
                    </button>
                    {isExecuting ? (
                        <button
                            onClick={handleStop}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-red-600 shadow-lg shadow-red-500/20 hover:bg-red-500 transition-all animate-pulse"
                        >
                            <Icons.Square size={14} fill="white" /> Dừng
                        </button>
                    ) : (
                        <button
                            onClick={handleRun}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all"
                        >
                            <Play size={14} fill="white" /> Chạy thử
                        </button>
                    )}

                    {/* Auto-follow toggle: chi hien khi dang chay */}
                    {isExecuting && (
                        <button
                            onClick={() => setAutoFollow(v => !v)}
                            title={autoFollow ? 'Tắt theo dõi tự động' : 'Bật theo dõi tự động — màn hình di chuyển tới khối đang chạy'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${autoFollow
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Icons.Locate size={13} />
                            Theo dõi
                        </button>
                    )}
                    <button
                        onClick={() => setSelectionMode(!selectionMode)}
                        title={selectionMode ? "Tắt chế độ chọn nhiều" : "Bật chế độ chọn nhiều (Quét chuột để chọn)"}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${selectionMode ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                    >
                        <BoxSelect size={18} />
                    </button>
                    <div className="h-5 w-px bg-white/10" />
                    <button
                        onClick={handleExport}
                        title="Xuất kịch bản ra JSON"
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                    >
                        <Download size={16} />
                    </button>
                    <button
                        onClick={() => importFileRef.current?.click()}
                        title="Nhập kịch bản từ JSON"
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                    >
                        <Upload size={16} />
                    </button>
                    <input
                        ref={importFileRef}
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={handleImport}
                    />
                    <button
                        onClick={handleCaptureFlow}
                        title="Chụp toàn bộ flow"
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                    >
                        <Icons.Camera size={16} />
                    </button>
                    <button
                        onClick={() => setShowHints(h => !h)}
                        title={showHints ? 'An gợi ý' : 'Hiện gợi ý'}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${showHints ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-slate-500 hover:text-white'}`}
                    >
                        <Icons.HelpCircle size={16} />
                    </button>
                    <button
                        onClick={() => setShowLogs(!showLogs)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${showLogs ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                    >
                        <Terminal size={18} />
                    </button>
                </div>
            </div >

            <div className="flex flex-1 overflow-hidden relative" ref={reactFlowWrapper}>
                <LibrarySidebar onAddNode={addNode} onDragStart={onDragStart} />

                {/* Canvas */}
                <div className="flex-1 bg-[#0f1117] relative">
                    <ReactFlow
                        nodes={nodes} edges={edges}
                        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                        nodeTypes={nodeTypes} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
                        onEdgeClick={onEdgeClick} onReconnect={onReconnect}
                        onDrop={onDrop} onDragOver={onDragOver}
                        selectionOnDrag={selectionMode}
                        panOnDrag={!selectionMode}
                        selectionKeyCode="Control"
                        multiSelectionKeyCode="Control"
                        deleteKeyCode="Delete"
                        fitView className="bg-[#0f1117]"
                        proOptions={{ hideAttribution: true }}
                        defaultEdgeOptions={{ animated: true, style: { strokeWidth: 3 } }}
                    >
                        {showHints && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                                <div className="bg-[#161b27]/80 backdrop-blur-md border border-white/5 px-4 py-2 rounded-full shadow-2xl flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                        <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-300">Ctrl</kbd>
                                        <span>+ Kéo</span>
                                        <span className="text-white/20">|</span>
                                        <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-300">Del</kbd>
                                        <span>xoá</span>
                                        <span className="text-white/20">|</span>
                                        <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-300">Ctrl+C</kbd>
                                        <span>sao chép</span>
                                        <span className="text-white/20">|</span>
                                        <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-300">Ctrl+V</kbd>
                                        <span>dán</span>
                                    </div>
                                    {selectionMode && (
                                        <>
                                            <div className="w-px h-3 bg-white/10" />
                                            <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider animate-pulse">
                                                Selection Mode Active
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                        <Background color="#1e2535" gap={25} size={1} variant="dots" />
                        <Controls className="!bg-[#161b27] !border-white/5 !shadow-2xl fill-white" />
                        <MiniMap
                            className="!bg-[#161b27] !border-white/5 !rounded-xl overflow-hidden shadow-2xl"
                            maskColor="rgba(0, 0, 0, 0.4)"
                            nodeColor={n => n.type === 'sourceNode' ? '#10b981' : '#3b82f6'}
                        />
                    </ReactFlow>

                    {/* Console Panel */}
                    <aside
                        className={`absolute bottom-0 left-0 right-0 z-20 glass border-t border-white/10 transition-[opacity] duration-300 ${showLogs ? '' : 'opacity-0 pointer-events-none'}`}
                        style={{ height: showLogs ? `${logHeight}px` : 0 }}
                    >
                        {/* Drag handle — keo len/xuong de resize */}
                        <div
                            className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-500/40 transition-colors z-10 group"
                            onMouseDown={e => {
                                e.preventDefault();
                                logDragRef.current = { startY: e.clientY, startH: logHeight };
                                const onMove = ev => {
                                    const delta = logDragRef.current.startY - ev.clientY;
                                    const newH = Math.min(Math.max(logDragRef.current.startH + delta, 120), window.innerHeight * 0.8);
                                    setLogHeight(newH);
                                };
                                const onUp = () => {
                                    window.removeEventListener('mousemove', onMove);
                                    window.removeEventListener('mouseup', onUp);
                                };
                                window.addEventListener('mousemove', onMove);
                                window.addEventListener('mouseup', onUp);
                            }}
                        >
                            <div className="absolute left-1/2 -translate-x-1/2 top-0 w-10 h-1 rounded-full bg-white/20 group-hover:bg-blue-400/60 transition-colors" />
                        </div>
                        <div className="flex items-center justify-between px-4 h-10 border-b border-white/5 bg-white/[0.02]">
                            <div className="flex items-center gap-2">
                                <Terminal size={14} className="text-blue-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Kết quả chạy thử</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setLogs([])} className="text-[10px] text-slate-500 hover:text-white transition-colors">Xoá log</button>
                                <div className="w-px h-3 bg-white/10 mx-1" />
                                <button onClick={() => setShowLogs(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
                            </div>
                        </div>
                        <div
                            ref={logContainerRef}
                            className="p-4 h-[calc(100%-40px)] overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800"
                        >
                            {logs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-700 select-none">
                                    <Terminal size={32} className="mb-2 opacity-20" />
                                    <p>Chưa có dữ liệu tiến trình...</p>
                                </div>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                        <span className={`
                                            ${log.type === 'error' ? 'text-red-400' : ''}
                                            ${log.type === 'success' ? 'text-emerald-400' : ''}
                                            ${log.type === 'info' ? 'text-blue-400' : ''}
                                            ${log.type === 'warning' ? 'text-amber-400' : ''}
                                        `}>
                                            {log.message}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>
                </div>

                {/* Right Panel - Configuration */}
                {(() => {
                    const activeSelectedNode = selectedNode ? nodes.find(n => n.id === selectedNode.id) : null;
                    return (
                        <aside className={`w-72 glass border-l border-white/5 z-10 transition-all duration-300 flex flex-col overflow-hidden ${activeSelectedNode || selectedEdge ? 'translate-x-0' : 'translate-x-full absolute right-0 scale-95 opacity-0'}`}>
                            {activeSelectedNode && (
                                <div className="flex flex-col h-full">
                                    {/* Fixed header */}
                                    <div className="p-4 pb-0 space-y-4 shrink-0">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Settings2 size={16} className="text-blue-400" />
                                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Cấu hình khối</span>
                                            </div>
                                            <button onClick={deleteNode} className="p-1.5 hover:bg-red-500/10 text-slate-600 hover:text-red-500 rounded-lg transition-all">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">{activeSelectedNode.data.category}</p>
                                            <p className="text-sm font-bold text-slate-200">{activeSelectedNode.data.label}</p>
                                        </div>
                                    </div>

                                    {/* Scrollable content */}
                                    <div className="flex-1 overflow-y-auto p-4 pt-4 space-y-5 text-slate-200 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
                                        {activeSelectedNode.type === 'sourceNode' ? (
                                            <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
                                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                                    <Icons.Zap size={24} className="text-emerald-400 fill-emerald-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-300 mb-1">Điểm bắt đầu</p>
                                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                                        Nhóm tài khoản và proxy sẽ được<br />
                                                        chọn khi nhấn <span className="text-emerald-400 font-bold">▶ Chạy thử</span>
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={handleRun}
                                                    className="mt-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-all flex items-center gap-2"
                                                >
                                                    <Icons.Play size={12} fill="white" /> Cấu hình & Chạy thử
                                                </button>
                                            </div>
                                        ) : (
                                            Object.keys(activeSelectedNode.data.config || {}).filter(k => !k.startsWith('delay_')).map(key => {
                                                const label = key.replace(/_/g, ' ');
                                                const value = activeSelectedNode.data.config[key];

                                                if (key === 'type' && activeSelectedNode.data.label === 'Điều kiện') {
                                                    return (
                                                        <div key={key}>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">{label}</label>
                                                            <Select
                                                                options={[
                                                                    { value: 'element_exists', label: 'Phần tử xuất hiện' },
                                                                    { value: 'element_not_exists', label: 'Phần tử biến mất' },
                                                                    { value: 'text_exists', label: 'Chứa đoạn chữ' },
                                                                ]}
                                                                value={value}
                                                                onChange={(e) => updateNodeConfig(activeSelectedNode.id, key, e.target.value)}
                                                            />
                                                        </div>
                                                    );
                                                }

                                                if (key === 'status' && activeSelectedNode.data.label === 'Cập nhật trạng thái') {
                                                    return (
                                                        <div key={key}>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">{label}</label>
                                                            <Select
                                                                options={[
                                                                    { value: 'active', label: 'Hoạt động' },
                                                                    { value: 'verified', label: 'Đã xác thực' },
                                                                    { value: 'die_mail', label: 'Die Mail' },
                                                                    { value: 'no_mail', label: 'No Mail' },
                                                                    { value: 'Reset Error', label: 'Lỗi Reset' },
                                                                    { value: 'banned', label: 'Bị khoá' },
                                                                    { value: 'inactive', label: 'Không kích hoạt' },
                                                                    { value: 'pending', label: 'Chờ xử lý' },
                                                                ]}
                                                                value={value}
                                                                onChange={(e) => updateNodeConfig(activeSelectedNode.id, key, e.target.value)}
                                                            />
                                                        </div>
                                                    );
                                                }

                                                if (key === 'extract_type' && activeSelectedNode.data.label === 'Đọc Email') {
                                                    return (
                                                        <div key={key}>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">Loại trích xuất</label>
                                                            <Select
                                                                options={[
                                                                    { value: 'link', label: 'Link đầu tiên trong email' },
                                                                    { value: 'link_pattern', label: 'Link theo pattern (extract_pattern)' },
                                                                    { value: 'otp_subject', label: 'OTP từ tiêu đề (Subject)' },
                                                                    { value: 'otp_body', label: 'OTP từ nội dung (Body)' },
                                                                    { value: 'regex', label: 'Regex tuỳ chỉnh' },
                                                                ]}
                                                                value={value}
                                                                onChange={(e) => updateNodeConfig(activeSelectedNode.id, key, e.target.value)}
                                                            />
                                                        </div>
                                                    );
                                                }

                                                if (key === 'variables' && activeSelectedNode.data.label === 'Khai báo biến') {
                                                    return (
                                                        <div key={key}>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">Danh sách biến</label>
                                                            <p className="text-[9px] text-slate-600 italic pl-1 mb-2">Mỗi dòng: <span className="text-teal-500 font-mono">tên_biến=giá_trị</span> (để trống = chờ block khác điền)</p>
                                                            <textarea
                                                                rows={6}
                                                                className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50 transition-all font-mono resize-none"
                                                                value={value}
                                                                onChange={(e) => updateNodeConfig(activeSelectedNode.id, key, e.target.value)}
                                                                placeholder={"reset_link=\notp=\nverify_link=\nmy_url=https://example.com"}
                                                            />
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div key={key}>
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">{label}</label>
                                                        <input
                                                            type={['seconds', 'timeout', 'retries', 'wait_seconds'].includes(key) ? 'number' : 'text'}
                                                            className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all font-medium"
                                                            value={value}
                                                            onChange={(e) => updateNodeConfig(activeSelectedNode.id, key, e.target.value)}
                                                            placeholder={`Nhập ${label.toLowerCase()}...`}
                                                        />
                                                    </div>
                                                );
                                            })
                                        )}

                                        {/* Common Random Delay Config */}
                                        <div className="pt-4 border-t border-white/5 space-y-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icons.Clock size={13} className="text-amber-500" />
                                                <label className="text-[10px] font-bold text-amber-500 uppercase">Nghi ngẫu nhiên sau khối</label>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[9px] text-slate-500 block mb-1.5 ml-1">Giây (Ít nhất)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/30 transition-all font-medium"
                                                        value={activeSelectedNode.data.config?.delay_min || 0}
                                                        onChange={(e) => updateNodeConfig(activeSelectedNode.id, 'delay_min', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] text-slate-500 block mb-1.5 ml-1">Giây (Nhiều nhất)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/30 transition-all font-medium"
                                                        value={activeSelectedNode.data.config?.delay_max || 0}
                                                        onChange={(e) => updateNodeConfig(activeSelectedNode.id, 'delay_max', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-[9px] text-slate-600 italic px-1">Khoảng nghỉ này sẽ xảy ra ngay sau khi khối thực hiện xong nhiệm vụ.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedEdge && (
                                <div className="space-y-6 text-slate-200 p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icons.Share2 size={16} className="text-purple-400" />
                                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Kết nối</span>
                                        </div>
                                        <button onClick={deleteEdge} className="p-1.5 hover:bg-red-500/10 text-slate-600 hover:text-red-500 rounded-lg transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">Hành động</span>
                                            <button onClick={deleteEdge} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[11px] font-bold transition-all">
                                                <Link2Off size={13} /> Xoá dây
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-slate-400 italic">Dây này kết nối trình tự thực hiện giữa hai khối lệnh.</p>
                                    </div>
                                </div>
                            )}

                            {!activeSelectedNode && !selectedEdge && selectedNodes.length > 1 && (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6 animate-in fade-in zoom-in duration-300">
                                    <div className="w-20 h-20 rounded-[2.5rem] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-2xl shadow-blue-500/10">
                                        <BoxSelect size={40} />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-bold text-slate-200">Đã chọn {selectedNodes.length} khối</p>
                                        <p className="text-xs text-slate-500">Bạn có thể di chuyển chúng cùng lúc hoặc xoá tất cả.</p>
                                    </div>
                                    <button
                                        onClick={deleteSelected}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 transition-all font-bold text-xs"
                                    >
                                        <Trash2 size={16} /> Xoá {selectedNodes.length} khối đã chọn
                                    </button>
                                </div>
                            )}

                            {!activeSelectedNode && !selectedEdge && selectedNodes.length <= 1 && (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                                    <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-700">
                                        <Settings2 size={32} />
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">Chọn một khối hoặc dây nối trên sơ đồ để cấu hình</p>
                                </div>
                            )}
                        </aside>
                    );
                })()}
            </div>

            {
                showEditModal && (
                    <Modal title="Chỉnh sửa thông tin kịch bản" onClose={() => setShowEditModal(false)}>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2 pl-1">Tên kịch bản</label>
                                <input
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                                    value={editData.name}
                                    onChange={e => setEditData({ ...editData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2 pl-1">Mô tả</label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 resize-none"
                                    rows={3}
                                    value={editData.description}
                                    onChange={e => setEditData({ ...editData, description: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button onClick={() => setShowEditModal(false)} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-white/5 transition-all">Huỷ</button>
                                <button onClick={handleUpdateDetails} className="px-8 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-all">Đầy lên</button>
                            </div>
                        </div>
                    </Modal>
                )
            }

            {
                showRunModal && (
                    <Modal title="Cấu hình chạy" onClose={() => setShowRunModal(false)}>
                        <div className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2 pl-1">Nhóm tài khoản <span className="text-rose-500">*</span></label>
                                <Select options={accountGroups.map(g => ({ value: g._id, label: g.name }))} value={runConfig.account_group_id} onChange={e => setRunConfig(c => ({ ...c, account_group_id: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2 pl-1">Nhóm proxy <span className="text-slate-600">(tuỳ chọn)</span></label>
                                <Select
                                    options={[{ value: '', label: '— Không dùng proxy —' }, ...proxyGroups.map(g => ({ value: g._id, label: g.name }))]}
                                    value={runConfig.proxy_group_id}
                                    onChange={e => setRunConfig(c => ({ ...c, proxy_group_id: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2 pl-1">
                                    Mật khẩu mới <span className="text-slate-600 font-normal normal-case">(nếu kịch bản cần)</span>
                                </label>
                                <input
                                    value={runConfig.new_password}
                                    onChange={e => setRunConfig(c => ({ ...c, new_password: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                                    placeholder="Để trống nếu kịch bản không cần..."
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2 pl-1">Trạng thái tài khoản cần xử lý</label>
                                <div className="flex flex-wrap gap-2">
                                    {['active', 'inactive', 'pending', 'no_mail', 'die_mail', 'Reset Error'].map(s => {
                                        const checked = runConfig.target_statuses.includes(s);
                                        const statusInfo = STATUS_MAP[s];
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => setRunConfig(c => ({
                                                    ...c,
                                                    target_statuses: checked ? c.target_statuses.filter(x => x !== s) : [...c.target_statuses, s]
                                                }))}
                                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${checked
                                                    ? `${statusInfo?.bg || 'bg-blue-500/20 border-blue-500/50'} ${statusInfo?.color || 'text-blue-400'}`
                                                    : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'
                                                    }`}
                                            >
                                                {statusInfo?.label || s}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2 pl-1">
                                    Số tài khoản muốn chạy
                                </label>
                                <input
                                    type="number" min="0"
                                    value={runConfig.limit}
                                    onChange={e => setRunConfig(c => ({ ...c, limit: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                                    placeholder="Để trống = chạy tất cả"
                                />
                                <p className="text-[10px] text-slate-600 mt-1.5 pl-1 italic">Nhập số để giới hạn, để trống = chạy hết</p>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={() => setShowRunModal(false)} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-white/5 transition-all">Huỷ</button>
                                <button onClick={handleConfirmRun} className="px-8 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-all flex items-center gap-2">
                                    <Icons.Play size={14} fill="white" /> Bắt đầu chạy
                                </button>
                            </div>
                        </div>
                    </Modal>
                )
            }
        </div >
    );
}
