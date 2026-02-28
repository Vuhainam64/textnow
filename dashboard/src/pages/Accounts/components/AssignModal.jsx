import { useState } from 'react'
import { Check } from 'lucide-react'
import Modal from '../../../components/Modal'
import Select from '../../../components/Select'
import { GROUP_COLORS, inputCls } from '../../../lib/ui'

export default function AssignModal({ show, onClose, ungroupedCount, groups, onConfirm }) {
    const [form, setForm] = useState({ mode: 'existing', group_id: '', name: '', description: '', color: '#3b82f6', count: '' })
    const [loading, setLoading] = useState(false)

    if (!show) return null

    const handleConfirm = async () => {
        setLoading(true)
        try {
            const ok = await onConfirm(form)
            if (ok) { onClose(); setForm({ mode: 'existing', group_id: '', name: '', description: '', color: '#3b82f6', count: '' }) }
        } finally { setLoading(false) }
    }

    return (
        <Modal title="Phân nhóm tài khoản chưa có nhóm" onClose={onClose}>
            <div className="space-y-4">
                <p className="text-sm text-slate-400">Hiện có <span className="text-white font-medium">{ungroupedCount}</span> tài khoản chưa có nhóm.</p>

                <div className="flex gap-2">
                    {[{ v: 'existing', label: 'Vào nhóm có sẵn' }, { v: 'new', label: 'Tạo nhóm mới' }].map(opt => (
                        <button key={opt.v} onClick={() => setForm(f => ({ ...f, mode: opt.v }))}
                            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all
                                ${form.mode === opt.v ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>

                {form.mode === 'existing' ? (
                    <div>
                        <label className="text-xs text-slate-500 mb-1.5 block font-medium">Chọn nhóm</label>
                        <Select value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}>
                            <option value="">— Chọn nhóm —</option>
                            {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                        </Select>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Tên nhóm mới *</label>
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="VD: T1, Spam..." />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Mô tả</label>
                            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Mô tả nhóm..." />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Màu nhóm</label>
                            <div className="flex gap-2 flex-wrap">
                                {GROUP_COLORS.map(c => (
                                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                                        className="w-6 h-6 rounded-full flex items-center justify-center ring-2 ring-offset-2 ring-offset-slate-900 transition-all"
                                        style={{ backgroundColor: c, ringColor: form.color === c ? c : 'transparent' }}>
                                        {form.color === c && <Check size={10} className="text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div>
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium">
                        Số lượng tài khoản <span className="text-slate-600">(bỏ trống = tất cả)</span>
                    </label>
                    <input type="number" value={form.count} onChange={e => setForm(f => ({ ...f, count: e.target.value }))}
                        className={inputCls} placeholder={`Tối đa ${ungroupedCount}`} min="1" max={ungroupedCount} />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                    <button onClick={handleConfirm} disabled={loading}
                        className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 transition-all">
                        {loading ? 'Đang gán...' : 'Gán vào nhóm'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
