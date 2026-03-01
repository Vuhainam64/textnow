/**
 * PageLoader.jsx - Loading với logo sidebar
 *
 * Usage:
 *   <PageLoader />                     // overlay toàn màn hình
 *   <PageLoader inline />              // inline trong content
 *   <PageLoader text="Đang lưu..." />  // custom text
 */
import { Zap } from 'lucide-react'

function LogoSpinner({ size = 'md' }) {
    const sizes = {
        sm: { outer: 'w-12 h-12', logo: 'w-8 h-8 rounded-xl', icon: 14 },
        md: { outer: 'w-20 h-20', logo: 'w-12 h-12 rounded-2xl', icon: 22 },
        lg: { outer: 'w-28 h-28', logo: 'w-16 h-16 rounded-2xl', icon: 30 },
    }
    const s = sizes[size] || sizes.md

    return (
        <div className={`relative ${s.outer} flex items-center justify-center`}>
            {/* Outer spin ring - blue → violet gradient */}
            <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 80 80">
                <defs>
                    <linearGradient id="spinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                </defs>
                <circle
                    cx="40" cy="40" r="36"
                    fill="none"
                    stroke="url(#spinGrad)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="180 40"
                />
            </svg>

            {/* Inner counter-spin ring - subtle */}
            <svg className="absolute inset-[6px] w-[calc(100%-12px)] h-[calc(100%-12px)] animate-spin [animation-direction:reverse] [animation-duration:1.5s]" viewBox="0 0 60 60">
                <circle
                    cx="30" cy="30" r="26"
                    fill="none"
                    stroke="rgba(139,92,246,0.25)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray="60 120"
                />
            </svg>

            {/* Logo center */}
            <div className={`${s.logo} bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-xl shadow-blue-500/40 animate-pulse`}>
                <Zap size={s.icon} className="text-white fill-white" />
            </div>
        </div>
    )
}

export default function PageLoader({ text = 'Đang tải...', inline = false, size = 'md' }) {
    if (inline) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
                <LogoSpinner size="sm" />
                <p className="text-sm text-slate-500 font-medium">{text}</p>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0f1117]/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex flex-col items-center gap-5">
                <LogoSpinner size={size} />
                <div className="text-center">
                    <p className="text-sm font-semibold text-slate-200 tracking-wide">{text}</p>
                    <p className="text-[11px] text-slate-600 mt-1">Vui lòng chờ...</p>
                </div>
            </div>
        </div>
    )
}

export { LogoSpinner }
