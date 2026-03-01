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
import NodeConfigPanel from './NodeConfigPanel';
import LogPanel from './LogPanel';
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
    const socketRef = useRef(null);                               // socket singleton cho execution nay
    const [currentExecutionId, setCurrentExecutionId] = useState(null);
    const [activeNodeId, setActiveNodeId] = useState(null);       // Node dang chay
    const [nodeVisitMap, setNodeVisitMap] = useState({});          // { [nodeId]: count } so lan da chay qua
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

    // ── Phát hiện execution đang chạy khi reload/F5 ──────────────────────────
    useEffect(() => {
        let cancelled = false;
        const tryReconnect = async () => {
            // Guard: neu socket da ton tai thi khong tao moi
            if (socketRef.current?.connected) return;

            try {
                const res = await WorkflowsService.getAllExecutions();
                if (cancelled) return;
                const executions = res.data?.data || res.data || [];
                const running = executions.find(e =>
                    String(e.workflowId) === String(workflow._id) &&
                    (e.status === 'running' || e.status === 'stopping')
                );
                if (!running) return;

                const execId = running.executionId;
                setCurrentExecutionId(execId);
                setIsExecuting(true);
                setShowLogs(true);
                addLog(`🔄 Đã tìm thấy quy trình đang chạy: ${execId}`, 'info');

                const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
                const { io } = await import('socket.io-client');
                if (cancelled) return;

                // Tao socket 1 lan duy nhat
                const socket = io(SOCKET_URL, {
                    transports: ['polling', 'websocket'],
                    reconnection: true,
                });
                socketRef.current = socket;

                const joinRoom = () => {
                    socket.emit('join-execution', execId);
                    addLog(`📡 Đã kết nối lại luồng cập nhật trực tiếp.`, 'info');
                };
                if (socket.connected) joinRoom();
                else socket.once('connect', joinRoom);

                const handleLog = (newLog) => {
                    setLogs(prev => [...prev, {
                        ...newLog,
                        id: newLog.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        time: newLog.timestamp ? new Date(newLog.timestamp).toLocaleTimeString('vi-VN') : new Date().toLocaleTimeString('vi-VN'),
                    }]);
                    const portMatch = newLog?.message?.match(/CDP Port: (\d+)/);
                    if (portMatch) setBrowserPort(portMatch[1]);
                    const profileMatch = newLog?.message?.match(/Profile ID: ([a-f0-9\-]{30,})/);
                    if (profileMatch) setProfileId(profileMatch[1]);
                };

                const handleBatch = (entries) => {
                    if (!Array.isArray(entries)) return;
                    let counter = 0;
                    const ts = Date.now();
                    setLogs(prev => [...prev, ...entries.filter(Boolean).map(e => ({
                        ...e,
                        id: e.id || `r${ts}-${counter++}-${Math.random().toString(36).substr(2, 6)}`,
                        time: e.timestamp ? new Date(e.timestamp).toLocaleTimeString('vi-VN') : new Date().toLocaleTimeString('vi-VN'),
                    }))]);
                };

                socket.on('workflow-log', handleLog);
                socket.on('workflow-log-batch', handleBatch);
                socket.on('workflow-node-active', ({ nodeId }) => {
                    setActiveNodeId(nodeId);
                    setNodeVisitMap(prev => ({ ...prev, [nodeId]: (prev[nodeId] || 0) + 1 }));
                });
                socket.on('workflow-status', (data) => {
                    if (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped') {
                        setIsExecuting(false);
                        setCurrentExecutionId(null);
                        setActiveNodeId(null);
                        socket.disconnect();
                        socketRef.current = null;
                    }
                });
                socket.on('disconnect', () => setIsExecuting(false));
            } catch (e) {
                console.warn('[WorkflowEditor] tryReconnect failed:', e.message);
            }
        };

        tryReconnect();
        return () => {
            cancelled = true;
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workflow._id]);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // Cap nhat data._active, _onResume, _browserPort, _visitCount cho all nodes
    useEffect(() => {
        setNodes(nds => nds.map(n => ({
            ...n,
            data: {
                ...n.data,
                _active: n.id === activeNodeId,
                _browserPort: browserPort,
                _onResume: handleResumeFrom,
                _visitCount: nodeVisitMap[n.id] || 0,
            }
        })));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeNodeId, browserPort, nodeVisitMap, nodes.length, setNodes]);

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

    const fetchStatusCounts = async (groupId) => {
        if (!groupId) { setRunConfig(c => ({ ...c, _statusCounts: {} })); return; }
        try {
            const res = await AccountsService.getStats({ group_id: groupId });
            const raw = res.data?.data?.stats || [];
            const map = {};
            raw.forEach(s => { map[s._id] = s.count; });
            setRunConfig(c => ({ ...c, _statusCounts: map }));
        } catch { /* ignore */ }
    };

    const handleRun = () => {
        const sourceNode = nodes.find(n => n.type === 'sourceNode');
        if (!sourceNode) return showToast('Vui lòng thêm khối START để khởi chạy', 'warning');
        setShowRunModal(true);
        // Fetch ngay khi mo modal neu da co group_id
        if (runConfig.account_group_id) fetchStatusCounts(runConfig.account_group_id);
    };

    const handleConfirmRun = async () => {
        if (!runConfig.account_group_id) return showToast('Vui lòng chọn Nhóm tài khoản', 'warning');
        setShowRunModal(false);
        try {
            setIsExecuting(true);
            setShowLogs(true);
            setLogs([]);
            setNodeVisitMap({});   // Reset visit counter cho run moi
            setActiveNodeId(null);
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
            const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
            const socket = io(SOCKET_URL, {
                transports: ['polling', 'websocket'],
                reconnection: true,
            });
            socketRef.current = socket;

            socket.on('connect', () => {
                socket.emit('join-execution', executionId);
                addLog(`📡 Đã kết nối luồng cập nhật trực tiếp.`, 'info');
            });

            // Single log event (legacy / test mode)
            socket.on('workflow-log', (newLog) => {
                setLogs(prev => [...prev, {
                    ...newLog,
                    id: newLog.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    time: newLog.timestamp ? new Date(newLog.timestamp).toLocaleTimeString('vi-VN') : new Date().toLocaleTimeString('vi-VN'),
                }]);
                const portMatch = newLog?.message?.match(/CDP Port: (\d+)/);
                if (portMatch) setBrowserPort(portMatch[1]);
                const profileMatch = newLog?.message?.match(/Profile ID: ([a-f0-9\-]{30,})/);
                if (profileMatch) setProfileId(profileMatch[1]);
            });

            // Batch log event (optimized)
            socket.on('workflow-log-batch', (entries) => {
                if (!Array.isArray(entries)) return;
                let counter = 0;
                const ts = Date.now();
                setLogs(prev => [...prev, ...entries.filter(Boolean).map(e => ({
                    ...e,
                    id: e.id || `b${ts}-${counter++}-${Math.random().toString(36).substr(2, 6)}`,
                    time: e.timestamp ? new Date(e.timestamp).toLocaleTimeString('vi-VN') : new Date().toLocaleTimeString('vi-VN'),
                }))]);
            });

            socket.on('workflow-status', (data) => {
                if (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped') {
                    setIsExecuting(false);
                    setCurrentExecutionId(null);
                    setActiveNodeId(null);
                    socket.disconnect();
                    socketRef.current = null;
                }
            });

            // Highlight khối đang chạy + tăng visit count
            socket.on('workflow-node-active', ({ nodeId }) => {
                setActiveNodeId(nodeId);
                setNodeVisitMap(prev => ({ ...prev, [nodeId]: (prev[nodeId] || 0) + 1 }));
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
                            style={{
                                background: '#161b27',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '12px',
                                width: 200,
                                height: 140,
                            }}
                            maskColor="rgba(0, 0, 0, 0.5)"
                            nodeColor={n => n.type === 'sourceNode' ? '#10b981' : '#3b82f6'}
                            nodeStrokeWidth={3}
                            zoomable
                            pannable
                        />
                    </ReactFlow>

                    {/* Console Panel */}
                    <LogPanel
                        show={showLogs}
                        logs={logs}
                        logHeight={logHeight}
                        setLogHeight={setLogHeight}
                        onClose={() => setShowLogs(false)}
                        onClear={() => setLogs([])}
                    />
                </div>

                {/* Right Panel - Configuration */}
                <NodeConfigPanel
                    selectedNode={selectedNode}
                    selectedEdge={selectedEdge}
                    selectedNodes={selectedNodes}
                    nodes={nodes}
                    updateNodeConfig={updateNodeConfig}
                    deleteNode={deleteNode}
                    deleteEdge={deleteEdge}
                    deleteSelected={deleteSelected}
                    handleRun={handleRun}
                />
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
                                <Select options={accountGroups.map(g => ({ value: g._id, label: g.name }))} value={runConfig.account_group_id} onChange={e => { setRunConfig(c => ({ ...c, account_group_id: e.target.value })); fetchStatusCounts(e.target.value); }} />
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
                                    {['active', 'inactive', 'pending', 'captcha', 'no_mail', 'die_mail', 'Reset Error', 'verified', 'banned'].map(s => {
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
                                                {(runConfig._statusCounts?.[s] !== undefined) && (
                                                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${checked ? 'bg-black/20' : 'bg-white/10'
                                                        }`}>{runConfig._statusCounts[s]}</span>
                                                )}
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
