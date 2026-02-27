import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    ReactFlow,
    addEdge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
} from '@xyflow/react';
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
} from 'lucide-react';
import { showToast } from '../../../components/Toast';
import { AccountsService, ProxiesService, WorkflowsService } from '../../../services/apiService';
import { STATUS_MAP } from '../../../lib/ui';
import Select from '../../../components/Select';
import Modal from '../../../components/Modal';
import TaskNode from './TaskNode';
import SourceNode from './SourceNode';
import { NODE_TEMPLATES } from '../constants';

const nodeTypes = {
    taskNode: TaskNode,
    sourceNode: SourceNode
};

export default function WorkflowEditor({ workflow, onBack, onUpdate }) {
    const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges || []);
    const [selectedNode, setSelectedNode] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState({ name: workflow.name, description: workflow.description || '' });

    const [accountGroups, setAccountGroups] = useState([]);
    const [proxyGroups, setProxyGroups] = useState([]);

    const reactFlowWrapper = useRef(null);

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

    const handleSave = async () => {
        try {
            await WorkflowsService.update(workflow._id, {
                nodes,
                edges
            });
            showToast('✅ Đã lưu quy trình thành công');
            onUpdate();
        } catch (e) { showToast(e.message, 'error'); }
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

    const onNodeClick = (_, node) => setSelectedNode(node);
    const onPaneClick = () => setSelectedNode(null);

    const addNode = (template) => {
        const id = `${template.type}_${Date.now()}`;
        const newNode = {
            id,
            type: template.type,
            position: { x: 400, y: 150 },
            data: JSON.parse(JSON.stringify(template)),
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const deleteNode = () => {
        if (!selectedNode) return;
        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
        setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
        setSelectedNode(null);
    };

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

    return (
        <div className="flex flex-col h-full -m-6 overflow-hidden bg-[#0f1117] animate-in slide-in-from-right duration-500">
            {/* Action Bar */}
            <div className="h-14 border-b border-white/5 glass px-4 flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="h-7 w-px bg-white/5 mx-1" />
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-tight">{workflow.name}</h2>
                            <button onClick={() => setShowEditModal(true)} className="text-slate-600 hover:text-blue-400 transition-colors">
                                <Edit3 size={13} />
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-500">Đang thiết kế quy trình tự động hóa</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleSave} className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/10 transition-all">
                        <Save size={14} /> Lưu lại
                    </button>
                    <button className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all">
                        <Play size={14} fill="white" /> Chạy thử
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative" ref={reactFlowWrapper}>
                {/* Left Sidebar - Library */}
                <aside className="w-64 glass border-r border-white/5 z-10 flex flex-col overflow-hidden shrink-0 text-slate-200">
                    <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                            <Binary size={14} className="text-purple-400" />
                            <p className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">Thư viện khối</p>
                        </div>
                    </div>
                    <div className="p-4 space-y-2 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-800">
                        {NODE_TEMPLATES.map((tpl, i) => {
                            const Icon = Icons[tpl.icon] || Icons.MousePointer2;
                            return (
                                <button key={i} onClick={() => addNode(tpl)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/5 transition-all text-left group">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${tpl.color} group-hover:scale-110 flex-shrink-0 shadow-lg`}>
                                        <Icon size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-medium text-slate-600 leading-none mb-0.5">{tpl.category}</p>
                                        <p className="text-[11px] font-semibold text-slate-300 truncate">{tpl.label}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* Canvas */}
                <div className="flex-1 bg-[#0f1117] relative">
                    <ReactFlow
                        nodes={nodes} edges={edges}
                        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                        nodeTypes={nodeTypes} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
                        fitView className="bg-[#0f1117]"
                        defaultEdgeOptions={{ animated: true, style: { strokeWidth: 3 } }}
                    >
                        <Background color="#1e2535" gap={25} size={1} variant="dots" />
                        <Controls className="!bg-[#161b27] !border-white/5 !shadow-2xl fill-white" />
                        <MiniMap
                            className="!bg-[#161b27] !border-white/5 !rounded-xl overflow-hidden shadow-2xl"
                            maskColor="rgba(0, 0, 0, 0.4)"
                            nodeColor={n => n.type === 'sourceNode' ? '#10b981' : '#3b82f6'}
                        />
                    </ReactFlow>
                </div>

                {/* Right Panel - Configuration */}
                {(() => {
                    const activeSelectedNode = selectedNode ? nodes.find(n => n.id === selectedNode.id) : null;
                    return (
                        <aside className={`w-72 glass border-l border-white/5 p-4 z-10 transition-all duration-300 ${activeSelectedNode ? 'translate-x-0' : 'translate-x-full absolute right-0 scale-95 opacity-0'}`}>
                            {activeSelectedNode && (
                                <div className="space-y-6 text-slate-200">
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

                                    <div className="space-y-5">
                                        {activeSelectedNode.type === 'sourceNode' ? (
                                            <>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">Nhóm tài khoản</label>
                                                    <Select
                                                        options={accountGroups.map(g => ({ value: g._id, label: g.name }))}
                                                        value={activeSelectedNode.data.config.account_group_id}
                                                        onChange={e => {
                                                            const g = accountGroups.find(x => x._id === e.target.value);
                                                            updateNodeConfig(activeSelectedNode.id, 'account_group_id', e.target.value, { account_group_name: g?.name });
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">Trạng thái chạy</label>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {Object.keys(STATUS_MAP).map(status => {
                                                            const isSelected = activeSelectedNode.data.config.target_statuses.includes(status);
                                                            return (
                                                                <button key={status} onClick={() => toggleStatus(activeSelectedNode.id, activeSelectedNode.data.config.target_statuses, status)}
                                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all 
                                                                        ${isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'}`}>
                                                                    {STATUS_MAP[status].label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">Nhóm Proxy</label>
                                                    <Select
                                                        options={proxyGroups.map(g => ({ value: g._id, label: g.name }))}
                                                        value={activeSelectedNode.data.config.proxy_group_id}
                                                        onChange={e => {
                                                            const g = proxyGroups.find(x => x._id === e.target.value);
                                                            updateNodeConfig(activeSelectedNode.id, 'proxy_group_id', e.target.value, { proxy_group_name: g?.name });
                                                        }}
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            Object.keys(activeSelectedNode.data.config || {}).map(key => (
                                                <div key={key}>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">{key.replace(/_/g, ' ')}</label>
                                                    <input
                                                        className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all font-medium"
                                                        value={activeSelectedNode.data.config[key]}
                                                        onChange={(e) => updateNodeConfig(activeSelectedNode.id, key, e.target.value)}
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                            {!activeSelectedNode && (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                                    <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-700">
                                        <Settings2 size={32} />
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">Chọn một khối trên sơ đồ để bắt đầu cấu hình chi tiết</p>
                                </div>
                            )}
                        </aside>
                    );
                })()}
            </div>

            {showEditModal && (
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
                            <button onClick={handleUpdateDetails} className="px-8 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-all">Cập nhật</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
