import { useState } from 'react'
import { inputCls } from '../../../lib/ui'
import Select from '../../../components/Select'

export default function ProxyForm({ initial, groups, groupId, onSave, onClose }) {
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
