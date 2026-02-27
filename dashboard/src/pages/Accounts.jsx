import { useEffect, useState, useCallback } from 'react'
import {
    Plus, Search, Trash2, Edit3, ChevronLeft, ChevronRight,
    Upload, X, AlertCircle, Users, FolderOpen, Pencil, Check
} from 'lucide-react'
import { AccountsService } from '../services/apiService'
import Select from '../components/Select'
import { STATUS_MAP, GROUP_COLORS, inputCls } from '../lib/ui'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import GroupForm from '../components/GroupForm'
import ConfirmModal from '../components/MLX/ConfirmModal'
import { showToast } from '../components/Toast'



// ─── Account Form ─────────────────────────────────────────────────────────────
function AccountForm({ initial, groups, groupId, onSave, onClose }) {
    const [form, setForm] = useState(initial || {
        textnow_user: '', textnow_pass: '',
        hotmail_user: '', hotmail_pass: '',
        hotmail_token: '', hotmail_client_id: '',
        status: 'pending', group_id: groupId || '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const h = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

    const submit = async (e) => {
        e.preventDefault(); setLoading(true); setError('')
        try { await onSave(form); onClose() }
        catch (err) { setError(err.message) }
        finally { setLoading(false) }
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">TextNow User *</label>
                    <input required value={form.textnow_user} onChange={h('textnow_user')} className={inputCls} placeholder="username" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">TextNow Pass *</label>
                    <input required type="password" value={form.textnow_pass} onChange={h('textnow_pass')} className={inputCls} placeholder="••••••••" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Hotmail User</label>
                    <input value={form.hotmail_user} onChange={h('hotmail_user')} className={inputCls} placeholder="email@hotmail.com" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Hotmail Pass</label>
                    <input type="password" value={form.hotmail_pass} onChange={h('hotmail_pass')} className={inputCls} placeholder="••••••••" />
                </div>
                <div className="col-span-2">
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Hotmail Token</label>
                    <input value={form.hotmail_token} onChange={h('hotmail_token')} className={inputCls} placeholder="OAuth token" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Trạng thái</label>
                    <Select value={form.status} onChange={h('status')}>
                        <option value="pending">Chờ xử lý</option>
                        <option value="active">Hoạt động</option>
                        <option value="inactive">Không kích hoạt</option>
                        <option value="banned">Bị khoá</option>
                    </Select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Nhóm</label>
                    <Select value={form.group_id || ''} onChange={h('group_id')}>
                        <option value="">— Không có nhóm —</option>
                        {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                    </Select>
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                <button type="submit" disabled={loading} className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 disabled:opacity-60 transition-all">
                    {loading ? 'Đang lưu...' : 'Lưu tài khoản'}
                </button>
            </div>
        </form>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Accounts() {
    // Groups state
    const [groups, setGroups] = useState([])
    const [ungroupedCount, setUngroupedCount] = useState(0)
    const [selectedGroup, setSelectedGroup] = useState('__all__')
    const [showGroupForm, setShowGroupForm] = useState(false)
    const [editingGroup, setEditingGroup] = useState(null)
    // Modal: xóa nhóm
    const [deleteGroupTarget, setDeleteGroupTarget] = useState(null)
    const [deleteGroupMode, setDeleteGroupMode] = useState('ungroup') // 'ungroup' | 'delete'
    const [deleteGroupLoading, setDeleteGroupLoading] = useState(false)
    // Modal: xóa toàn bộ accounts trong nhóm
    const [clearMembersTarget, setClearMembersTarget] = useState(null)
    const [clearMembersLoading, setClearMembersLoading] = useState(false)
    // Modal: gán accounts chưa có nhóm
    const [showAssign, setShowAssign] = useState(false)
    const [assignForm, setAssignForm] = useState({ mode: 'existing', group_id: '', name: '', description: '', color: '#3b82f6', count: '' })
    const [assignLoading, setAssignLoading] = useState(false)

    // Accounts state
    const [accounts, setAccounts] = useState([])
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showAdd, setShowAdd] = useState(false)
    const [editing, setEditing] = useState(null)
    const [showImport, setShowImport] = useState(false)
    const [importText, setImportText] = useState('')
    const [importLoading, setImportLoading] = useState(false)
    const [deleteAccountTarget, setDeleteAccountTarget] = useState(null)
    const [stats, setStats] = useState([])
    const [showDeleteAll, setShowDeleteAll] = useState(false)

    // Load groups
    const loadGroups = useCallback(async () => {
        try {
            const res = await AccountsService.getGroups()
            setGroups(res.data || [])
            setUngroupedCount(res.ungrouped_count || 0)
        } catch { /* offline */ }
    }, [])

    const loadStats = useCallback(async () => {
        try {
            const params = {}
            if (selectedGroup === '__ungrouped__') params.group_id = 'null'
            else if (selectedGroup !== '__all__') params.group_id = selectedGroup

            const res = await AccountsService.getStats(params)
            setStats(res.data?.stats || [])
        } catch { /* offline */ }
    }, [selectedGroup])

    // Load accounts filtered by group
    const loadAccounts = useCallback(async (page = 1) => {
        setLoading(true)
        try {
            const params = { page, limit: 15, search: search || undefined, status: statusFilter || undefined }
            if (selectedGroup === '__ungrouped__') params.group_id = 'null'
            else if (selectedGroup !== '__all__') params.group_id = selectedGroup

            const res = await AccountsService.getAccounts(params)
            setAccounts(res.data)
            setPagination(res.pagination)
        } catch { /* offline */ } finally { setLoading(false) }
    }, [search, statusFilter, selectedGroup])

    useEffect(() => { loadGroups() }, [loadGroups])
    useEffect(() => { loadAccounts(1); loadStats() }, [loadAccounts, loadStats])

    // Group handlers
    const handleCreateGroup = async (data) => {
        await AccountsService.createGroup(data); loadGroups()
    }
    const handleUpdateGroup = async (data) => {
        await AccountsService.updateGroup(editingGroup._id, data); loadGroups()
    }

    // Xóa nhóm (có chọn cách xử lý accounts)
    const confirmDeleteGroup = async () => {
        if (!deleteGroupTarget) return
        setDeleteGroupLoading(true)
        try {
            await AccountsService.deleteGroup(deleteGroupTarget._id, deleteGroupMode === 'delete')
            if (selectedGroup === deleteGroupTarget._id) setSelectedGroup('__all__')
            showToast(`Đã xoá nhóm "${deleteGroupTarget.name}"`)
            setDeleteGroupTarget(null)
            loadGroups(); loadAccounts(1)
        } catch (e) { showToast(e.message, 'error') }
        finally { setDeleteGroupLoading(false) }
    }

    // Xóa toàn bộ accounts trong nhóm (giữ nhóm)
    const confirmClearMembers = async () => {
        if (!clearMembersTarget) return
        setClearMembersLoading(true)
        try {
            const res = await AccountsService.clearGroupMembers(clearMembersTarget._id)
            showToast(`✅ Đã xóa ${res.deleted} tài khoản trong nhóm “${clearMembersTarget.name}”`)
            setClearMembersTarget(null)
            loadGroups(); loadAccounts(1)
        } catch (e) { showToast(e.message, 'error') }
        finally { setClearMembersLoading(false) }
    }

    // Gán accounts chưa có nhóm vào nhóm
    const confirmAssign = async () => {
        setAssignLoading(true)
        try {
            let gid = assignForm.group_id
            if (assignForm.mode === 'new') {
                // Tạo nhóm mới trước
                const res = await AccountsService.createGroup({
                    name: assignForm.name, description: assignForm.description, color: assignForm.color
                })
                gid = res.data._id
            }
            if (!gid) { showToast('Vui lòng chọn hoặc tạo nhóm', 'warning'); return }
            const res = await AccountsService.assignToGroup({ group_id: gid, count: assignForm.count || undefined })
            showToast(`✅ Đã gán ${res.updated} tài khoản vào nhóm`)
            setShowAssign(false)
            setAssignForm({ mode: 'existing', group_id: '', name: '', description: '', color: '#3b82f6', count: '' })
            loadGroups(); loadAccounts(1)
        } catch (e) { showToast(e.message, 'error') }
        finally { setAssignLoading(false) }
    }

    // Account handlers
    const handleDelete = async (id) => {
        try {
            await AccountsService.deleteAccount(id)
            showToast('Đã xoá tài khoản')
            loadAccounts(pagination.page); loadStats()
        } catch (e) { showToast(e.message, 'error') }
        setDeleteAccountTarget(null)
    }

    const handleDeleteAll = async () => {
        try {
            const params = { search: search || undefined, status: statusFilter || undefined }
            if (selectedGroup === '__ungrouped__') params.group_id = 'null'
            else if (selectedGroup !== '__all__') params.group_id = selectedGroup

            const res = await AccountsService.deleteAccountsBulk(params)
            showToast(res.message)
            loadAccounts(1); loadGroups(); loadStats()
        } catch (e) { showToast(e.message, 'error') }
        setShowDeleteAll(false)
    }
    const handleCreate = async (data) => {
        await AccountsService.createAccount(data)
        loadAccounts(1); loadGroups()
    }
    const handleUpdate = async (data) => {
        await AccountsService.updateAccount(editing._id, data)
        loadAccounts(pagination.page); loadGroups()
    }
    const handleImport = async () => {
        if (!importText.trim()) return
        setImportLoading(true)
        try {
            const list = importText.trim().split('\n').filter(Boolean).map(line => {
                const [textnow_user, textnow_pass, hotmail_user, hotmail_pass] = line.split(':')
                return { textnow_user, textnow_pass, hotmail_user, hotmail_pass, status: 'pending' }
            })
            const gid = selectedGroup !== '__all__' && selectedGroup !== '__ungrouped__' ? selectedGroup : undefined
            const res = await AccountsService.importAccounts({ accounts: list, group_id: gid })
            showToast(`✅ Đã nhập ${res.inserted} tài khoản`)
            setShowImport(false); setImportText('')
            loadAccounts(1); loadGroups()
        } catch (e) { showToast(e.message, 'error') }
        finally { setImportLoading(false) }
    }

    // Current group info
    const currentGroup = groups.find(g => g._id === selectedGroup)
    const groupColor = currentGroup?.color || '#3b82f6'

    return (
        <div className="p-6 flex gap-5 h-full">

            {/* ── Modals ─────────────────────────────────────── */}
            {deleteAccountTarget && (
                <ConfirmModal
                    title="Xoá tài khoản"
                    description="Xoá vĩnh viễn tài khoản này? Thao tác không thể hoàn tác."
                    danger
                    onConfirm={() => handleDelete(deleteAccountTarget)}
                    onClose={() => setDeleteAccountTarget(null)}
                />
            )}
            {showDeleteAll && (
                <ConfirmModal
                    title="Xoá tất cả tài khoản"
                    description={`Bạn có chắc chắn muốn xoá toàn bộ ${pagination.total} tài khoản đang hiển thị theo bộ lọc hiện tại không? Hành động này không thể hoàn tác!`}
                    danger
                    onConfirm={handleDeleteAll}
                    onClose={() => setShowDeleteAll(false)}
                />
            )}
            {(showGroupForm || editingGroup) && (
                <Modal title={editingGroup ? 'Sửa nhóm' : 'Tạo nhóm mới'} onClose={() => { setShowGroupForm(false); setEditingGroup(null) }}>
                    <GroupForm initial={editingGroup} onSave={editingGroup ? handleUpdateGroup : handleCreateGroup}
                        onClose={() => { setShowGroupForm(false); setEditingGroup(null) }} />
                </Modal>
            )}

            {deleteGroupTarget && (
                <Modal title={`Xóa nhóm "${deleteGroupTarget.name}"`} onClose={() => setDeleteGroupTarget(null)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-400">
                            Nhóm có <span className="text-white font-medium">{deleteGroupTarget.account_count}</span> tài khoản. Chọn cách xử lý:
                        </p>
                        <div className="space-y-2">
                            {[
                                { v: 'ungroup', label: 'Giữ tài khoản, chuyển về "Chưa có nhóm"', sub: 'An toàn hơn' },
                                { v: 'delete', label: 'Xóa luôn toàn bộ tài khoản trong nhóm', sub: 'Không thể hoàn tác!' }
                            ].map(opt => (
                                <label key={opt.v} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                                    ${deleteGroupMode === opt.v
                                        ? opt.v === 'delete' ? 'border-red-500/40 bg-red-500/10' : 'border-blue-500/40 bg-blue-500/10'
                                        : 'border-white/10 hover:border-white/20'}`}>
                                    <input type="radio" value={opt.v} checked={deleteGroupMode === opt.v}
                                        onChange={e => setDeleteGroupMode(e.target.value)} className="mt-0.5 accent-blue-500" />
                                    <div>
                                        <p className={`text-sm font-medium ${opt.v === 'delete' && deleteGroupMode === 'delete' ? 'text-red-400' : 'text-slate-200'}`}>{opt.label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{opt.sub}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button onClick={() => setDeleteGroupTarget(null)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                            <button onClick={confirmDeleteGroup} disabled={deleteGroupLoading}
                                className={`px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-all ${deleteGroupMode === 'delete' ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                                {deleteGroupLoading ? 'Đang xóa...' : 'Xác nhận xóa'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {clearMembersTarget && (
                <Modal title={`Xóa tài khoản trong "${clearMembersTarget.name}"`} onClose={() => setClearMembersTarget(null)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-400">
                            Xóa toàn bộ <span className="text-white font-medium">{clearMembersTarget.account_count}</span> tài khoản trong nhóm?
                            Nhóm vẫn được giữ lại. Hành động không thể hoàn tác!
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setClearMembersTarget(null)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                            <button onClick={confirmClearMembers} disabled={clearMembersLoading}
                                className="px-5 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 transition-all">
                                {clearMembersLoading ? 'Đang xóa...' : `Xóa ${clearMembersTarget.account_count} tài khoản`}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {showAssign && (
                <Modal title="Phân nhóm tài khoản chưa có nhóm" onClose={() => setShowAssign(false)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-400">Hiện có <span className="text-white font-medium">{ungroupedCount}</span> tài khoản chưa có nhóm.</p>
                        <div className="flex gap-2">
                            {[{ v: 'existing', label: 'Vào nhóm có sẵn' }, { v: 'new', label: 'Tạo nhóm mới' }].map(opt => (
                                <button key={opt.v} onClick={() => setAssignForm(f => ({ ...f, mode: opt.v }))}
                                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all
                                        ${assignForm.mode === opt.v ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'}`}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {assignForm.mode === 'existing' ? (
                            <div>
                                <label className="text-xs text-slate-500 mb-1.5 block font-medium">Chọn nhóm</label>
                                <Select value={assignForm.group_id} onChange={e => setAssignForm(f => ({ ...f, group_id: e.target.value }))}>
                                    <option value="">— Chọn nhóm —</option>
                                    {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Tên nhóm mới *</label>
                                    <input value={assignForm.name} onChange={e => setAssignForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="VD: T1, Spam..." />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Mô tả</label>
                                    <input value={assignForm.description} onChange={e => setAssignForm(f => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Mô tả nhóm..." />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Màu nhóm</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {GROUP_COLORS.map(c => (
                                            <button key={c} type="button" onClick={() => setAssignForm(f => ({ ...f, color: c }))}
                                                className="w-6 h-6 rounded-full flex items-center justify-center ring-2 ring-offset-2 ring-offset-slate-900 transition-all"
                                                style={{ backgroundColor: c, ringColor: assignForm.color === c ? c : 'transparent' }}>
                                                {assignForm.color === c && <Check size={10} className="text-white" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="text-xs text-slate-500 mb-1.5 block font-medium">
                                Số lượng tài khoản <span className="text-slate-600">(bỏ trống = tất cả)</span>
                            </label>
                            <input type="number" value={assignForm.count} onChange={e => setAssignForm(f => ({ ...f, count: e.target.value }))}
                                className={inputCls} placeholder={`Tối đa ${ungroupedCount}`} min="1" max={ungroupedCount} />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button onClick={() => setShowAssign(false)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                            <button onClick={confirmAssign} disabled={assignLoading}
                                className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 transition-all">
                                {assignLoading ? 'Đang gán...' : 'Gán vào nhóm'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {showAdd && (
                <Modal title="Thêm tài khoản mới" onClose={() => setShowAdd(false)}>
                    <AccountForm groups={groups} groupId={selectedGroup !== '__all__' && selectedGroup !== '__ungrouped__' ? selectedGroup : ''} onSave={handleCreate} onClose={() => setShowAdd(false)} />
                </Modal>
            )}
            {editing && (
                <Modal title="Chỉnh sửa tài khoản" onClose={() => setEditing(null)}>
                    <AccountForm initial={editing} groups={groups} groupId={editing.group_id} onSave={handleUpdate} onClose={() => setEditing(null)} />
                </Modal>
            )}
            {showImport && (
                <Modal title="Nhập hàng loạt tài khoản" onClose={() => setShowImport(false)}>
                    <div className="space-y-3">
                        <p className="text-xs text-slate-500">
                            Mỗi dòng: <code className="text-blue-400">textnow_user:textnow_pass:hotmail_user:hotmail_pass</code>
                            {currentGroup && <span className="ml-2 text-emerald-400">→ sẽ vào nhóm "{currentGroup.name}"</span>}
                        </p>
                        <textarea rows={10} value={importText} onChange={e => setImportText(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 resize-none scrollbar-thin scrollbar-thumb-slate-700"
                            placeholder="user1:pass1:email1@hotmail.com:emailpass1&#10;user2:pass2:email2@hotmail.com:emailpass2" />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowImport(false)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                            <button onClick={handleImport} disabled={importLoading}
                                className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 transition-all">
                                {importLoading ? 'Đang nhập...' : 'Nhập tài khoản'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── SIDEBAR ──────────────────────────────────── */}
            <aside className="w-56 flex-shrink-0 flex flex-col gap-2 sticky top-6 h-fit">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nhóm</span>
                    <button onClick={() => setShowGroupForm(true)}
                        className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-all" title="Tạo nhóm mới">
                        <Plus size={14} />
                    </button>
                </div>

                <button onClick={() => setSelectedGroup('__all__')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${selectedGroup === '__all__' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                    <Users size={15} className="flex-shrink-0" />
                    <span className="flex-1 truncate">Tất cả</span>
                    <span className="text-xs text-slate-500 font-medium">{pagination.total}</span>
                </button>

                <div className={`group/ug relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer
                    ${selectedGroup === '__ungrouped__' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                    onClick={() => setSelectedGroup('__ungrouped__')}>
                    <FolderOpen size={15} className="flex-shrink-0 text-slate-500" />
                    <span className="flex-1 truncate">Chưa có nhóm</span>
                    <span className="text-xs text-slate-500 font-medium group-hover/ug:hidden">{ungroupedCount}</span>
                    {ungroupedCount > 0 && (
                        <button onClick={e => { e.stopPropagation(); setShowAssign(true) }}
                            className="hidden group-hover/ug:flex w-6 h-6 rounded-md hover:bg-blue-500/20 hover:text-blue-400 items-center justify-center transition-all absolute right-2"
                            title="Phân nhóm">
                            <Plus size={11} />
                        </button>
                    )}
                </div>

                {groups.length > 0 && <div className="border-t border-white/5 my-1" />}

                {groups.map(g => (
                    <div key={g._id} className={`group/item relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer
                        ${selectedGroup === g._id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                        onClick={() => setSelectedGroup(g._id)}>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="flex-1 truncate text-sm">{g.name}</span>
                        <span className="text-xs text-slate-500 font-medium group-hover/item:hidden">{g.account_count}</span>
                        <div className="hidden group-hover/item:flex items-center gap-0.5 absolute right-2">
                            <button onClick={e => { e.stopPropagation(); setEditingGroup(g) }}
                                className="w-6 h-6 rounded-md hover:bg-blue-500/20 hover:text-blue-400 flex items-center justify-center transition-all" title="Sửa nhóm">
                                <Pencil size={11} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); setClearMembersTarget(g) }}
                                className="w-6 h-6 rounded-md hover:bg-orange-500/20 hover:text-orange-400 flex items-center justify-center transition-all" title="Xóa toàn bộ tài khoản">
                                <Trash2 size={11} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); setDeleteGroupMode('ungroup'); setDeleteGroupTarget(g) }}
                                className="w-6 h-6 rounded-md hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-all" title="Xóa nhóm">
                                <X size={11} />
                            </button>
                        </div>
                    </div>
                ))}
            </aside>

            {/* ── MAIN CONTENT ─────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-5">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            {currentGroup && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: groupColor }} />}
                            <h2 className="text-2xl font-bold text-white">
                                {selectedGroup === '__all__' ? 'Tài khoản' : selectedGroup === '__ungrouped__' ? 'Chưa có nhóm' : currentGroup?.name || 'Tài khoản'}
                            </h2>
                        </div>
                        {currentGroup?.description && <p className="text-xs text-slate-500 mt-0.5">{currentGroup.description}</p>}
                        <p className="text-sm text-slate-500 mt-0.5">Tổng: <span className="text-slate-300 font-medium">{pagination.total}</span> tài khoản</p>
                    </div>
                    <div className="flex gap-2">
                        {pagination.total > 0 && (
                            <button onClick={() => setShowDeleteAll(true)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/10 transition-all">
                                <Trash2 size={14} /> Xoá tất cả
                            </button>
                        )}
                        <button onClick={() => setShowImport(true)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                            <Upload size={14} /> Nhập file
                        </button>
                        <button onClick={() => setShowAdd(true)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all">
                            <Plus size={14} /> Thêm tài khoản
                        </button>
                    </div>
                </div>

                {/* Status Stats Summary */}
                {stats.length > 0 && (
                    <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                        {stats.map(s => {
                            const config = STATUS_MAP[s._id] || { label: s._id, color: 'text-slate-400 bg-slate-500/10' }
                            return (
                                <div key={s._id} className={`px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2 bg-white/3`}>
                                    <span className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: config.color.split(' ')[0].replace('text-', '') }} />
                                    <span className="text-xs font-medium text-slate-300">{config.label}:</span>
                                    <span className="text-xs font-bold text-white">{s.count}</span>
                                </div>
                            )
                        })}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm tài khoản..."
                            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 transition-all" />
                    </div>
                    <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="min-w-[160px]">
                        <option value="">Tất cả trạng thái</option>
                        <option value="active">Hoạt động</option>
                        <option value="inactive">Không kích hoạt</option>
                        <option value="banned">Bị khoá</option>
                        <option value="pending">Chờ xử lý</option>
                    </Select>
                </div>

                <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    {['TextNow User', 'Hotmail', 'Nhóm', 'Trạng thái', 'Ngày tạo', 'Thao tác'].map(h => (
                                        <th key={h} className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wider px-4 py-3.5">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array(6).fill(0).map((_, i) => (
                                        <tr key={i} className="border-b border-white/3">
                                            {Array(6).fill(0).map((_, j) => (
                                                <td key={j} className="px-4 py-4"><div className="h-4 bg-white/5 rounded animate-pulse w-3/4" /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : accounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center text-slate-500 py-16 text-sm">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                                    <AlertCircle size={20} className="text-slate-600" />
                                                </div>
                                                Không có tài khoản nào
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    accounts.map(acc => {
                                        const grp = groups.find(g => g._id === acc.group_id)
                                        return (
                                            <tr key={acc._id} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                                                <td className="px-4 py-3.5 font-medium text-slate-200">{acc.textnow_user}</td>
                                                <td className="px-4 py-3.5 text-slate-400 text-xs">{acc.hotmail_user || <span className="text-slate-600">Chưa liên kết</span>}</td>
                                                <td className="px-4 py-3.5">
                                                    {grp
                                                        ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
                                                            style={{ color: grp.color, backgroundColor: grp.color + '18', borderColor: grp.color + '40' }}>
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: grp.color }} />{grp.name}
                                                        </span>
                                                        : <span className="text-slate-600 text-xs">—</span>}
                                                </td>
                                                <td className="px-4 py-3.5"><StatusBadge status={acc.status} /></td>
                                                <td className="px-4 py-3.5 text-slate-500 text-xs">{new Date(acc.created_at).toLocaleDateString('vi-VN')}</td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => setEditing(acc)}
                                                            className="w-8 h-8 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 text-slate-500 flex items-center justify-center transition-all">
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button onClick={() => setDeleteAccountTarget(acc._id)}
                                                            className="w-8 h-8 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-slate-500 flex items-center justify-center transition-all">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                            <p className="text-xs text-slate-500">Trang {pagination.page} / {pagination.totalPages}</p>
                            <div className="flex gap-1">
                                <button disabled={pagination.page <= 1} onClick={() => loadAccounts(pagination.page - 1)}
                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-slate-400 transition-all">
                                    <ChevronLeft size={15} />
                                </button>
                                <button disabled={pagination.page >= pagination.totalPages} onClick={() => loadAccounts(pagination.page + 1)}
                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-slate-400 transition-all">
                                    <ChevronRight size={15} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
