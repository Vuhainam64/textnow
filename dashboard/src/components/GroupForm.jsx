import { useState } from 'react'
import { Check } from 'lucide-react'
import { GROUP_COLORS, inputCls } from '../lib/ui'

export default function GroupForm({ initial, onSave, onClose }) {
    const [form, setForm] = useState({ name: initial?.name || '', description: initial?.description || '', color: initial?.color || GROUP_COLORS[0] })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const submit = async (e) => {
        e.preventDefault()
        if (!form.name.trim()) { setError('Tên nhóm là bắt buộc'); return }
        setLoading(true)
        try { await onSave(form); onClose() }
        catch (err) { setError(err.message) }
        finally { setLoading(false) }
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3">{error}</div>}
            <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">Tên nhóm *</label>
                <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="VD: T1, Spam, VN..." />
            </div>
            <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">Mô tả</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none`} placeholder="Mô tả mục đích của nhóm..." />
            </div>
            <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">Màu nhóm</label>
                <div className="flex gap-2 flex-wrap">
                    {GROUP_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                            className="w-7 h-7 rounded-full ring-2 ring-offset-2 ring-offset-slate-900 transition-all flex items-center justify-center"
                            style={{ backgroundColor: c, ringColor: form.color === c ? c : 'transparent' }}>
                            {form.color === c && <Check size={12} className="text-white" />}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                <button type="submit" disabled={loading} className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 transition-all">
                    {loading ? 'Đang lưu...' : initial ? 'Lưu thay đổi' : 'Tạo nhóm'}
                </button>
            </div>
        </form>
    )
}
