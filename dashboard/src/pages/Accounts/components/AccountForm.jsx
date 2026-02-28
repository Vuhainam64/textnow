import { useState } from 'react'
import { inputCls } from '../../../lib/ui'
import Select from '../../../components/Select'

export default function AccountForm({ initial, groups, groupId, onSave, onClose }) {
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
                    <input required value={form.textnow_pass} onChange={h('textnow_pass')} className={inputCls} placeholder="password" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Hotmail User</label>
                    <input value={form.hotmail_user} onChange={h('hotmail_user')} className={inputCls} placeholder="email@hotmail.com" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Hotmail Pass</label>
                    <input value={form.hotmail_pass} onChange={h('hotmail_pass')} className={inputCls} placeholder="password" />
                </div>
                <div className="col-span-2">
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Hotmail Token</label>
                    <input value={form.hotmail_token} onChange={h('hotmail_token')} className={inputCls} placeholder="OAuth token" />
                </div>
                <div className="col-span-2">
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Hotmail Client ID</label>
                    <input value={form.hotmail_client_id} onChange={h('hotmail_client_id')} className={inputCls} placeholder="dbc8e03a-b00c-..." />
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">Trạng thái</label>
                    <Select value={form.status} onChange={h('status')}>
                        <option value="pending">Chờ xử lý</option>
                        <option value="active">Hoạt động</option>
                        <option value="inactive">Không kích hoạt</option>
                        <option value="banned">Bị khoá</option>
                        <option value="die_mail">Die Mail</option>
                        <option value="no_mail">No Mail</option>
                        <option value="Reset Error">Lỗi Reset</option>
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
