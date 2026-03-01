/**
 * PageLoader.jsx - Loading spinner overlay
 *
 * Usage:
 *   <PageLoader />              // toàn trang
 *   <PageLoader inline />       // inline (không full screen)
 *   <PageLoader text="Đang lưu..." />
 */
import { Loader2 } from 'lucide-react'

export default function PageLoader({ text = 'Đang tải...', inline = false }) {
    if (inline) {
        return (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                <Loader2 size={18} className="animate-spin text-blue-400" />
                <span className="text-sm">{text}</span>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0f1117]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
                {/* Spinner ring */}
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 border-r-violet-500 border-b-transparent border-l-transparent animate-spin" />
                    <div className="absolute inset-[6px] rounded-full border-2 border-t-transparent border-r-transparent border-b-blue-400/50 border-l-violet-400/50 animate-spin [animation-direction:reverse] [animation-duration:0.8s]" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-semibold text-slate-200">{text}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Vui lòng chờ...</p>
                </div>
            </div>
        </div>
    )
}
