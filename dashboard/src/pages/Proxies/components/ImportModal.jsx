import { useState, useRef } from 'react'
import { FileText } from 'lucide-react'
import Modal from '../../../components/Modal'
import Select from '../../../components/Select'

export default function ProxyImportModal({ show, onClose, onImport, currentGroup }) {
    const [text, setText] = useState('')
    const [type, setType] = useState('http')
    const [status, setStatus] = useState('active')
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState(null)
    const fileRef = useRef(null)

    if (!show) return null

    const handleFile = (e) => {
        const file = e.target.files?.[0]; if (!file) return
        const reader = new FileReader()
        reader.onload = ev => setText(ev.target.result)
        reader.readAsText(file, 'utf-8')
        e.target.value = ''
    }

    const handleSubmit = async () => {
        setLoading(true)
        const ok = await onImport({ text, type, status, progress: setProgress })
        if (ok) { onClose(); setText(''); setProgress(null) }
        setLoading(false)
    }

    return (
        <Modal title="Nhập hàng loạt proxy" onClose={() => { onClose(); setText(''); setProgress(null) }}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-500 mb-1.5 block font-medium">Loại Proxy</label>
                        <Select value={type} onChange={e => setType(e.target.value)}>
                            <option value="http">HTTP</option>
                            <option value="https">HTTPS</option>
                            <option value="socks4">SOCKS4</option>
                            <option value="socks5">SOCKS5</option>
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1.5 block font-medium">Trạng thái</label>
                        <Select value={status} onChange={e => setStatus(e.target.value)}>
                            <option value="active">Hoạt động (Active)</option>
                            <option value="inactive">Chờ (Inactive)</option>
                        </Select>
                    </div>
                </div>

                {currentGroup && <p className="text-[11px] text-emerald-400">→ Proxy sẽ được thêm vào nhóm: <span className="underline font-semibold">{currentGroup.name}</span></p>}

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-xs text-slate-500 block font-medium">Danh sách Proxy *</label>
                            <p className="text-[10px] text-slate-600">Định dạng: <code className="text-blue-400">host:port:username:password</code> (mỗi proxy một dòng)</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {text && <span className="text-[10px] text-slate-500">{text.trim().split('\n').filter(Boolean).length.toLocaleString()} dòng</span>}
                            <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleFile} />
                            <button onClick={() => fileRef.current?.click()}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-[11px] hover:bg-white/10 transition-all">
                                <FileText size={11} /> Chọn file
                            </button>
                        </div>
                    </div>
                    <textarea rows={8} value={text} onChange={e => setText(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 resize-none scrollbar-thin scrollbar-thumb-slate-700 font-mono"
                        placeholder={"192.168.1.1:8080:user:pass\n10.0.0.1:3128"} />
                </div>

                {progress && (
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Batch {Math.ceil(progress.done / 500)}/{Math.ceil(progress.total / 500)}</span>
                            <span>{progress.inserted} đã nhập</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={() => { onClose(); setText('') }} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                    <button onClick={handleSubmit} disabled={loading || !text.trim()} className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 transition-all">
                        {loading ? 'Đang nhập...' : 'Nhập proxy'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
