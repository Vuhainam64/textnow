import { useRef } from 'react'
import { X, Terminal } from 'lucide-react'

/**
 * Resizable log panel docked at the bottom of the canvas
 */
export default function LogPanel({ show, logs, logHeight, setLogHeight, onClose, onClear }) {
    const dragRef = useRef(null)
    const logContainerRef = useRef(null)

    const handleDragStart = (e) => {
        e.preventDefault()
        dragRef.current = { startY: e.clientY, startH: logHeight }
        const onMove = ev => {
            const delta = dragRef.current.startY - ev.clientY
            const newH = Math.min(Math.max(dragRef.current.startH + delta, 120), window.innerHeight * 0.8)
            setLogHeight(newH)
        }
        const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }

    return (
        <aside
            className={`absolute bottom-0 left-0 right-0 z-20 glass border-t border-white/10 transition-[opacity] duration-300 ${show ? '' : 'opacity-0 pointer-events-none'}`}
            style={{ height: show ? `${logHeight}px` : 0 }}
        >
            {/* Drag handle */}
            <div
                className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-500/40 transition-colors z-10 group"
                onMouseDown={handleDragStart}
            >
                <div className="absolute left-1/2 -translate-x-1/2 top-0 w-10 h-1 rounded-full bg-white/20 group-hover:bg-blue-400/60 transition-colors" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 h-10 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-blue-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Kết quả chạy thử</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onClear} className="text-[10px] text-slate-500 hover:text-white transition-colors">Xoá log</button>
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={14} /></button>
                </div>
            </div>

            {/* Log entries */}
            <div
                ref={logContainerRef}
                className="p-4 h-[calc(100%-40px)] overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800"
            >
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700 select-none">
                        <Terminal size={32} className="mb-2 opacity-20" />
                        <p>Chưa có dữ liệu tiến trình...</p>
                    </div>
                ) : logs.map(log => (
                    <div key={log.id} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                        <span className="text-slate-600 shrink-0">[{log.time}]</span>
                        <span className={`
                            ${log.type === 'error' ? 'text-red-400' : ''}
                            ${log.type === 'success' ? 'text-emerald-400' : ''}
                            ${log.type === 'info' ? 'text-blue-400' : ''}
                            ${log.type === 'warning' ? 'text-amber-400' : ''}
                        `}>
                            {log.message}
                        </span>
                    </div>
                ))}
            </div>
        </aside>
    )
}
