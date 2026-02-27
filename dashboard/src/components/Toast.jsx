import { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, XCircle, Info, X } from 'lucide-react'

// Singleton-like state management for Toast
let toastRef = null

// Strip leading emoji / icon characters from message
const stripEmoji = (msg) =>
    typeof msg === 'string'
        ? msg.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FFFF}✅❌⚠️🔍🛑🚨✨🔄👤ℹ️➕➖✔️\s]+/u, '').trim()
        : msg;

export const showToast = (message, type = 'success') => {
    if (toastRef) toastRef(stripEmoji(message), type)
}

export default function Toast() {
    const [toast, setToast] = useState(null)

    useEffect(() => {
        toastRef = (msg, type) => {
            setToast({ msg, type, id: Date.now() })
        }
    }, [])

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [toast])

    if (!toast) return null

    const CONFIG = {
        success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
        error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
        warning: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
        info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    }

    const { icon: Icon, color, bg, border } = CONFIG[toast.type] || CONFIG.success

    return (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-right-10 fade-in duration-300">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl ${bg} ${border}`}>
                <Icon size={18} className={color} />
                <span className="text-sm font-medium text-slate-200 pr-2">{toast.msg}</span>
                <button onClick={() => setToast(null)} className="text-slate-500 hover:text-white transition-colors">
                    <X size={14} />
                </button>
            </div>
        </div>
    )
}
