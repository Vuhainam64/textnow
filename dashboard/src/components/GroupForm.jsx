import { useState, useRef, useEffect } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { GROUP_COLORS, inputCls } from '../lib/ui'
import { useT } from '../lib/i18n'

// Preset labels với màu mặc định
const PRESET_LABELS = [
    { text: 'VER', color: '#10b981' },
    { text: 'RESET', color: '#3b82f6' },
    { text: 'CHECK LIVE', color: '#f59e0b' },
    { text: 'VERIFY MAIL', color: '#a855f7' },
    { text: 'IMPORT', color: '#06b6d4' },
    { text: 'SPAM', color: '#ef4444' },
    { text: 'MAIN', color: '#6366f1' },
]

// Bảng màu chọn nhanh
const LABEL_PALETTE = [
    '#10b981', '#3b82f6', '#f59e0b', '#a855f7',
    '#06b6d4', '#ef4444', '#6366f1', '#f97316',
    '#ec4899', '#84cc16', '#14b8a6', '#64748b',
]

// Mini color picker inline (không popup, không bị clip)
function ColorDots({ selected, onChange }) {
    return (
        <div className="flex flex-wrap gap-1 p-2 bg-slate-800 border border-white/10 rounded-xl mt-1">
            {LABEL_PALETTE.map(c => (
                <button key={c} type="button" onClick={() => onChange(c)}
                    className="w-5 h-5 rounded-full flex items-center justify-center transition-all hover:scale-110 flex-shrink-0"
                    style={{ backgroundColor: c, outline: selected === c ? `2px solid ${c}` : '2px solid transparent', outlineOffset: 2 }}>
                    {selected === c && <Check size={9} className="text-white" />}
                </button>
            ))}
        </div>
    )
}

function LabelBadge({ label, onRemove, onColorChange }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <span ref={ref} className="relative inline-flex flex-col">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all"
                style={{ backgroundColor: label.color + '22', borderColor: label.color + '55', color: label.color }}>
                <button type="button" onClick={() => setOpen(p => !p)}
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform hover:scale-125"
                    style={{ backgroundColor: label.color }}
                    title="Đổi màu" />
                {label.text}
                {onRemove && (
                    <button type="button" onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100">
                        <X size={9} />
                    </button>
                )}
            </span>
            {open && (
                <div className="absolute top-full left-0 mt-1 z-50" onClick={e => e.stopPropagation()}>
                    <ColorDots selected={label.color} onChange={(c) => { onColorChange?.(c); setOpen(false) }} />
                </div>
            )}
        </span>
    )
}

export default function GroupForm({ initial, onSave, onClose }) {
    const t = useT()
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
        setShowCustomPalette(false)
        inputRef.current?.focus()
    }

    const submit = async (e) => {
        e.preventDefault()
        if (!form.name.trim()) { setError(t('groups.groupName') + ' ' + t('common.error').toLowerCase()); return }
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
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">{t('groups.groupName')} *</label>
                <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder={t('groups.namePlaceholder')} />
            </div>

            <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">{t('common.description')}</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none`} placeholder={t('groups.descriptionPlaceholder')} />
            </div>

            {/* Label Section */}
            <div>
                <label className="text-xs text-slate-500 mb-2 block font-medium">{t('groups.groupLabel')}</label>

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
                    <button type="button" onClick={() => setShowCustomPalette(p => !p)}
                        className="w-7 h-7 rounded-lg border-2 border-white/20 flex-shrink-0 transition-all hover:scale-110"
                        style={{ backgroundColor: customColor }}
                        title="Chọn màu nhãn" />
                    <input
                        ref={inputRef}
                        value={customInput}
                        onChange={e => setCustomInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomLabel())}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all uppercase"
                        placeholder={t('groups.customLabel')}
                    />
                    <button type="button" onClick={addCustomLabel}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all">
                        <Plus size={13} />
                    </button>
                </div>

                {/* Custom label color picker — inline, không popup */}
                {showCustomPalette && (
                    <ColorDots selected={customColor} onChange={(c) => setCustomColor(c)} />
                )}
            </div>

            {/* Màu nhóm */}
            <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">{t('groups.groupColor')}</label>
                <div className="flex gap-2 flex-wrap">
                    {GROUP_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
                            style={{
                                backgroundColor: c,
                                outline: form.color === c ? `3px solid ${c}` : '3px solid transparent',
                                outlineOffset: 3,
                                boxShadow: form.color === c ? `0 0 0 1px #0f1117` : 'none',
                            }}>
                            {form.color === c && <Check size={12} className="text-white" />}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">{t('common.cancel')}</button>
                <button type="submit" disabled={loading} className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 transition-all">
                    {loading ? t('common.saving') : initial ? t('common.save') : t('groups.createGroup')}
                </button>
            </div>
        </form>
    )
}
