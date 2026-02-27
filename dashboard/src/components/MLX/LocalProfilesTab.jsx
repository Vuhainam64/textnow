import { useEffect, useState, useCallback } from 'react'
import {
    Monitor, RefreshCw, Trash2, HardDrive,
    Search, ChevronLeft, ChevronRight, ZapOff
} from 'lucide-react'
import { MLXService } from '../../services/apiService'
import ConfirmModal from './ConfirmModal'
import { showToast } from '../Toast'

export default function LocalProfilesTab() {
    const [profiles, setProfiles] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [clearingAll, setClearingAll] = useState(false)

    const fetchLocalProfiles = useCallback(async () => {
        setLoading(true)
        try {
            const res = await MLXService.getLocalProfiles()
            if (res.success) {
                setProfiles(res.data || [])
            }
        } catch (e) {
            showToast('Không thể tải danh sách profile local', 'error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchLocalProfiles() }, [fetchLocalProfiles])

    const handleDeleteOne = async (id) => {
        try {
            await MLXService.deleteLocalProfile(id)
            showToast('Đã xoá profile local')
            fetchLocalProfiles()
        } catch (e) {
            showToast(e.message, 'error')
        } finally {
            setDeleteTarget(null)
        }
    }

    const handleClearAll = async () => {
        setClearingAll(true)
        try {
            const res = await MLXService.clearLocalProfiles()
            showToast(res.message || 'Đã dọn dẹp tất cả profile local')
            fetchLocalProfiles()
        } catch (e) {
            showToast(e.message, 'error')
        } finally {
            setClearingAll(false)
        }
    }

    const filteredProfiles = profiles.filter(p =>
        p.id.toLowerCase().includes(search.toLowerCase())
    )

    const totalSize = profiles.reduce((acc, p) => acc + (p.size || 0), 0)

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <div className="space-y-4">
            {deleteTarget && (
                <ConfirmModal
                    title="Xoá Profile Local"
                    description={`Bạn có chắc chắn muốn xoá vĩnh viễn thư mục profile ${deleteTarget} dưới máy? Hành động này không xoá profile trên cloud.`}
                    danger
                    onConfirm={() => handleDeleteOne(deleteTarget)}
                    onClose={() => setDeleteTarget(null)}
                />
            )}

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                    <p className="text-sm text-slate-500">
                        Thư mục: <span className="text-slate-300 font-medium">{profiles.length}</span> folders
                        <span className="mx-2 text-slate-700">|</span>
                        Dung lượng: <span className="text-amber-400 font-bold">{formatSize(totalSize)}</span>
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm ID profile..."
                            className="pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 w-full sm:w-44 transition-all"
                        />
                    </div>

                    <button onClick={handleClearAll} disabled={clearingAll || profiles.length === 0}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-30">
                        {clearingAll ? <RefreshCw size={13} className="animate-spin" /> : <ZapOff size={13} />}
                        Dọn dẹp tất cả
                    </button>

                    <button onClick={fetchLocalProfiles} disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Làm mới
                    </button>
                </div>
            </div>

            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Profile ID</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Dung lượng</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Đường dẫn</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-24">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-3/4" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-20 ml-auto" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-full" /></td>
                                        <td className="px-6 py-4"><div className="h-8 w-8 bg-white/5 rounded-lg mx-auto" /></td>
                                    </tr>
                                ))
                            ) : filteredProfiles.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                                <HardDrive size={20} className="text-slate-600" />
                                            </div>
                                            <p className="text-slate-500 text-sm italic">Không có thư mục profile local nào</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredProfiles.map(p => (
                                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4 font-mono text-xs text-blue-400">{p.id}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 text-xs font-bold border border-amber-500/20">
                                                {p.size_formatted}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[10px] text-slate-500 truncate max-w-xs" title={p.path}>
                                                {p.path}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => setDeleteTarget(p.id)}
                                                className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all mx-auto shadow-sm"
                                                title="Xoá local"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <HardDrive size={16} className="text-amber-500" />
                </div>
                <div className="text-xs text-slate-400 leading-relaxed pt-1">
                    <p className="font-bold text-amber-500 mb-1 uppercase tracking-wider">Thông tin lưu ý:</p>
                    <p>Danh sách này hiển thị các thư mục profile MLX thực tế đang chiếm dụng ổ cứng của bạn. Việc dọn dẹp ở đây sẽ <b>không xoá</b> profile trên hệ thống MLX Cloud, nhưng sẽ giải phóng dung lượng đĩa do cache và dữ liệu duyệt web local của profile đó sinh ra.</p>
                </div>
            </div>
        </div>
    )
}
