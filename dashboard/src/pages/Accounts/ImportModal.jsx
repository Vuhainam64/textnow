import { useRef } from 'react'
import { FileText } from 'lucide-react'
import Modal from '../../components/Modal'

export default function AccountImportModal({
    show, onClose,
    importText, setImportText,
    importLoading, importProgress,
    onImport, currentGroup,
}) {
    const fileInputRef = useRef(null)

    if (!show) return null

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => setImportText(ev.target.result)
        reader.readAsText(file, 'utf-8')
        e.target.value = ''
    }

    const lineCount = importText ? importText.trim().split('\n').filter(Boolean).length : 0

    return (
        <Modal title="Nhập hàng loạt tài khoản" onClose={() => { onClose(); setImportText(''); }}>
            <div className="space-y-3">
                {/* Format hint */}
                <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-2">
                    <p className="text-[11px] text-slate-400 font-medium">
                        Hỗ trợ 2 định dạng (dùng dấu <code className="text-blue-400 font-bold">|</code> để ngăn cách):
                    </p>
                    <ul className="text-[10px] text-slate-500 space-y-1 list-disc pl-4">
                        <li><span className="text-slate-300">6 cột:</span> <code className="text-blue-400/80">tn_user|tn_pass|hm_user|hm_pass|hm_token|client_id</code></li>
                        <li><span className="text-slate-300">4 cột:</span> <code className="text-blue-400/80">hm_user|hm_pass|hm_token|client_id</code> (Tự động lấy hm làm tn)</li>
                    </ul>
                    {currentGroup && (
                        <p className="text-[10px] text-emerald-400 font-medium pt-1">
                            → Tài khoản sẽ được thêm vào nhóm: <span className="underline">{currentGroup.name}</span>
                        </p>
                    )}
                </div>

                {/* File picker + line count */}
                <div className="flex items-center gap-2">
                    <input ref={fileInputRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleFileSelect} />
                    <button onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-xs hover:bg-white/10 transition-all">
                        <FileText size={13} /> Chọn file .txt
                    </button>
                    {importText && (
                        <span className="text-xs text-slate-500">{lineCount.toLocaleString()} dòng</span>
                    )}
                </div>

                <textarea rows={10} value={importText} onChange={e => setImportText(e.target.value)}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-blue-500/40 resize-none scrollbar-thin scrollbar-thumb-slate-800"
                    placeholder={"user|pass|email@hotmail.com|pass|token|clientid\nemail@hotmail.com|pass|token|clientid"} />

                {/* Progress bar */}
                {importProgress && (
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Batch {Math.ceil(importProgress.done / 500)}/{Math.ceil(importProgress.total / 500)}</span>
                            <span>{importProgress.inserted} đã nhập</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }} />
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={() => { onClose(); setImportText(''); }}
                        className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                    <button onClick={onImport} disabled={importLoading || !importText.trim()}
                        className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 transition-all">
                        {importLoading ? `Đang nhập...` : `Nhập tài khoản`}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
