import { useEffect, useState, useCallback } from 'react'
import { Folder, RefreshCw, Trash2, X, Edit3, Plus } from 'lucide-react'
import { MLXService } from '../../services/apiService'
import Modal from '../Modal'
import ConfirmModal from './ConfirmModal'
import { inputCls } from '../../lib/ui'

export default function GroupsTab() {
    const [folders, setFolders] = useState([])
    const [loading, setLoading] = useState(true)
    const [editTarget, setEditTarget] = useState(null)
    const [cleanupTarget, setCleanupTarget] = useState(null)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [createModal, setCreateModal] = useState(false)
    const [createForm, setCreateForm] = useState({ name: '', comment: '' })
    const [createLoading, setCreateLoading] = useState(false)
    const [editForm, setEditForm] = useState({ name: '', comment: '' })
    const [editLoading, setEditLoading] = useState(false)
    const [toast, setToast] = useState(null)

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const fetchFolders = useCallback(async () => {
        setLoading(true)
        try {
            const res = await MLXService.getFolders()
            setFolders(res.data || [])
        } catch { /* offline */ } finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchFolders() }, [fetchFolders])

    const openEdit = (folder) => {
        setEditTarget(folder)
        setEditForm({ name: folder.name, comment: folder.comment || '' })
    }

    const saveEdit = async () => {
        if (!editForm.name.trim()) return
        setEditLoading(true)
        try {
            await MLXService.updateFolder({
                ...editTarget,
                name: editForm.name.trim(),
                comment: editForm.comment,
            })
            showToast('Đã cập nhật folder')
            setEditTarget(null)
            fetchFolders()
        } catch (e) {
            showToast(e.message, 'error')
        } finally { setEditLoading(false) }
    }

    const doDelete = async () => {
        await MLXService.deleteFolder([deleteTarget.folder_id])
        showToast(`Đã xoá folder "${deleteTarget.name}"`)
        setDeleteTarget(null)
        fetchFolders()
    }

    const doCreate = async () => {
        if (!createForm.name.trim()) return
        setCreateLoading(true)
        try {
            await MLXService.createFolder({ name: createForm.name.trim(), comment: createForm.comment })
            showToast(`Đã tạo folder "${createForm.name.trim()}"`)
            setCreateModal(false)
            setCreateForm({ name: '', comment: '' })
            fetchFolders()
        } catch (e) {
            showToast(e.message, 'error')
        } finally { setCreateLoading(false) }
    }

    const doCleanup = async () => {
        await MLXService.cleanupFolder(cleanupTarget.folder_id)
        showToast(`Đang xoá profiles trong "${cleanupTarget.name}"...`)
        setCleanupTarget(null)
    }

    return (
        <div className="space-y-4">
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all
          ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {toast.msg}
                </div>
            )}

            {createModal && (
                <Modal title="Tạo Group mới" onClose={() => { setCreateModal(false); setCreateForm({ name: '', comment: '' }) }}>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Tên Group *</label>
                            <input
                                autoFocus
                                value={createForm.name}
                                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && doCreate()}
                                className={inputCls}
                                placeholder="VD: Textnow, Remini..."
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Ghi chú</label>
                            <textarea
                                rows={2}
                                value={createForm.comment}
                                onChange={e => setCreateForm(f => ({ ...f, comment: e.target.value }))}
                                className={`${inputCls} resize-none`}
                                placeholder="Mô tả mục đích của group..."
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setCreateModal(false); setCreateForm({ name: '', comment: '' }) }}
                                className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                            <button onClick={doCreate} disabled={createLoading || !createForm.name.trim()}
                                className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 disabled:opacity-60 transition-all">
                                {createLoading ? 'Đang tạo...' : 'Tạo Group'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {editTarget && (
                <Modal title="Chỉnh sửa Group" onClose={() => setEditTarget(null)}>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Tên Group *</label>
                            <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                className={inputCls} placeholder="Tên folder" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Ghi chú</label>
                            <textarea rows={3} value={editForm.comment}
                                onChange={e => setEditForm(f => ({ ...f, comment: e.target.value }))}
                                className={`${inputCls} resize-none scrollbar-thin scrollbar-thumb-slate-700`}
                                placeholder="Ghi chú cho folder này..." />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditTarget(null)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                            <button onClick={saveEdit} disabled={editLoading}
                                className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 transition-all">
                                {editLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteTarget && (
                <ConfirmModal
                    title="Xoá Folder"
                    description={`Xoá folder "${deleteTarget.name}"? Tất cả profiles bên trong sẽ bị mất. Không thể hoàn tác!`}
                    danger
                    onConfirm={doDelete}
                    onClose={() => setDeleteTarget(null)}
                />
            )}

            {cleanupTarget && (
                <ConfirmModal
                    title="Xoá toàn bộ Profiles"
                    description={`Thao tác này sẽ XOÁ VĨNH VIỄN tất cả profiles trong group "${cleanupTarget.name}" (${cleanupTarget.profiles_count} profiles). Không thể hoàn tác!`}
                    danger
                    onConfirm={doCleanup}
                    onClose={() => setCleanupTarget(null)}
                />
            )}

            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                    Tổng: <span className="text-slate-300 font-medium">{folders.length}</span> groups
                </p>
                <div className="flex gap-2">
                    <button onClick={() => setCreateModal(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all">
                        <Plus size={13} />
                        Tạo Group
                    </button>
                    <button onClick={fetchFolders} disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Làm mới
                    </button>
                </div>
            </div>

            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                {['Tên Group', 'Ghi chú', 'Số Profiles', 'Thao tác'].map(h => (
                                    <th key={h} className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wider px-4 py-3.5">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array(4).fill(0).map((_, i) => (
                                    <tr key={i} className="border-b border-white/3">
                                        {Array(4).fill(0).map((_, j) => (
                                            <td key={j} className="px-4 py-4"><div className="h-4 bg-white/5 rounded animate-pulse w-3/4" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : folders.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center text-slate-500 py-12 text-sm">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                                <Folder size={20} className="text-slate-600" />
                                            </div>
                                            Không có group nào
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                folders.map(folder => (
                                    <tr key={folder.folder_id} className="border-b border-white/3 hover:bg-white/3 transition-colors group">
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <Folder size={15} className="text-blue-400 flex-shrink-0" />
                                                <span className="font-medium text-slate-200">{folder.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-400 text-xs max-w-xs truncate">
                                            {folder.comment || <span className="text-slate-600">—</span>}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                                {folder.profiles_count ?? 0} profiles
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => openEdit(folder)}
                                                    className="w-8 h-8 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 text-slate-500 flex items-center justify-center transition-all">
                                                    <Edit3 size={14} />
                                                </button>
                                                <button onClick={() => setCleanupTarget(folder)}
                                                    className="w-8 h-8 rounded-lg hover:bg-orange-500/20 hover:text-orange-400 text-slate-500 flex items-center justify-center transition-all"
                                                    title="Xoá toàn bộ profiles trong group">
                                                    <Trash2 size={14} />
                                                </button>
                                                <button onClick={() => setDeleteTarget(folder)}
                                                    className="w-8 h-8 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-slate-500 flex items-center justify-center transition-all"
                                                    title="Xoá folder">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
