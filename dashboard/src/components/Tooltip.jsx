/**
 * Tooltip.jsx - Custom tooltip component với animation đẹp
 * 
 * Usage:
 * <Tooltip text="Nội dung tooltip">
 *   <button>Hover me</button>
 * </Tooltip>
 * 
 * Props:
 *   text      - string: nội dung tooltip
 *   position  - 'top' | 'bottom' | 'left' | 'right' (default: 'top')
 *   delay     - ms trước khi hiện (default: 300)
 */
import { useState, useRef } from 'react'

const POSITIONS = {
    top: {
        wrapper: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        arrow: 'top-full left-1/2 -translate-x-1/2 border-t-[5px] border-t-[#1e2536] border-x-[5px] border-x-transparent border-b-0',
    },
    bottom: {
        wrapper: 'top-full left-1/2 -translate-x-1/2 mt-2',
        arrow: 'bottom-full left-1/2 -translate-x-1/2 border-b-[5px] border-b-[#1e2536] border-x-[5px] border-x-transparent border-t-0',
    },
    left: {
        wrapper: 'right-full top-1/2 -translate-y-1/2 mr-2',
        arrow: 'left-full top-1/2 -translate-y-1/2 border-l-[5px] border-l-[#1e2536] border-y-[5px] border-y-transparent border-r-0',
    },
    right: {
        wrapper: 'left-full top-1/2 -translate-y-1/2 ml-2',
        arrow: 'right-full top-1/2 -translate-y-1/2 border-r-[5px] border-r-[#1e2536] border-y-[5px] border-y-transparent border-l-0',
    },
}

export default function Tooltip({ text, position = 'top', delay = 300, children }) {
    const [visible, setVisible] = useState(false)
    const timerRef = useRef(null)

    const show = () => {
        timerRef.current = setTimeout(() => setVisible(true), delay)
    }

    const hide = () => {
        clearTimeout(timerRef.current)
        setVisible(false)
    }

    const pos = POSITIONS[position] || POSITIONS.top

    return (
        <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
            {children}
            {visible && (
                <div className={`absolute z-[9999] pointer-events-none ${pos.wrapper}`}>
                    {/* Bubble */}
                    <div className="relative bg-[#1e2536] border border-white/10 rounded-lg px-2.5 py-1.5 shadow-xl shadow-black/40 whitespace-nowrap">
                        <span className="text-[11px] font-medium text-slate-200 leading-none">{text}</span>
                        {/* Arrow */}
                        <div className={`absolute w-0 h-0 ${pos.arrow}`} />
                    </div>
                </div>
            )}
        </div>
    )
}
