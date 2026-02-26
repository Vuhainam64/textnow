import { useEffect, useState, useCallback } from 'react'
import {
    Monitor, RefreshCw, Trash2, Search, Plus,
    CheckSquare, Square, ChevronLeft, ChevronRight
} from 'lucide-react'
import api from '../../lib/api'
import Select from '../Select'
import Modal from '../Modal'
import ConfirmModal from './ConfirmModal'
import { inputCls } from '../../lib/ui'

const OS_COLORS = { windows: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', macos: 'text-purple-400 bg-purple-500/10 border-purple-500/20', linux: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
const BR_COLORS = { mimic: 'text-orange-400 bg-orange-500/10 border-orange-500/20', stealthfox: 'text-violet-400 bg-violet-500/10 border-violet-500/20' }

export default function ProfilesTab() {
    const [profiles, setProfiles] = useState([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [page, setPage] = useState(1)
    const [limit] = useState(15)
    const [selected, setSelected] = useState(new Set())
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [createModal, setCreateModal] = useState(false)
    const [createForm, setCreateForm] = useState({ name: '', proxyHost: '', proxyPort: '', proxyUser: '', proxyPass: '', proxyType: 'socks5' })
    const [createLoading, setCreateLoading] = useState(false)
    const [toast, setToast] = useState(null)

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const fetchProfiles = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.post('/mlx/profiles/search', {
                offset: (page - 1) * limit,
                limit,
                search_text: search,
                storage_type: 'all',
                is_removed: false,
                order_by: 'created_at',
                sort: 'desc',
            })
            if (res.success) {
                setProfiles(res.data.profiles || [])
                setTotal(res.data.total_count || 0)
                setSelected(new Set())
            }
        } catch { /* offline */ } finally { setLoading(false) }
    }, [page, limit, search])

    useEffect(() => { fetchProfiles() }, [fetchProfiles])

    const doSearch = () => { setSearch(searchInput); setPage(1) }

    const handleDelete = async (ids) => {
        await api.post('/mlx/profiles/remove', { ids })
        showToast(`Đã xoá ${ids.length} profile`)
        setDeleteTarget(null)
        fetchProfiles()
    }

    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const toggleAll = () => {
        if (selected.size === profiles.length) setSelected(new Set())
        else setSelected(new Set(profiles.map(p => p.id)))
    }

    const doCreate = async () => {
        if (!createForm.name.trim()) return
        setCreateLoading(true)
        try {
            const proxy = createForm.proxyHost ? {
                type: createForm.proxyType,
                host: createForm.proxyHost,
                port: createForm.proxyPort,
                username: createForm.proxyUser || undefined,
                password: createForm.proxyPass || undefined,
            } : null
            await api.post('/mlx/profiles/create', { name: createForm.name.trim(), proxy })
            showToast('Tạo profile thành công')
            setCreateModal(false)
            setCreateForm({ name: '', proxyHost: '', proxyPort: '', proxyUser: '', proxyPass: '', proxyType: 'socks5' })
            fetchProfiles()
        } catch (e) {
            showToast(e.message, 'error')
        } finally { setCreateLoading(false) }
    }

    const totalPages = Math.ceil(total / limit)

    return (
        <div className="space-y-4">
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg
          ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {toast.msg}
                </div>
            )}

            {deleteTarget && (
                <ConfirmModal
                    title="Xoá Profiles"
                    description={`Xoá vĩnh viễn ${deleteTarget.length} profile đã chọn? Không thể hoàn tác!`}
                    danger
                    onConfirm={() => handleDelete(deleteTarget)}
                    onClose={() => setDeleteTarget(null)}
                />
            )}

            {createModal && (
                <Modal title="Tạo Profile MLX mới" onClose={() => setCreateModal(false)} width="max-w-lg">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Tên Profile *</label>
                            <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                                className={inputCls} placeholder="Nhập tên profile..." />
                        </div>
                        <div className="border-t border-white/5 pt-4">
                            <p className="text-xs text-slate-500 font-medium mb-3">Proxy (tuỳ chọn)</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-600 mb-1 block">Loại</label>
                                    <Select value={createForm.proxyType} onChange={e => setCreateForm(f => ({ ...f, proxyType: e.target.value }))}>
                                        <option value="socks5">SOCKS5</option>
                                        <option value="socks4">SOCKS4</option>
                                        <option value="http">HTTP</option>
                                        <option value="https">HTTPS</option>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-600 mb-1 block">Port</label>
                                    <input type="number" value={createForm.proxyPort} onChange={e => setCreateForm(f => ({ ...f, proxyPort: e.target.value }))}
                                        className={inputCls} placeholder="8080" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-slate-600 mb-1 block">Host</label>
                                    <input value={createForm.proxyHost} onChange={e => setCreateForm(f => ({ ...f, proxyHost: e.target.value }))}
                                        className={inputCls} placeholder="192.168.1.1" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-600 mb-1 block">Username</label>
                                    <input value={createForm.proxyUser} onChange={e => setCreateForm(f => ({ ...f, proxyUser: e.target.value }))}
                                        className={inputCls} placeholder="user" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-600 mb-1 block">Password</label>
                                    <input type="password" value={createForm.proxyPass} onChange={e => setCreateForm(f => ({ ...f, proxyPass: e.target.value }))}
                                        className={inputCls} placeholder="••••••••" />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button onClick={() => setCreateModal(false)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                            <button onClick={doCreate} disabled={createLoading}
                                className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 disabled:opacity-60 transition-all">
                                {createLoading ? 'Đang tạo...' : 'Tạo Profile'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <p className="text-sm text-slate-500">
                    Tổng: <span className="text-slate-300 font-medium">{total}</span> profiles
                    {selected.size > 0 && <span className="ml-2 text-blue-400">· Chọn {selected.size}</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && doSearch()}
                            placeholder="Tìm profile..."
                            className="pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 w-44 transition-all"
                        />
                    </div>

                    {selected.size > 0 && (
                        <button onClick={() => setDeleteTarget([...selected])}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all">
                            <Trash2 size={13} />
                            Xoá ({selected.size})
                        </button>
                    )}

                    <button onClick={() => setCreateModal(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all">
                        <Plus size={13} />
                        Tạo Profile
                    </button>

                    <button onClick={fetchProfiles} disabled={loading}
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
                                <th className="px-4 py-3.5 w-10">
                                    <button onClick={toggleAll} className="text-slate-500 hover:text-slate-300 transition-all">
                                        {selected.size === profiles.length && profiles.length > 0
                                            ? <CheckSquare size={15} className="text-blue-400" />
                                            : <Square size={15} />}
                                    </button>
                                </th>
                                {['Tên Profile', 'Browser', 'OS', 'Ngày tạo', 'Thao tác'].map(h => (
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
                            ) : profiles.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center text-slate-500 py-12 text-sm">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                                <Monitor size={20} className="text-slate-600" />
                                            </div>
                                            Không có profile nào
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                profiles.map(p => {
                                    const osStyle = OS_COLORS[p.os_type] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                                    const brStyle = BR_COLORS[p.browser_type] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                                    const isSelected = selected.has(p.id)
                                    return (
                                        <tr key={p.id}
                                            className={`border-b border-white/3 transition-colors group cursor-pointer
                        ${isSelected ? 'bg-blue-500/5' : 'hover:bg-white/3'}`}
                                            onClick={() => toggleSelect(p.id)}>
                                            <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => toggleSelect(p.id)} className="text-slate-500 hover:text-slate-300 transition-all">
                                                    {isSelected
                                                        ? <CheckSquare size={15} className="text-blue-400" />
                                                        : <Square size={15} />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3.5 font-medium text-slate-200">
                                                <div className="flex items-center gap-2">
                                                    <Monitor size={14} className="text-slate-500 flex-shrink-0" />
                                                    {p.name}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold border uppercase ${brStyle}`}>
                                                    {p.browser_type || '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${osStyle}`}>
                                                    {p.os_type || '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-500 text-xs">
                                                {p.created_at ? new Date(p.created_at).toLocaleDateString('vi-VN') : '—'}
                                            </td>
                                            <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => setDeleteTarget([p.id])}
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

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                        <p className="text-xs text-slate-500">Trang {page} / {totalPages} · {total} profiles</p>
                        <div className="flex gap-1">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-slate-400 transition-all">
                                <ChevronLeft size={15} />
                            </button>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
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
