import { useState } from 'react'
import { useProxies } from './hooks/useProxies'
import ProxyForm from './components/ProxyForm'
import ImportModal from './components/ImportModal'
import GroupsSidebar from '../Accounts/components/GroupsSidebar'  // reuse same component
import Modal from '../../components/Modal'
import ConfirmModal from '../../components/MLX/ConfirmModal'
import GroupForm from '../../components/GroupForm'
import AssignModal from '../Accounts/components/AssignModal'
import {
    Search, Plus, Upload, Trash2, Edit3, Globe,
    ChevronLeft, ChevronRight
} from 'lucide-react'
import Select from '../../components/Select'
import StatusBadge from '../../components/StatusBadge'

const TYPE_MAP = {
    http: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    https: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    socks4: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    socks5: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

export default function Proxies() {
    const [selectedGroup, setSelectedGroup] = useState('__all__')
    const hook = useProxies({ selectedGroup })

    // UI states
    const [showAdd, setShowAdd] = useState(false)
    const [editing, setEditing] = useState(null)
    const [showImport, setShowImport] = useState(false)
    const [showDeleteAll, setShowDeleteAll] = useState(false)
    const [deleteProxyTarget, setDeleteProxyTarget] = useState(null)
    const [deleteGroupTarget, setDeleteGroupTarget] = useState(null)
    const [showGroupForm, setShowGroupForm] = useState(false)
    const [editingGroup, setEditingGroup] = useState(null)
    const [showAssign, setShowAssign] = useState(false)

    const handleImport = async ({ text, type, status }) => {
        const gid = selectedGroup !== '__all__' && selectedGroup !== '__ungrouped__' ? selectedGroup : undefined
        return await hook.importProxies({ text, type, status, groupId: gid })
    }

    return (
        <div className="p-6 flex gap-5 h-full">

            {/* ── Modals ───────────────────────────────────────── */}
            {(showGroupForm || editingGroup) && (
                <Modal title={editingGroup ? 'Sửa nhóm' : 'Tạo nhóm mới'} onClose={() => { setShowGroupForm(false); setEditingGroup(null) }}>
                    <GroupForm
                        initial={editingGroup}
                        onSave={editingGroup ? (d) => hook.updateGroup(editingGroup._id, d) : hook.createGroup}
                        onClose={() => { setShowGroupForm(false); setEditingGroup(null) }}
                    />
                </Modal>
            )}
            {showAdd && (
                <Modal title="Thêm proxy mới" onClose={() => setShowAdd(false)}>
                    <ProxyForm groups={hook.groups} groupId={selectedGroup !== '__all__' && selectedGroup !== '__ungrouped__' ? selectedGroup : ''} onSave={hook.createProxy} onClose={() => setShowAdd(false)} />
                </Modal>
            )}
            {editing && (
                <Modal title="Chỉnh sửa proxy" onClose={() => setEditing(null)}>
                    <ProxyForm initial={editing} groups={hook.groups} groupId={editing.group_id} onSave={(d) => hook.updateProxy(editing._id, d)} onClose={() => setEditing(null)} />
                </Modal>
            )}
            <ImportModal show={showImport} onClose={() => setShowImport(false)} onImport={handleImport} currentGroup={hook.currentGroup} />

            {deleteGroupTarget && (
                <ConfirmModal
                    title={`Xoá nhóm "${deleteGroupTarget.name}"`}
                    description="Proxy trong nhóm sẽ chuyển về 'Chưa có nhóm'. Hành động không thể hoàn tác!"
                    danger
                    onConfirm={() => { hook.deleteGroup(deleteGroupTarget._id); if (selectedGroup === deleteGroupTarget._id) setSelectedGroup('__all__'); setDeleteGroupTarget(null) }}
                    onClose={() => setDeleteGroupTarget(null)}
                />
            )}
            {deleteProxyTarget && (
                <ConfirmModal
                    title="Xoá Proxy"
                    description="Xóa proxy này khỏi hệ thống? Hành động không thể hoàn tác!"
                    danger
                    onConfirm={() => { hook.deleteProxy(deleteProxyTarget); setDeleteProxyTarget(null) }}
                    onClose={() => setDeleteProxyTarget(null)}
                />
            )}
            {showDeleteAll && (
                <ConfirmModal
                    title="Xoá tất cả Proxy"
                    description={`Bạn có chắc chắn muốn xoá toàn bộ ${hook.pagination.total} proxy đang hiển thị?`}
                    danger
                    onConfirm={() => { hook.deleteAll(); setShowDeleteAll(false) }}
                    onClose={() => setShowDeleteAll(false)}
                />
            )}
            <AssignModal
                show={showAssign}
                onClose={() => setShowAssign(false)}
                ungroupedCount={hook.ungroupedCount}
                groups={hook.groups}
                onConfirm={hook.assignUngrouped}
            />

            {/* ── Layout ────────────────────────────────────────── */}
            {/* Reuse GroupsSidebar (icon prop differs) */}
            <aside className="w-56 flex-shrink-0 flex flex-col gap-2 sticky top-6 h-fit">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nhóm</span>
                    <button onClick={() => setShowGroupForm(true)}
                        className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-all">
                        <Plus size={14} />
                    </button>
                </div>
                <button onClick={() => setSelectedGroup('__all__')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${selectedGroup === '__all__' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                    <Globe size={15} className="flex-shrink-0" />
                    <span className="flex-1 truncate">Tất cả</span>
                    <span className="text-xs text-slate-500 font-medium">{hook.pagination.total}</span>
                </button>
                <div className={`group/ug relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer
                    ${selectedGroup === '__ungrouped__' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                    onClick={() => setSelectedGroup('__ungrouped__')}>
                    <Globe size={15} className="flex-shrink-0 text-slate-500" />
                    <span className="flex-1 truncate">Chưa có nhóm</span>
                    <span className="text-xs text-slate-500 font-medium group-hover/ug:hidden">{hook.ungroupedCount}</span>
                    {hook.ungroupedCount > 0 && (
                        <button onClick={e => { e.stopPropagation(); setShowAssign(true) }}
                            className="hidden group-hover/ug:flex w-6 h-6 rounded-md hover:bg-blue-500/20 hover:text-blue-400 items-center justify-center transition-all absolute right-2">
                            <Plus size={11} />
                        </button>
                    )}
                </div>
                {hook.groups.length > 0 && <div className="border-t border-white/5 my-1" />}
                {hook.groups.map(g => (
                    <div key={g._id}
                        className={`group/item relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer
                        ${selectedGroup === g._id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                        onClick={() => setSelectedGroup(g._id)}>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="flex-1 truncate">{g.name}</span>
                        <span className="text-xs text-slate-500 font-medium group-hover/item:hidden">{g.proxy_count}</span>
                        <div className="hidden group-hover/item:flex items-center gap-0.5 absolute right-2">
                            <button onClick={e => { e.stopPropagation(); setEditingGroup(g) }}
                                className="w-6 h-6 rounded-md hover:bg-blue-500/20 hover:text-blue-400 flex items-center justify-center transition-all">
                                <Edit3 size={11} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); setDeleteGroupTarget(g) }}
                                className="w-6 h-6 rounded-md hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-all">
                                <Trash2 size={11} />
                            </button>
                        </div>
                    </div>
                ))}
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-5">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            {hook.currentGroup && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: hook.currentGroup.color }} />}
                            <h2 className="text-2xl font-bold text-white">
                                {selectedGroup === '__all__' ? 'Proxy' : selectedGroup === '__ungrouped__' ? 'Chưa có nhóm' : hook.currentGroup?.name || 'Proxy'}
                            </h2>
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">Tổng: <span className="text-slate-300 font-medium">{hook.pagination.total}</span> proxy</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                            <Upload size={14} /> Nhập file
                        </button>
                        {hook.pagination.total > 0 && (
                            <button onClick={() => setShowDeleteAll(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/10 transition-all">
                                <Trash2 size={14} /> Xoá tất cả
                            </button>
                        )}
                        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all">
                            <Plus size={14} /> Thêm proxy
                        </button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input value={hook.search} onChange={e => hook.setSearch(e.target.value)} placeholder="Tìm kiếm host, username..."
                            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 transition-all" />
                    </div>
                    <Select value={hook.typeFilter} onChange={e => hook.setTypeFilter(e.target.value)}>
                        <option value="">Tất cả loại</option>
                        <option value="http">HTTP</option>
                        <option value="https">HTTPS</option>
                        <option value="socks4">SOCKS4</option>
                        <option value="socks5">SOCKS5</option>
                    </Select>
                    <Select value={hook.statusFilter} onChange={e => hook.setStatusFilter(e.target.value)}>
                        <option value="">Tất cả trạng thái</option>
                        <option value="active">Hoạt động</option>
                        <option value="inactive">Không kích hoạt</option>
                        <option value="dead">Đã chết</option>
                    </Select>
                </div>

                <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    {['Loại', 'Host', 'Port', 'Username', 'Nhóm', 'Trạng thái', 'Ngày tạo', 'Thao tác'].map(h => (
                                        <th key={h} className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wider px-4 py-3.5">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {hook.loading ? Array(6).fill(0).map((_, i) => (
                                    <tr key={i} className="border-b border-white/[0.03]">
                                        {Array(8).fill(0).map((_, j) => <td key={j} className="px-4 py-4"><div className="h-4 bg-white/5 rounded animate-pulse w-3/4" /></td>)}
                                    </tr>
                                )) : hook.proxies.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center text-slate-500 py-16 text-sm">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center"><Globe size={20} className="text-slate-600" /></div>
                                            Không có proxy nào
                                        </div>
                                    </td></tr>
                                ) : hook.proxies.map(prx => {
                                    const grp = hook.groups.find(g => g._id === prx.group_id)
                                    return (
                                        <tr key={prx._id} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                                            <td className="px-4 py-3.5"><span className={`px-2 py-0.5 rounded-md text-xs font-bold border uppercase ${TYPE_MAP[prx.type] || ''}`}>{prx.type}</span></td>
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
                                                    <button onClick={() => setEditing(prx)} className="w-8 h-8 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 text-slate-500 flex items-center justify-center transition-all"><Edit3 size={14} /></button>
                                                    <button onClick={() => setDeleteProxyTarget(prx._id)} className="w-8 h-8 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-slate-500 flex items-center justify-center transition-all"><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    {hook.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                            <p className="text-xs text-slate-500">Trang {hook.pagination.page} / {hook.pagination.totalPages}</p>
                            <div className="flex gap-1">
                                <button disabled={hook.pagination.page <= 1} onClick={() => hook.load(hook.pagination.page - 1)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-slate-400 transition-all"><ChevronLeft size={15} /></button>
                                <button disabled={hook.pagination.page >= hook.pagination.totalPages} onClick={() => hook.load(hook.pagination.page + 1)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-slate-400 transition-all"><ChevronRight size={15} /></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
