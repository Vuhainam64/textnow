import { STATUS_MAP } from '../lib/ui'

export default function StatusBadge({ status }) {
    const s = STATUS_MAP[status] || STATUS_MAP.pending
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.bg} ${s.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
        </span>
    )
}
