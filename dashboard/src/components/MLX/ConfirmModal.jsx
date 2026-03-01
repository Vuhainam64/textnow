import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from '../Modal'
import { useT } from '../../lib/i18n'

export default function ConfirmModal({ title, description, danger = false, onConfirm, onClose }) {
    const t = useT()
    const [loading, setLoading] = useState(false)
    const run = async () => {
        setLoading(true)
        try { await onConfirm() } finally { setLoading(false); onClose() }
    }
    return (
        <Modal title={title} onClose={onClose}>
            <div className="space-y-4">
                {danger && (
                    <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 relative z-10">
                        <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
                        <p className="text-xs text-red-300 leading-relaxed font-medium">{description}</p>
                    </div>
                )}
                {!danger && <p className="text-sm text-slate-400">{description}</p>}
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">{t('common.cancel')}</button>
                    <button onClick={run} disabled={loading}
                        className={`px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-60 transition-all text-white
              ${danger ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'}`}>
                        {loading ? t('common.processing') : t('common.confirm')}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
