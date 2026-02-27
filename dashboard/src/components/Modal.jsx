import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, width = 'max-w-lg' }) {
    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className={`glass rounded-2xl border border-white/10 w-full ${width} shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                    <div className="flex items-center justify-between p-5 border-b border-white/5">
                        <h3 className="font-semibold text-white">{title}</h3>
                        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="p-5 max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}
