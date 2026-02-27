import React, { useState } from 'react';
import {
    Plus,
    Zap,
    Trash2,
    Layers,
    Calendar,
    ChevronRight,
    Edit3,
    FileText,
    Database
} from 'lucide-react';
import Modal from '../../../components/Modal';
import ConfirmModal from '../../../components/ConfirmModal';
import { WorkflowsService } from '../../../services/apiService';
import { showToast } from '../../../components/Toast';

export default function WorkflowList({ workflows, loading, onEdit, onCreate, onDeleteSuccess, onUpdateSuccess }) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [newWorkflowData, setNewWorkflowData] = useState({ name: '', description: '' });
    const [editData, setEditData] = useState({ name: '', description: '' });
    const [currentWorkflow, setCurrentWorkflow] = useState(null);

    const handleCreate = async () => {
        if (!newWorkflowData.name.trim()) return showToast('Vui lòng nhập tên quy trình', 'warning');
        try {
            const initialNodes = [
                {
                    id: 'source_start',
                    type: 'sourceNode',
                    position: { x: 250, y: 50 },
                    data: {
                        label: 'Nguồn dữ liệu',
                        category: 'Hệ thống',
                        icon: 'Database',
                        color: 'bg-emerald-500/20 text-emerald-400',
                        config: {
                            account_group_id: '',
                            account_group_name: '',
                            proxy_group_id: '',
                            proxy_group_name: '',
                            target_statuses: ['active']
                        }
                    }
                }
            ];
            const res = await WorkflowsService.create({
                ...newWorkflowData,
                nodes: initialNodes,
                edges: [],
                config: { account_group_id: '', target_statuses: ['active'], proxy_group_id: '' }
            });
            showToast('✅ Đã tạo quy trình mới');
            setShowCreateModal(false);
            setNewWorkflowData({ name: '', description: '' });
            onCreate(res.data);
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleUpdateDetails = async () => {
        if (!editData.name.trim()) return showToast('Tên quy trình không được để trống', 'warning');
        try {
            await WorkflowsService.update(currentWorkflow._id, editData);
            showToast('✅ Cập nhật thông tin thành công');
            setShowEditModal(false);
            onUpdateSuccess();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const confirmDeleteWorkflow = async () => {
        try {
            await WorkflowsService.delete(confirmDelete);
            showToast('Đã xoá quy trình');
            setConfirmDelete(null);
            onDeleteSuccess();
        } catch (e) { showToast(e.message, 'error'); }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-200">Kịch bản tự động hóa</h1>
                    <p className="text-xs text-slate-500">Quản lý và thiết kế các quy trình tương tác tài khoản</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-500/20 hover:bg-blue-500 transition-all active:scale-95"
                >
                    <Plus size={18} /> Tạo kịch bản mới
                </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    Array(3).fill(0).map((_, i) => (
                        <div key={i} className="h-48 glass rounded-3xl border border-white/5 animate-pulse" />
                    ))
                ) : workflows.length === 0 ? (
                    <div className="col-span-full h-64 glass rounded-3xl border border-white/5 flex flex-col items-center justify-center text-slate-500 gap-4">
                        <div className="p-4 rounded-full bg-white/5"><FileText size={32} /></div>
                        <p>Bạn chưa có kịch bản nào. Hãy tạo kịch bản đầu tiên!</p>
                    </div>
                ) : (
                    workflows.map(wf => (
                        <div
                            key={wf._id}
                            onClick={() => onEdit(wf)}
                            className="group relative glass p-6 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentWorkflow(wf);
                                        setEditData({ name: wf.name, description: wf.description || '' });
                                        setShowEditModal(true);
                                    }}
                                    className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                                >
                                    <Edit3 size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(wf._id); }}
                                    className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                    <Zap size={24} className="fill-blue-400/20" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-200 mb-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight">{wf.name}</h3>
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{wf.description || 'Không có mô tả'}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <span className="flex items-center gap-1.5"><Layers size={13} /> {wf.nodes?.length || 0} Bước</span>
                                    <span className="flex items-center gap-1.5"><Calendar size={13} /> {new Date(wf.updated_at).toLocaleDateString('vi-VN')}</span>
                                </div>
                                <div className="h-px bg-white/5" />
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        Mở trình thiết kế <ChevronRight size={14} />
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modals */}
            {showCreateModal && (
                <Modal title="Tạo kịch bản mới" onClose={() => setShowCreateModal(false)}>
                    <div className="space-y-4">
                        <input
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-200"
                            placeholder="Tên kịch bản"
                            value={newWorkflowData.name}
                            onChange={e => setNewWorkflowData({ ...newWorkflowData, name: e.target.value })}
                        />
                        <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-200"
                            placeholder="Mô tả"
                            value={newWorkflowData.description}
                            onChange={e => setNewWorkflowData({ ...newWorkflowData, description: e.target.value })}
                        />
                        <button onClick={handleCreate} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold">Tạo ngay</button>
                    </div>
                </Modal>
            )}

            {showEditModal && (
                <Modal title="Chỉnh sửa thông tin" onClose={() => setShowEditModal(false)}>
                    <div className="space-y-4">
                        <input
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-200"
                            value={editData.name}
                            onChange={e => setEditData({ ...editData, name: e.target.value })}
                        />
                        <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-200"
                            value={editData.description}
                            onChange={e => setEditData({ ...editData, description: e.target.value })}
                        />
                        <button onClick={handleUpdateDetails} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold">Cập nhật</button>
                    </div>
                </Modal>
            )}

            {confirmDelete && (
                <ConfirmModal
                    title="Xoá kịch bản"
                    message="Bạn có chắc chắn muốn xoá quy trình này?"
                    onConfirm={confirmDeleteWorkflow}
                    onClose={() => setConfirmDelete(null)}
                />
            )}
        </div>
    );
}
