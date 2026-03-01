import { useT } from '../lib/i18n'
import { STATUS_MAP } from '../lib/ui'

// Map status keys → locale keys (handles special cases like 'Reset Error')
const STATUS_I18N_KEY = {
    'active': 'active',
    'inactive': 'inactive',
    'banned': 'banned',
    'dead': 'dead',
    'pending': 'pending',
    'die_mail': 'die_mail',
    'no_mail': 'no_mail',
    'captcha': 'captcha',
    'Reset Error': 'reset_error',
    'verified': 'verified',
}

export default function StatusBadge({ status }) {
    const t = useT()
    const s = STATUS_MAP[status] || STATUS_MAP.pending
    const i18nKey = STATUS_I18N_KEY[status]
    const label = i18nKey ? t(`status.${i18nKey}`) : (s.label || status)
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.bg} ${s.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {label}
        </span>
    )
}
