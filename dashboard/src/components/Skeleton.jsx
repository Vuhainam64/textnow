/**
 * Skeleton.jsx - Loading placeholder components
 *
 * Usage:
 *   <Skeleton />                          // 1 dòng full width
 *   <Skeleton width="60%" height={12} />  // custom size
 *   <Skeleton.Card />                     // card placeholder
 *   <Skeleton.Table rows={5} cols={4} />  // table placeholder
 *   <Skeleton.Avatar />                   // circular avatar
 *   <Skeleton.Stat />                     // stat card placeholder
 */

const pulse = 'animate-pulse bg-white/[0.06] rounded-lg'

// ── Base Skeleton ──────────────────────────────────────────────────────────
function Skeleton({ width = '100%', height = 14, className = '' }) {
    return (
        <div
            className={`${pulse} ${className}`}
            style={{ width, height }}
        />
    )
}

// ── Avatar (circle) ────────────────────────────────────────────────────────
Skeleton.Avatar = function SkeletonAvatar({ size = 36 }) {
    return (
        <div
            className={`${pulse} rounded-full flex-shrink-0`}
            style={{ width: size, height: size }}
        />
    )
}

// ── Text lines ─────────────────────────────────────────────────────────────
Skeleton.Text = function SkeletonText({ lines = 3, lastWidth = '60%' }) {
    return (
        <div className="space-y-2.5 w-full">
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className={`${pulse} h-3`}
                    style={{ width: i === lines - 1 ? lastWidth : '100%' }}
                />
            ))}
        </div>
    )
}

// ── Stat card ──────────────────────────────────────────────────────────────
Skeleton.Stat = function SkeletonStat() {
    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
                <div className={`${pulse} h-3 w-24`} />
                <div className={`${pulse} w-9 h-9 rounded-xl`} />
            </div>
            <div className={`${pulse} h-8 w-32`} />
            <div className={`${pulse} h-2.5 w-20`} />
        </div>
    )
}

// ── Table rows ─────────────────────────────────────────────────────────────
Skeleton.Table = function SkeletonTable({ rows = 5, cols = 5 }) {
    return (
        <div className="space-y-2">
            {/* Header */}
            <div className="flex gap-3 px-4 py-2">
                {Array.from({ length: cols }).map((_, i) => (
                    <div key={i} className={`${pulse} h-3 flex-1`} />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, row) => (
                <div
                    key={row}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5"
                >
                    {Array.from({ length: cols }).map((_, col) => (
                        <div
                            key={col}
                            className={`${pulse} h-3 flex-1`}
                            style={{ width: `${60 + Math.random() * 40}%`, maxWidth: '100%' }}
                        />
                    ))}
                </div>
            ))}
        </div>
    )
}

// ── Card ───────────────────────────────────────────────────────────────────
Skeleton.Card = function SkeletonCard() {
    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
                <Skeleton.Avatar size={40} />
                <div className="flex-1 space-y-2">
                    <div className={`${pulse} h-3.5 w-3/4`} />
                    <div className={`${pulse} h-2.5 w-1/2`} />
                </div>
            </div>
            <Skeleton.Text lines={3} />
        </div>
    )
}

// ── Page loader (full screen) ───────────────────────────────────────────────
Skeleton.Page = function SkeletonPage({ title = 'Đang tải...' }) {
    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className={`${pulse} h-6 w-48`} />
                    <div className={`${pulse} h-3 w-64`} />
                </div>
                <div className={`${pulse} h-10 w-28 rounded-xl`} />
            </div>
            <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton.Stat key={i} />)}
            </div>
            <Skeleton.Table rows={6} cols={5} />
        </div>
    )
}

export default Skeleton
