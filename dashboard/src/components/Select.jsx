/**
 * Select.jsx — Custom select dropdown component
 * Thay thế <select> native để hỗ trợ bo góc, dark theme đẹp.
 *
 * Usage:
 *   <Select value={val} onChange={v => setVal(v)} className="...">
 *     <option value="">Tất cả</option>
 *     <option value="a">Option A</option>
 *   </Select>
 *
 * Tương thích 100% API với <select> native.
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export default function Select({ value, onChange, children, className = '', placeholder = '', disabled = false }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    // Parse children thành array of { value, label, disabled }
    const options = []
    if (children) {
        const arr = Array.isArray(children) ? children.flat() : [children]
        arr.forEach(child => {
            if (!child) return
            const v = child.props?.value ?? ''
            const label = child.props?.children ?? v
            const dis = child.props?.disabled ?? false
            options.push({ value: v, label, disabled: dis })
        })
    }

    const selected = options.find(o => String(o.value) === String(value))
    const displayLabel = selected?.label || placeholder || options[0]?.label || ''

    // Đóng khi click ngoài
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Đóng khi nhấn Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const handleSelect = (opt) => {
        if (opt.disabled) return
        onChange?.({ target: { value: opt.value } })
        setOpen(false)
    }

    return (
        <div ref={ref} className={`relative ${className}`}>
            {/* Trigger button */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm border transition-all text-left
                    bg-white/5 border-white/10 text-slate-200
                    hover:border-white/20 focus:outline-none focus:border-blue-500/50
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${open ? 'border-blue-500/50' : ''}`}
            >
                <span className={selected ? 'text-slate-200' : 'text-slate-600'}>{displayLabel}</span>
                <ChevronDown
                    size={14}
                    className={`text-slate-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute z-50 mt-1.5 w-full min-w-max glass border border-white/10 rounded-xl shadow-2xl overflow-hidden
                    animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="py-1 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {options.map((opt, i) => {
                            const isSelected = String(opt.value) === String(value)
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    disabled={opt.disabled}
                                    onClick={() => handleSelect(opt)}
                                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors text-left
                                        ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                                        ${isSelected
                                            ? 'bg-blue-600/20 text-blue-400'
                                            : 'text-slate-300 hover:bg-white/8 hover:text-white'
                                        }`}
                                >
                                    <span>{opt.label}</span>
                                    {isSelected && <Check size={13} className="text-blue-400 flex-shrink-0" />}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
