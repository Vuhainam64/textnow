import { useState, useEffect } from 'react'
import { Save, X, Loader2, Info } from 'lucide-react'
import Modal from './Modal'
import { ConfigService } from '../services/apiService'
import { showToast } from './Toast'

export default function SettingsModal({ onClose }) {
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const loadEnv = async () => {
            try {
                const res = await ConfigService.getEnv()
                setContent(res.data?.content || res.content || '')
            } catch (e) {
                showToast('Không thể tải file .env', 'error')
            } finally {
                setLoading(false)
            }
        }
        loadEnv()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await ConfigService.updateEnv(content)
            showToast('Đã lưu cấu hình. Hãy khởi động lại Backend console để áp dụng.')
            onClose()
        } catch (e) {
            showToast(e.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title="Cấu hình hệ thống (.env)" onClose={onClose} width="max-w-2xl">
            <div className="space-y-4">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex gap-3 text-blue-400">
                    <Info size={18} className="shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                        <p className="font-bold mb-1 uppercase tracking-wider">Lưu ý quan trọng:</p>
                        <p>Việc chỉnh sửa file .env trực tiếp có thể gây lỗi hệ thống nếu định dạng không đúng. Sau khi lưu, bạn <b>phải khởi động lại Console của Backend</b> để các thay đổi có hiệu lực.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="h-64 flex items-center justify-center text-slate-500">
                        <Loader2 className="animate-spin mr-2" size={20} />
                        Đang tải nội dung...
                    </div>
                ) : (
                    <div className="relative group">
                        <textarea
                            spellCheck={false}
                            className="w-full h-80 bg-[#0f1117] border border-white/10 rounded-xl p-4 font-mono text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 transition-all resize-none scrollbar-thin scrollbar-thumb-slate-800"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="# Biến môi trường..."
                        />
                        <div className="absolute top-2 right-2 px-2 py-1 rounded bg-white/5 text-[10px] text-slate-500 font-bold uppercase pointer-events-none">
                            Editable
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-white/5 transition-all"
                    >
                        Đóng
                    </button>
                    <button
                        disabled={loading || saving}
                        onClick={handleSave}
                        className="flex items-center gap-2 px-8 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Lưu cấu hình
                    </button>
                </div>
            </div>
        </Modal>
    )
}
