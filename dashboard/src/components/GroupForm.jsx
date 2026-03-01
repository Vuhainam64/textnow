import { useState, useRef } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { GROUP_COLORS, inputCls } from '../lib/ui'

const PRESET_LABELS = ['VER', 'RESET', 'CHECK LIVE', 'VERIFY MAIL', 'IMPORT', 'SPAM', 'MAIN']

const LABEL_COLORS = {
    'VER': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    'RESET': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'CHECK LIVE': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    'VERIFY MAIL': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    'IMPORT': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    'SPAM': 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    'MAIN': 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
}
const DEFAULT_LABEL_CLS = 'bg-slate-500/15 text-slate-400 border-slate-500/30'

export default function GroupForm({ initial, onSave, onClose }) {
    const [form, setForm] = useState({
        name: initial?.name || '',
        description: initial?.description || '',
        color: initial?.color || GROUP_COLORS[0],
        labels: initial?.labels || [],
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [customInput, setCustomInput] = useState('')
    const inputRef = useRef(null)

    const toggleLabel = (lbl) => {
        setForm(f => ({
            ...f,
            labels: f.labels.includes(lbl)
                ? f.labels.filter(l => l !== lbl)
                : [...f.labels, lbl]
        }))
    }

    const addCustomLabel = () => {
        const val = customInput.trim().toUpperCase()
        if (!val || form.labels.includes(val)) { setCustomInput(''); return }
        setForm(f => ({ ...f, labels: [...f.labels, val] }))
        setCustomInput('')
        inputRef.current?.focus()
    }

    const submit = async (e) => {
        e.preventDefault()
        if (!form.name.trim()) { setError('Tên nhóm là bắt buộc'); return }
        setLoading(true)
        try { await onSave(form); onClose() }
        catch (err) { setError(err.message) }
        finally { setLoading(false) }
    }

    // Tất cả labels để hiển thị (preset + custom chưa có trong preset)
    const customLabels = form.labels.filter(l => !PRESET_LABELS.includes(l))

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

            {/* Label Section */}
            <div>
                <label className="text-xs text-slate-500 mb-2 block font-medium">Nhãn mục đích</label>
                {/* Preset labels */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {PRESET_LABELS.map(lbl => {
                        const active = form.labels.includes(lbl)
                        const cls = LABEL_COLORS[lbl] || DEFAULT_LABEL_CLS
                        return (
                            <button
                                key={lbl}
                                type="button"
                                onClick={() => toggleLabel(lbl)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${active
                                    ? cls
                                    : 'bg-white/3 border-white/10 text-slate-600 hover:border-white/20 hover:text-slate-400'
                                    }`}
                            >
                                {active && <Check size={10} />}
                                {lbl}
                            </button>
                        )
                    })}
                </div>

                {/* Custom labels đã thêm */}
                {customLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {customLabels.map(lbl => (
                            <span key={lbl} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${DEFAULT_LABEL_CLS}`}>
                                {lbl}
                                <button type="button" onClick={() => toggleLabel(lbl)} className="ml-0.5 hover:text-red-400 transition-colors">
                                    <X size={9} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Thêm label tùy chỉnh */}
                <div className="flex gap-1.5">
                    <input
                        ref={inputRef}
                        value={customInput}
                        onChange={e => setCustomInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomLabel())}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all uppercase"
                        placeholder="Thêm nhãn tùy chỉnh..."
                    />
                    <button
                        type="button"
                        onClick={addCustomLabel}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all"
                    >
                        <Plus size={13} />
                    </button>
                </div>
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
