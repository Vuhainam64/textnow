import { Download } from 'lucide-react'
import Modal from '../../components/Modal'
import { STATUS_MAP } from '../../lib/ui'
import { useT } from '../../lib/i18n'

const STATUS_I18N_KEY = {
    'active': 'active', 'inactive': 'inactive', 'banned': 'banned',
    'dead': 'dead', 'pending': 'pending', 'die_mail': 'die_mail',
    'no_mail': 'no_mail', 'captcha': 'captcha', 'Reset Error': 'reset_error', 'verified': 'verified',
}

export default function AccountExportModal({
    show, onClose,
    exportStatus, setExportStatus,
    exportDeleteAfter, setExportDeleteAfter,
    exportLoading, onExport,
    currentGroup,
}) {
    const t = useT()
    if (!show) return null

    return (
        <Modal title={t('accounts.exportAccounts')} onClose={onClose}>
            <div className="space-y-4">
                {/* Status filter */}
                <div>
                    <label className="text-xs text-slate-500 mb-2 block font-medium">
                        {t('accounts.filterByStatus')} <span className="text-slate-600">({t('accounts.emptyMeansAll')})</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {['pending', 'active', 'inactive', 'banned', 'die_mail', 'no_mail', 'verified', 'Reset Error'].map(s => {
                            const cfg = STATUS_MAP[s] || { label: s }
                            const active = exportStatus.includes(s)
                            const i18nKey = STATUS_I18N_KEY[s]
                            const label = i18nKey ? t(`status.${i18nKey}`) : cfg.label
                            return (
                                <button key={s}
                                    onClick={() => setExportStatus(prev =>
                                        active ? prev.filter(x => x !== s) : [...prev, s]
                                    )}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${active
                                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}>
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {currentGroup && (
                    <p className="text-[11px] text-emerald-400">
                        → {t('accounts.exportFromGroup')}: <span className="font-semibold">{currentGroup.name}</span>
                    </p>
                )}

                {/* Delete-after toggle */}
                <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:border-white/20 border-white/10">
                    <div
                        className={`w-9 h-5 rounded-full transition-colors relative ${exportDeleteAfter ? 'bg-red-500' : 'bg-white/10'}`}
                        onClick={() => setExportDeleteAfter(v => !v)}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${exportDeleteAfter ? 'translate-x-4' : ''}`} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-200">{t('accounts.exportThenDelete')}</p>
                        <p className="text-[11px] text-slate-500">{t('accounts.exportThenDeleteDesc')}</p>
                    </div>
                </label>

                {exportDeleteAfter && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                        ⚠️ {t('accounts.exportDeleteWarning')}
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                    <button onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">{t('common.cancel')}</button>
                    <button onClick={onExport} disabled={exportLoading}
                        className={`px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-all flex items-center gap-2 ${exportDeleteAfter ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                        {exportLoading
                            ? t('accounts.exporting')
                            : <><Download size={14} /> {t('common.export')}{exportDeleteAfter ? ` & ${t('common.delete')}` : ''}</>}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
