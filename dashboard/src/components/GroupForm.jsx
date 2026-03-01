import { useState, useRef } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { GROUP_COLORS, inputCls } from '../lib/ui'

// Preset labels với màu mặc định
const PRESET_LABELS = [
    { text: 'VER', color: '#10b981' }, // emerald
    { text: 'RESET', color: '#3b82f6' }, // blue
    { text: 'CHECK LIVE', color: '#f59e0b' }, // amber
    { text: 'VERIFY MAIL', color: '#a855f7' }, // purple
    { text: 'IMPORT', color: '#06b6d4' }, // cyan
    { text: 'SPAM', color: '#ef4444' }, // red
    { text: 'MAIN', color: '#6366f1' }, // indigo
]

// Bảng màu chọn nhanh cho label
const LABEL_PALETTE = [
    '#10b981', '#3b82f6', '#f59e0b', '#a855f7',
    '#06b6d4', '#ef4444', '#6366f1', '#f97316',
    '#ec4899', '#84cc16', '#14b8a6', '#64748b',
]

function LabelBadge({ label, onRemove, onColorChange }) {
    const [showPicker, setShowPicker] = useState(false)
    return (
        <span className="relative flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all"
            style={{ backgroundColor: label.color + '22', borderColor: label.color + '55', color: label.color }}>
            {/* Swatch click mở color picker */}
            <button type="button" onClick={() => setShowPicker(p => !p)}
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/20 transition-transform hover:scale-125"
                style={{ backgroundColor: label.color }}
                title="Đổi màu" />
            {label.text}
            {onRemove && (
                <button type="button" onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
                    <X size={9} />
                </button>
            )}
            {showPicker && (
                <div className="absolute top-full left-0 mt-1.5 z-50 bg-slate-900 border border-white/10 rounded-xl p-2 shadow-2xl"
                    onClick={e => e.stopPropagation()}>
                    <div className="grid grid-cols-6 gap-1">
                        {LABEL_PALETTE.map(c => (
                            <button key={c} type="button"
                                onClick={() => { onColorChange?.(c); setShowPicker(false) }}
                                className="w-5 h-5 rounded-full ring-2 ring-offset-1 ring-offset-slate-900 transition-all hover:scale-110"
                                style={{ backgroundColor: c, ringColor: label.color === c ? c : 'transparent' }}>
                                {label.color === c && <Check size={10} className="text-white mx-auto" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </span>
    )
}

export default function GroupForm({ initial, onSave, onClose }) {
    const [form, setForm] = useState({
        name: initial?.name || '',
        description: initial?.description || '',
        color: initial?.color || GROUP_COLORS[0],
        labels: initial?.labels?.map(l =>
            typeof l === 'string' ? { text: l, color: '#3b82f6' } : l
        ) || [],
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [customInput, setCustomInput] = useState('')
    const [customColor, setCustomColor] = useState('#10b981')
    const [showCustomPalette, setShowCustomPalette] = useState(false)
    const inputRef = useRef(null)

    const isActive = (text) => form.labels.some(l => l.text === text)

    const togglePreset = (preset) => {
        setForm(f => ({
            ...f,
            labels: isActive(preset.text)
                ? f.labels.filter(l => l.text !== preset.text)
                : [...f.labels, { text: preset.text, color: preset.color }]
        }))
    }

    const changeColor = (text, newColor) => {
        setForm(f => ({ ...f, labels: f.labels.map(l => l.text === text ? { ...l, color: newColor } : l) }))
    }

    const removeLabel = (text) => {
        setForm(f => ({ ...f, labels: f.labels.filter(l => l.text !== text) }))
    }

    const addCustomLabel = () => {
        const val = customInput.trim().toUpperCase()
        if (!val || form.labels.some(l => l.text === val)) { setCustomInput(''); return }
        setForm(f => ({ ...f, labels: [...f.labels, { text: val, color: customColor }] }))
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

    const customLabels = form.labels.filter(l => !PRESET_LABELS.some(p => p.text === l.text))

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
                    {PRESET_LABELS.map(preset => {
                        const active = isActive(preset.text)
                        const activeLbl = form.labels.find(l => l.text === preset.text)
                        return active ? (
                            <LabelBadge key={preset.text}
                                label={activeLbl}
                                onRemove={() => removeLabel(preset.text)}
                                onColorChange={(c) => changeColor(preset.text, c)} />
                        ) : (
                            <button key={preset.text} type="button" onClick={() => togglePreset(preset)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/10 bg-white/3 text-slate-500 hover:border-white/25 hover:text-slate-300 transition-all">
                                {preset.text}
                            </button>
                        )
                    })}
                </div>

                {/* Custom labels active */}
                {customLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {customLabels.map(lbl => (
                            <LabelBadge key={lbl.text}
                                label={lbl}
                                onRemove={() => removeLabel(lbl.text)}
                                onColorChange={(c) => changeColor(lbl.text, c)} />
                        ))}
                    </div>
                )}

                {/* Thêm custom label */}
                <div className="flex gap-1.5 items-center">
                    {/* Color swatch for new custom */}
                    <div className="relative">
                        <button type="button" onClick={() => setShowCustomPalette(p => !p)}
                            className="w-7 h-7 rounded-lg border border-white/20 flex-shrink-0 flex items-center justify-center transition-all hover:scale-110"
                            style={{ backgroundColor: customColor }}
                            title="Chọn màu" />
                        {showCustomPalette && (
                            <div className="absolute top-full mt-1 z-50 bg-slate-900 border border-white/10 rounded-xl p-2 shadow-2xl">
                                <div className="grid grid-cols-6 gap-1">
                                    {LABEL_PALETTE.map(c => (
                                        <button key={c} type="button"
                                            onClick={() => { setCustomColor(c); setShowCustomPalette(false) }}
                                            className="w-5 h-5 rounded-full ring-2 ring-offset-1 ring-offset-slate-900 hover:scale-110 transition-all"
                                            style={{ backgroundColor: c, ringColor: customColor === c ? c : 'transparent' }} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <input
                        ref={inputRef}
                        value={customInput}
                        onChange={e => setCustomInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomLabel())}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all uppercase"
                        placeholder="Thêm nhãn tùy chỉnh..."
                    />
                    <button type="button" onClick={addCustomLabel}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all">
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
