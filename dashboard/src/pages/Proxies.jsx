import { useEffect, useState, useCallback } from 'react'
import {
    Plus, Search, Trash2, Edit3, ChevronLeft, ChevronRight,
    AlertCircle, Upload, X, Globe, FolderOpen, Users, Pencil, Check,
} from 'lucide-react'
import { ProxiesService } from '../services/apiService'
import Select from '../components/Select'
import { STATUS_MAP, GROUP_COLORS, inputCls } from '../lib/ui'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import GroupForm from '../components/GroupForm'

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_MAP = {
    http: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    https: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    socks4: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    socks5: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}



// ─── Proxy Form ───────────────────────────────────────────────────────────────
function ProxyForm({ initial, groups, groupId, onSave, onClose }) {
    const [form, setForm] = useState(initial || {
        type: 'http', host: '', port: '', username: '', password: '', status: 'active', group_id: groupId || '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const h = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

    const submit = async (e) => {
        e.preventDefault(); setLoading(true); setError('')
        try { await onSave({ ...form, port: Number(form.port) }); onClose() }
        catch (err) { setError(err.message) }
        finally { setLoading(false) }
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Loại *</label>
                    <Select value={form.type} onChange={h('type')}>
                        <option value="http">HTTP</option>
                        <option value="https">HTTPS</option>
                        <option value="socks4">SOCKS4</option>
                        <option value="socks5">SOCKS5</option>
                    </Select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Trạng thái</label>
                    <Select value={form.status} onChange={h('status')}>
                        <option value="active">Hoạt động</option>
                        <option value="inactive">Không kích hoạt</option>
                        <option value="dead">Đã chết</option>
                    </Select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Host *</label>
                    <input required value={form.host} onChange={h('host')} className={inputCls} placeholder="192.168.1.1" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Port *</label>
                    <input required type="number" value={form.port} onChange={h('port')} className={inputCls} placeholder="8080" min="1" max="65535" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Username</label>
                    <input value={form.username} onChange={h('username')} className={inputCls} placeholder="user" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Password</label>
                    <input type="password" value={form.password} onChange={h('password')} className={inputCls} placeholder="••••••••" />
                </div>
                <div className="col-span-2">
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
                    {loading ? 'Đang lưu...' : 'Lưu proxy'}
                </button>
            </div>
        </form>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Proxies() {
    // Groups
    const [groups, setGroups] = useState([])
    const [ungroupedCount, setUngroupedCount] = useState(0)
    const [selectedGroup, setSelectedGroup] = useState('__all__')
    const [showGroupForm, setShowGroupForm] = useState(false)
    const [editingGroup, setEditingGroup] = useState(null)

    // Proxies
    const [proxies, setProxies] = useState([])
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [showAdd, setShowAdd] = useState(false)
    const [editing, setEditing] = useState(null)
    const [showImport, setShowImport] = useState(false)
    const [importText, setImportText] = useState('')
    const [importLoading, setImportLoading] = useState(false)
    const [showAssign, setShowAssign] = useState(false)
    const [assignTargetGroup, setAssignTargetGroup] = useState('')
    const [assignCount, setAssignCount] = useState(1)
    const [assignLoading, setAssignLoading] = useState(false)

    const loadGroups = useCallback(async () => {
        try {
            const res = await ProxiesService.getGroups()
            setGroups(res.data || [])
            setUngroupedCount(res.ungrouped_count || 0)
        } catch { /* offline */ }
    }, [])

    const load = useCallback(async (page = 1) => {
        setLoading(true)
        try {
            const params = { page, limit: 15, search: search || undefined, status: statusFilter || undefined, type: typeFilter || undefined }
            if (selectedGroup === '__ungrouped__') params.group_id = 'null'
            else if (selectedGroup !== '__all__') params.group_id = selectedGroup
            const res = await ProxiesService.getProxies(params)
            setProxies(res.data); setPagination(res.pagination)
        } catch { /* offline */ } finally { setLoading(false) }
    }, [search, statusFilter, typeFilter, selectedGroup])

    useEffect(() => { loadGroups() }, [loadGroups])
    useEffect(() => { load(1) }, [load])

    // Group handlers
    const handleCreateGroup = async (data) => { await ProxiesService.createGroup(data); loadGroups() }
    const handleUpdateGroup = async (data) => { await ProxiesService.updateGroup(editingGroup._id, data); loadGroups() }
    const handleDeleteGroup = async (g) => {
        if (!confirm(`Xoá nhóm "${g.name}"? Proxy trong nhóm sẽ chuyển về "Không có nhóm".`)) return
        await ProxiesService.deleteGroup(g._id)
        if (selectedGroup === g._id) setSelectedGroup('__all__')
        loadGroups()
    }

    // Proxy handlers
    const handleDelete = async (id) => {
        if (!confirm('Xoá proxy này?')) return
        await ProxiesService.deleteProxy(id); load(pagination.page)
    }
    const handleCreate = async (data) => { await ProxiesService.createProxy(data); load(1); loadGroups() }
    const handleUpdate = async (data) => { await ProxiesService.updateProxy(editing._id, data); load(pagination.page); loadGroups() }
    const handleImport = async () => {
        if (!importText.trim()) return
        setImportLoading(true)
        try {
            const gid = selectedGroup !== '__all__' && selectedGroup !== '__ungrouped__' ? selectedGroup : undefined
            const res = await ProxiesService.importProxies({ raw: importText, group_id: gid })
            alert(`✅ Đã nhập ${res.inserted} proxy`)
            setShowImport(false); setImportText(''); load(1); loadGroups()
        } catch (e) { alert('Lỗi: ' + e.message) }
        finally { setImportLoading(false) }
    }

    const confirmAssign = async () => {
        if (!assignTargetGroup) return alert('Chưa chọn nhóm đích.')
        if (assignCount < 1 || assignCount > ungroupedCount) return alert('Số lượng không hợp lệ.')
        setAssignLoading(true)
        try {
            await ProxiesService.assignToGroup({
                targetGroupId: assignTargetGroup === 'new' ? undefined : assignTargetGroup,
                count: assignCount,
            })
            setShowAssign(false)
            setAssignTargetGroup('')
            setAssignCount(1)
            load(pagination.page); loadGroups()
        } catch (e) { alert('Lỗi: ' + e.message) }
        finally { setAssignLoading(false) }
    }

    const currentGroup = groups.find(g => g._id === selectedGroup)

    return (
        <div className="flex gap-5 h-full">
            {/* Modals */}
            {(showGroupForm || editingGroup) && (
                <Modal title={editingGroup ? 'Sửa nhóm' : 'Tạo nhóm mới'} onClose={() => { setShowGroupForm(false); setEditingGroup(null) }}>
                    <GroupForm initial={editingGroup} onSave={editingGroup ? handleUpdateGroup : handleCreateGroup}
                        onClose={() => { setShowGroupForm(false); setEditingGroup(null) }} />
                </Modal>
            )}
            {showAdd && (
                <Modal title="Thêm proxy mới" onClose={() => setShowAdd(false)}>
                    <ProxyForm groups={groups} groupId={selectedGroup !== '__all__' && selectedGroup !== '__ungrouped__' ? selectedGroup : ''} onSave={handleCreate} onClose={() => setShowAdd(false)} />
                </Modal>
            )}
            {editing && (
                <Modal title="Chỉnh sửa proxy" onClose={() => setEditing(null)}>
                    <ProxyForm initial={editing} groups={groups} groupId={editing.group_id} onSave={handleUpdate} onClose={() => setEditing(null)} />
                </Modal>
            )}
            {showImport && (
                <Modal title="Nhập hàng loạt proxy" onClose={() => setShowImport(false)}>
                    <div className="space-y-3">
                        <p className="text-xs text-slate-500">
                            Mỗi dòng: <code className="text-blue-400">host:port:username:password</code>
                            {currentGroup && <span className="ml-2 text-emerald-400">→ sẽ vào nhóm "{currentGroup.name}"</span>}
                        </p>
                        <textarea rows={10} value={importText} onChange={e => setImportText(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 resize-none scrollbar-thin scrollbar-thumb-slate-700"
                            placeholder="192.168.1.1:8080:user:pass&#10;10.0.0.1:3128" />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowImport(false)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                            <button onClick={handleImport} disabled={importLoading} className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 transition-all">
                                {importLoading ? 'Đang nhập...' : 'Nhập proxy'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {showAssign && (
                <Modal title="Phân nhóm Proxy" onClose={() => setShowAssign(false)}>
                    <div className="space-y-4">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-3">
                            <AlertCircle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <h4 className="text-sm font-medium text-slate-200">Đang chọn từ danh sách "Chưa có nhóm"</h4>
                                <p className="text-xs text-blue-300 mt-0.5">Bạn có {ungroupedCount} proxy đang chờ phân nhóm.</p>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Bạn muốn chuyển đến nhóm nào?</label>
                            <Select value={assignTargetGroup} onChange={e => setAssignTargetGroup(e.target.value)}>
                                <option value="" disabled>-- Chọn nhóm đích --</option>
                                <option value="new" className="text-blue-400 font-medium">+ Tạo nhóm mới cho các proxy này</option>
                                {groups.map(g => (
                                    <option key={g._id} value={g._id}>{g.name} ({g.proxy_count} proxy)</option>
                                ))}
                            </Select>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Số lượng Proxy muốn chuyển</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="1"
                                    max={ungroupedCount}
                                    value={assignCount}
                                    onChange={e => setAssignCount(Number(e.target.value))}
                                    className={`${inputCls} w-24 text-center font-medium`}
                                />
                                <span className="text-sm text-slate-500">
                                    / {ungroupedCount} proxy
                                </span>
                            </div>
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

            {/* ── SIDEBAR ──────────────────────────────────── */}
            <aside className="w-56 flex-shrink-0 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nhóm</span>
                    <button onClick={() => setShowGroupForm(true)}
                        className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-all"
                        title="Tạo nhóm mới">
                        <Plus size={14} />
                    </button>
                </div>

                <button onClick={() => setSelectedGroup('__all__')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${selectedGroup === '__all__' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                    <Globe size={15} className="flex-shrink-0" />
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
                    <div key={g._id}
                        className={`group/item relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer
                        ${selectedGroup === g._id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                        onClick={() => setSelectedGroup(g._id)}>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="flex-1 truncate">{g.name}</span>
                        <span className="text-xs text-slate-500 font-medium group-hover/item:hidden">{g.proxy_count}</span>
                        <div className="hidden group-hover/item:flex items-center gap-0.5 absolute right-2">
                            <button onClick={e => { e.stopPropagation(); setEditingGroup(g) }}
                                className="w-6 h-6 rounded-md hover:bg-blue-500/20 hover:text-blue-400 flex items-center justify-center transition-all" title="Sửa nhóm">
                                <Pencil size={11} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteGroup(g) }}
                                className="w-6 h-6 rounded-md hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-all" title="Xoá nhóm">
                                <X size={11} />
                            </button>
                        </div>
                    </div>
                ))}
            </aside>

            {/* ── MAIN CONTENT ─────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            {currentGroup && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: currentGroup.color }} />}
                            <h2 className="text-2xl font-bold text-white">
                                {selectedGroup === '__all__' ? 'Proxy' :
                                    selectedGroup === '__ungrouped__' ? 'Chưa có nhóm' :
                                        currentGroup?.name || 'Proxy'}
                            </h2>
                        </div>
                        {currentGroup?.description && <p className="text-xs text-slate-500 mt-0.5">{currentGroup.description}</p>}
                        <p className="text-sm text-slate-500 mt-0.5">Tổng: <span className="text-slate-300 font-medium">{pagination.total}</span> proxy</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowImport(true)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                            <Upload size={14} /> Nhập file
                        </button>
                        <button onClick={() => setShowAdd(true)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all">
                            <Plus size={14} /> Thêm proxy
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm host, username..."
                            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 transition-all" />
                    </div>
                    <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="min-w-[130px]">
                        <option value="">Tất cả loại</option>
                        <option value="http">HTTP</option>
                        <option value="https">HTTPS</option>
                        <option value="socks4">SOCKS4</option>
                        <option value="socks5">SOCKS5</option>
                    </Select>
                    <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="min-w-[160px]">
                        <option value="">Tất cả trạng thái</option>
                        <option value="active">Hoạt động</option>
                        <option value="inactive">Không kích hoạt</option>
                        <option value="dead">Đã chết</option>
                    </Select>
                </div>

                {/* Table */}
                <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    {['Loại', 'Host', 'Port', 'Username', 'Nhóm', 'Trạng thái', 'Ngày tạo', 'Thao tác'].map(h => (
                                        <th key={h} className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wider px-4 py-3.5">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array(6).fill(0).map((_, i) => (
                                        <tr key={i} className="border-b border-white/3">
                                            {Array(8).fill(0).map((_, j) => (
                                                <td key={j} className="px-4 py-4"><div className="h-4 bg-white/5 rounded animate-pulse w-3/4" /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : proxies.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center text-slate-500 py-16 text-sm">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                                    <Globe size={20} className="text-slate-600" />
                                                </div>
                                                Không có proxy nào
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    proxies.map(prx => {
                                        const grp = groups.find(g => g._id === prx.group_id)
                                        return (
                                            <tr key={prx._id} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                                                <td className="px-4 py-3.5">
                                                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold border uppercase ${TYPE_MAP[prx.type] || ''}`}>{prx.type}</span>
                                                </td>
                                                <td className="px-4 py-3.5 font-mono text-slate-200 text-xs">{prx.host}</td>
                                                <td className="px-4 py-3.5 font-mono text-slate-400 text-xs">{prx.port}</td>
                                                <td className="px-4 py-3.5 text-slate-400 text-xs">{prx.username || <span className="text-slate-600">—</span>}</td>
                                                <td className="px-4 py-3.5">
                                                    {grp
                                                        ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
                                                            style={{ color: grp.color, backgroundColor: grp.color + '18', borderColor: grp.color + '40' }}>
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: grp.color }} />{grp.name}
                                                        </span>
                                                        : <span className="text-slate-600 text-xs">—</span>}
                                                </td>
                                                <td className="px-4 py-3.5"><StatusBadge status={prx.status} /></td>
                                                <td className="px-4 py-3.5 text-slate-500 text-xs">{new Date(prx.created_at).toLocaleDateString('vi-VN')}</td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => setEditing(prx)}
                                                            className="w-8 h-8 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 text-slate-500 flex items-center justify-center transition-all">
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button onClick={() => handleDelete(prx._id)}
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
                                <button disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}
                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-slate-400 transition-all">
                                    <ChevronLeft size={15} />
                                </button>
                                <button disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}
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
