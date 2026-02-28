import { Search, Plus, Download, Upload, Trash2, Edit3, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { STATUS_MAP } from '../../../lib/ui'
import Select from '../../../components/Select'
import StatusBadge from '../../../components/StatusBadge'

export default function AccountsTable({
    accounts, groups, loading, pagination, stats,
    search, setSearch, statusFilter, setStatusFilter,
    selectedGroup, currentGroup,
    onAdd, onEdit, onDelete, onDeleteAll, onImport, onExport,
    onPageChange,
}) {
    const groupColor = currentGroup?.color || '#3b82f6'

    return (
        <div className="flex-1 min-w-0 space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        {currentGroup && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: groupColor }} />}
                        <h2 className="text-2xl font-bold text-white">
                            {selectedGroup === '__all__' ? 'Tài khoản'
                                : selectedGroup === '__ungrouped__' ? 'Chưa có nhóm'
                                    : currentGroup?.name || 'Tài khoản'}
                        </h2>
                    </div>
                    {currentGroup?.description && <p className="text-xs text-slate-500 mt-0.5">{currentGroup.description}</p>}
                    <p className="text-sm text-slate-500 mt-0.5">Tổng: <span className="text-slate-300 font-medium">{pagination.total}</span> tài khoản</p>
                </div>

                <div className="flex gap-2">
                    {pagination.total > 0 && (
                        <button onClick={onDeleteAll}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/10 transition-all">
                            <Trash2 size={14} /> Xoá tất cả
                        </button>
                    )}
                    <button onClick={onExport}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/10 transition-all">
                        <Download size={14} /> Xuất
                    </button>
                    <button onClick={onImport}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                        <Upload size={14} /> Nhập file
                    </button>
                    <button onClick={onAdd}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all">
                        <Plus size={14} /> Thêm tài khoản
                    </button>
                </div>
            </div>

            {/* Stats */}
            {stats.length > 0 && (
                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    {stats.map(s => {
                        const cfg = STATUS_MAP[s._id] || { label: s._id }
                        return (
                            <div key={s._id} className="px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2 bg-white/[0.03]">
                                <span className="text-xs font-medium text-slate-300">{cfg.label}:</span>
                                <span className="text-xs font-bold text-white">{s.count}</span>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Filters */}
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

            {/* Table */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                {['TextNow User', 'Nhóm', 'Trạng thái', 'Ngày thao tác', 'Thao tác'].map(h => (
                                    <th key={h} className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wider px-4 py-3.5">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array(6).fill(0).map((_, i) => (
                                    <tr key={i} className="border-b border-white/[0.03]">
                                        {Array(5).fill(0).map((_, j) => (
                                            <td key={j} className="px-4 py-4"><div className="h-4 bg-white/5 rounded animate-pulse w-3/4" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : accounts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center text-slate-500 py-16">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                                <AlertCircle size={20} className="text-slate-600" />
                                            </div>
                                            <span className="text-sm">Không có tài khoản nào</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : accounts.map(acc => {
                                const grp = groups.find(g => g._id === acc.group_id)
                                return (
                                    <tr key={acc._id} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                                        <td className="px-4 py-3.5 font-medium text-slate-200">{acc.textnow_user}</td>
                                        <td className="px-4 py-3.5">
                                            {grp
                                                ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
                                                    style={{ color: grp.color, backgroundColor: grp.color + '18', borderColor: grp.color + '40' }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: grp.color }} />{grp.name}
                                                </span>
                                                : <span className="text-slate-600 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3.5"><StatusBadge status={acc.status} /></td>
                                        <td className="px-4 py-3.5 text-slate-500 text-xs">{new Date(acc.updated_at).toLocaleString('vi-VN')}</td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => onEdit(acc)}
                                                    className="w-8 h-8 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 text-slate-500 flex items-center justify-center transition-all">
                                                    <Edit3 size={14} />
                                                </button>
                                                <button onClick={() => onDelete(acc._id)}
                                                    className="w-8 h-8 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-slate-500 flex items-center justify-center transition-all">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                        <p className="text-xs text-slate-500">Trang {pagination.page} / {pagination.totalPages}</p>
                        <div className="flex gap-1">
                            <button disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-slate-400 transition-all">
                                <ChevronLeft size={15} />
                            </button>
                            <button disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-slate-400 transition-all">
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
