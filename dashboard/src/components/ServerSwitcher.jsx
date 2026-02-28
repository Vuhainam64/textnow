import { useState, useEffect, useRef } from 'react'
import { Server, Plus, Check, Pencil, Trash2, X, ChevronDown, Globe, Download, Upload } from 'lucide-react'
import { getServers, saveServers, getActiveServerId, setActiveServerId } from '../lib/serverStore'
import { showToast } from './Toast'
import Tooltip from './Tooltip'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6']

const DEFAULT_FORM = { id: '', name: '', url: '', color: '#6366f1', icon: '🖥️' }

export default function ServerSwitcher({ onChange }) {
    const fileRef = useRef(null)
    const [open, setOpen] = useState(false)
    const [servers, setServers] = useState(getServers)
    const [activeId, setActiveId] = useState(getActiveServerId)
    const [showForm, setShowForm] = useState(false)
    const [editServer, setEditServer] = useState(null)
    const [form, setForm] = useState(DEFAULT_FORM)
    const dropRef = useRef(null)

    const active = servers.find(s => s.id === activeId) || servers[0]

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropRef.current && !dropRef.current.contains(e.target)) {
                setOpen(false)
                setShowForm(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const exportJson = () => {
        const blob = new Blob([JSON.stringify(servers, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'vps-servers.json'
        a.click()
        URL.revokeObjectURL(url)
        showToast('✅ Đã xuất danh sách server')
    }

    const importJson = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            try {
                const list = JSON.parse(ev.target.result)
                if (!Array.isArray(list) || !list[0]?.url) return showToast('File JSON không hợp lệ', 'error')
                saveServers(list)
                setServers(list)
                if (!list.find(s => s.id === activeId)) {
                    setActiveServerId(list[0].id)
                    setActiveId(list[0].id)
                }
                showToast(`✅ Đã nhập ${list.length} server`)
            } catch { showToast('File JSON bị lỗi', 'error') }
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    const select = (server) => {
        setActiveServerId(server.id)
        setActiveId(server.id)
        setOpen(false)
        onChange?.()
        showToast(`🖥️ Chuyển sang: ${server.name}`)
    }

    const openAdd = () => {
        setEditServer(null)
        setForm({ ...DEFAULT_FORM, id: `vps_${Date.now()}` })
        setShowForm(true)
    }

    const openEdit = (s, e) => {
        e.stopPropagation()
        setEditServer(s)
        setForm({ ...s })
        setShowForm(true)
    }

    const deleteServer = (s, e) => {
        e.stopPropagation()
        if (servers.length <= 1) return showToast('Phải có ít nhất 1 server', 'warning')
        const next = servers.filter(x => x.id !== s.id)
        saveServers(next)
        setServers(next)
        if (activeId === s.id) select(next[0])
        showToast('Đã xoá server')
    }

    const saveForm = () => {
        if (!form.name.trim() || !form.url.trim()) return showToast('Vui lòng nhập tên và URL', 'warning')
        let url = form.url.trim()
        if (!url.endsWith('/api')) url = url.replace(/\/$/, '') + '/api'
        const updated = { ...form, url }
        const next = editServer
            ? servers.map(s => s.id === editServer.id ? updated : s)
            : [...servers, updated]
        saveServers(next)
        setServers(next)
        setShowForm(false)
        showToast(editServer ? 'Đã cập nhật server' : 'Đã thêm server')
    }

    const h = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

    return (
        <div className="relative" ref={dropRef}>
            {/* Trigger button */}
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm"
            >
                <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: active?.color }} />
                <span className="text-slate-200 font-medium text-xs max-w-[100px] truncate">{active?.name || 'Server'}</span>
                <ChevronDown size={12} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute top-full mt-2 right-0 w-72 glass border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Server size={13} className="text-blue-400" />
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">VPS Servers</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={importJson} />
                            <Tooltip text="Xuất JSON" position="bottom">
                                <button onClick={exportJson}
                                    className="w-6 h-6 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-200 flex items-center justify-center transition-all">
                                    <Download size={12} />
                                </button>
                            </Tooltip>
                            <Tooltip text="Nhập JSON" position="bottom">
                                <button onClick={() => fileRef.current?.click()}
                                    className="w-6 h-6 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-200 flex items-center justify-center transition-all">
                                    <Upload size={12} />
                                </button>
                            </Tooltip>
                            <button onClick={openAdd}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-[11px] font-bold transition-all">
                                <Plus size={11} /> Thêm
                            </button>
                        </div>
                    </div>

                    {/* Server list */}
                    <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 py-1">
                        {servers.map(s => (
                            <div
                                key={s.id}
                                onClick={() => select(s)}
                                className={`group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all hover:bg-white/5
                                    ${s.id === activeId ? 'bg-white/[0.04]' : ''}`}
                            >
                                <span className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                                    style={{ backgroundColor: s.color + '22', border: `1px solid ${s.color}44` }}>
                                    {s.icon || '🖥️'}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-200 truncate">{s.name}</p>
                                    <p className="text-[10px] text-slate-500 truncate font-mono">{s.url}</p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {s.id === activeId
                                        ? <Check size={14} className="text-emerald-400" />
                                        : (
                                            <div className="hidden group-hover:flex items-center gap-0.5">
                                                <button onClick={e => openEdit(s, e)}
                                                    className="w-6 h-6 rounded-md hover:bg-blue-500/20 hover:text-blue-400 text-slate-500 flex items-center justify-center transition-all">
                                                    <Pencil size={11} />
                                                </button>
                                                <button onClick={e => deleteServer(s, e)}
                                                    className="w-6 h-6 rounded-md hover:bg-red-500/20 hover:text-red-400 text-slate-500 flex items-center justify-center transition-all">
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        )
                                    }
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add / Edit Form */}
                    {showForm && (
                        <div className="border-t border-white/5 p-4 space-y-3 bg-white/[0.02]">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                    {editServer ? 'Sửa Server' : 'Thêm Server'}
                                </span>
                                <button onClick={() => setShowForm(false)} className="text-slate-600 hover:text-slate-300">
                                    <X size={13} />
                                </button>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                <input value={form.icon} onChange={h('icon')}
                                    className="col-span-1 bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-center text-lg focus:outline-none focus:border-blue-500/50"
                                    placeholder="🖥️" maxLength={2} />
                                <input value={form.name} onChange={h('name')}
                                    className="col-span-4 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
                                    placeholder="VPS 1 (Hà Nội)" />
                            </div>
                            <div className="relative">
                                <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input value={form.url} onChange={h('url')}
                                    className="w-full pl-8 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 font-mono"
                                    placeholder="https://vps1.autopee.com" />
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                                {COLORS.map(c => (
                                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                                        className="w-6 h-6 rounded-full transition-all flex items-center justify-center"
                                        style={{ backgroundColor: c, outline: form.color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}>
                                        {form.color === c && <Check size={10} className="text-white" />}
                                    </button>
                                ))}
                            </div>
                            <button onClick={saveForm}
                                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all">
                                {editServer ? 'Cập nhật' : 'Thêm server'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
