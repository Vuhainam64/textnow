import { useState, useEffect, useCallback } from 'react'
import {
    Play, Settings2, History, RotateCcw,
    ShieldCheck, Key, ShieldAlert, Clock,
    MousePointer2, Layers, Filter, CheckCircle2,
    XCircle, Info, ChevronRight, PlayCircle, Loader2
} from 'lucide-react'
import { AccountsService, ProxiesService, TasksService } from '../services/apiService'
import Select from '../components/Select'
import { inputCls, STATUS_MAP } from '../lib/ui'
import { showToast } from '../components/Toast'

const TASK_TYPES = [
    { id: 'reset_pass', label: 'Reset Password', icon: Key, color: 'text-blue-400', desc: 'Đổi mật khẩu tài khoản qua Hotmail' },
    { id: 'send_sms', label: 'Gửi SMS', icon: Play, color: 'text-emerald-400', desc: 'Gửi tin nhắn TextNow theo danh sách' },
    { id: 'warmup', label: 'Nuôi tài khoản', icon: ShieldCheck, color: 'text-violet-400', desc: 'Tương tác nhẹ để tăng độ tin cậy' },
]

export default function Tasks() {
    const [selectedType, setSelectedType] = useState('reset_pass')
    const [accountGroups, setAccountGroups] = useState([])
    const [proxyGroups, setProxyGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)

    // Account stats state
    const [statusCounts, setStatusCounts] = useState({})
    const [matchingCount, setMatchingCount] = useState(0)

    // Form states for Reset Pass
    const [resetConfig, setResetConfig] = useState({
        account_group_id: '',
        target_statuses: ['active', 'pending'],
        proxy_group_id: '',
        new_password: localStorage.getItem('task_new_password') || '',
        captcha_retries: 3,
        captcha_timeout: 60,
        flow_timeout: 300,
        threads: 5,
        startup_delay: 5,
    })

    const fetchAccountStats = useCallback(async (groupId) => {
        if (!groupId) {
            setStatusCounts({});
            return;
        }
        try {
            const res = await AccountsService.getStats({ group_id: groupId })
            const statsMap = {}
            if (res.success && res.data?.stats) {
                res.data.stats.forEach(s => statsMap[s._id] = s.count)
            }
            setStatusCounts(statsMap)
        } catch (e) { console.error('Stats error:', e) }
    }, [])

    const loadData = useCallback(async () => {
        try {
            const [accRes, proxyRes] = await Promise.all([
                AccountsService.getGroups(),
                ProxiesService.getGroups()
            ])
            setAccountGroups(accRes.data || [])
            setProxyGroups(proxyRes.data || [])

            // Set default groups if available
            if (accRes.data?.length > 0) {
                const gid = accRes.data[0]._id
                setResetConfig(prev => ({ ...prev, account_group_id: gid }))
                fetchAccountStats(gid)
            }
            if (proxyRes.data?.length > 0) setResetConfig(prev => ({ ...prev, proxy_group_id: proxyRes.data[0]._id }))

        } catch (error) {
            console.error('Failed to load initial data:', error)
        } finally {
            setLoading(false)
        }
    }, [fetchAccountStats])

    useEffect(() => { loadData() }, [loadData])

    // Fetch stats when account_group_id changes
    useEffect(() => {
        fetchAccountStats(resetConfig.account_group_id)
    }, [resetConfig.account_group_id, fetchAccountStats])

    // Update matching count whenever target_statuses or statusCounts changes
    useEffect(() => {
        const total = resetConfig.target_statuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0)
        setMatchingCount(total)
    }, [resetConfig.target_statuses, statusCounts])

    const handleRunTask = async () => {
        if (!resetConfig.new_password.trim()) {
            showToast('Bạn chưa nhập mật khẩu mới', 'warning')
            return
        }
        if (matchingCount === 0) {
            showToast('Không có tài khoản nào thoả mãn điều kiện chạy', 'warning')
            return
        }

        localStorage.setItem('task_new_password', resetConfig.new_password)

        setRunning(true)
        try {
            const res = await TasksService.runTask(selectedType, resetConfig)
            showToast(`✅ ${res.message} (Dự kiến: ${res.estimate_accounts} accounts)`)
        } catch (err) {
            showToast(err.response?.data?.error || err.message, 'error')
        } finally {
            setRunning(false)
        }
    }

    const toggleStatus = (status) => {
        setResetConfig(prev => {
            const current = prev.target_statuses
            if (current.includes(status)) {
                return { ...prev, target_statuses: current.filter(s => s !== status) }
            } else {
                return { ...prev, target_statuses: [...current, status] }
            }
        })
    }

    return (
        <div className="flex gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* --- TASK LIST SIDEBAR --- */}
            <aside className="w-72 flex-shrink-0 space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <Layers size={18} />
                    </div>
                    <h2 className="text-lg font-bold text-white">Danh sách Task</h2>
                </div>

                <div className="space-y-2">
                    {TASK_TYPES.map(type => {
                        const Icon = type.icon
                        const isActive = selectedType === type.id
                        return (
                            <button
                                key={type.id}
                                onClick={() => setSelectedType(type.id)}
                                className={`w-full group relative flex flex-col gap-1 p-4 rounded-2xl border transition-all text-left
                                    ${isActive
                                        ? 'bg-blue-600/10 border-blue-500/40 text-blue-400 shadow-lg shadow-blue-500/5'
                                        : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10 hover:bg-white/8'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${isActive ? 'bg-blue-500/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                                        <Icon size={18} className={isActive ? 'text-blue-400' : 'text-slate-500'} />
                                    </div>
                                    <span className="font-semibold text-sm">{type.label}</span>
                                    {isActive && <ChevronRight size={14} className="ml-auto opacity-50" />}
                                </div>
                                <p className={`text-[11px] mt-2 leading-relaxed ${isActive ? 'text-blue-400/70' : 'text-slate-500'}`}>
                                    {type.desc}
                                </p>
                            </button>
                        )
                    })}
                </div>

                {/* Info Card */}
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400">
                        <Info size={14} />
                        <span className="text-xs font-bold uppercase tracking-wider">Lưu ý</span>
                    </div>
                    <p className="text-[11px] text-amber-400/70 leading-relaxed">
                        Các task tự động hoá sẽ được đưa vào hàng đợi xử lý. Bạn có thể theo dõi tiến độ ở tab Lịch sử.
                    </p>
                </div>
            </aside>

            {/* --- TASK CONFIG FORM --- */}
            <main className="flex-1 min-w-0">
                <div className="glass rounded-3xl border border-white/5 h-full flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-white/5 bg-white/3 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-blue-400 mb-1">
                                <Settings2 size={16} />
                                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/10">Cấu hình</span>
                            </div>
                            <h1 className="text-2xl font-bold text-white">
                                {TASK_TYPES.find(t => t.id === selectedType)?.label}
                            </h1>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <button
                                onClick={handleRunTask}
                                disabled={running || matchingCount === 0}
                                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="white" />}
                                {running ? 'ĐANG CHẠY...' : 'CHẠY NGAY'}
                            </button>
                            {matchingCount > 0 && !running && (
                                <span className="text-[10px] text-emerald-400 font-bold animate-pulse">
                                    Dự kiến xử lý: {matchingCount} tài khoản
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Form Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">

                        {/* 1. Account Selection */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-slate-200">
                                <ShieldCheck size={18} className="text-blue-400" />
                                <h3 className="font-bold">Đối tượng tài khoản</h3>
                            </div>
                            <div className="space-y-6">
                                {/* Account Group Select */}
                                <div>
                                    <label className="text-xs text-slate-500 mb-2 block font-medium">Nhóm tài khoản mục tiêu</label>
                                    <Select
                                        options={accountGroups.map(g => ({ value: g._id, label: `${g.name} (${g.account_count})` }))}
                                        value={resetConfig.account_group_id}
                                        onChange={e => setResetConfig({ ...resetConfig, account_group_id: e.target.value })}
                                        className="w-full"
                                    />
                                </div>

                                {/* Status Filters */}
                                <div>
                                    <label className="text-xs text-slate-500 mb-2 block font-medium">Trạng thái tài khoản được phép chạy</label>
                                    <div className="flex flex-wrap gap-2">
                                        {Array.from(new Set([...Object.keys(STATUS_MAP), ...Object.keys(statusCounts)])).map(status => {
                                            const config = STATUS_MAP[status] || { label: status, dot: 'bg-slate-500' }
                                            const isSelected = resetConfig.target_statuses.includes(status)
                                            const count = statusCounts[status] || 0

                                            // Only hide if count is 0 AND it's not a standard status OR it's a standard status but doesn't exist in this group and not selected
                                            // Actually simpler: if count > 0 OR it's in target_statuses, show it. 
                                            // Or just show all standard ones + ones with count > 0.
                                            if (count === 0 && !Object.keys(STATUS_MAP).includes(status) && !isSelected) return null

                                            return (
                                                <button
                                                    key={status}
                                                    onClick={() => toggleStatus(status)}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                                                        ${isSelected
                                                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                                                            : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-400 hover:bg-white/10'
                                                        }`}
                                                >
                                                    <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                                                    <span>{config.label}</span>
                                                    <span className={`px-1.5 rounded-md text-[10px] font-bold ${isSelected ? 'bg-blue-500/30' : 'bg-white/5 text-slate-600'}`}>
                                                        {count}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-white/5" />

                        {/* 2. Proxy Selection */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-slate-200">
                                <RotateCcw size={18} className="text-emerald-400" />
                                <h3 className="font-bold">Hạ tầng Proxy</h3>
                            </div>
                            <div className="max-w-md">
                                <label className="text-xs text-slate-500 mb-2 block font-medium">Nhóm Proxy sẽ sử dụng</label>
                                <Select
                                    value={resetConfig.proxy_group_id}
                                    onChange={e => setResetConfig({ ...resetConfig, proxy_group_id: e.target.value })}
                                >
                                    {proxyGroups.map(g => <option key={g._id} value={g._id}>{g.name} ({g.proxy_count} proxy)</option>)}
                                </Select>
                                <p className="text-[10px] text-slate-500 mt-2 italic">
                                    * Các profile MLX sẽ được gán proxy ngẫu nhiên từ nhóm này trước khi chạy.
                                </p>
                            </div>
                        </section>

                        <div className="h-px bg-white/5" />

                        {/* 3. Task Parameters */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-slate-200">
                                <MousePointer2 size={18} className="text-amber-400" />
                                <h3 className="font-bold">Tham số thực thi</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                                {/* Row 1: Password & Threads */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block font-medium flex items-center gap-1.5">
                                            <Key size={13} className="text-blue-400" /> Mật khẩu mới <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={resetConfig.new_password}
                                            onChange={e => setResetConfig({ ...resetConfig, new_password: e.target.value })}
                                            className={inputCls}
                                            placeholder="Nhập mật khẩu muốn đổi..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block font-medium flex items-center gap-1.5">
                                            <Layers size={13} className="text-purple-400" /> Số luồng chạy đồng thời
                                        </label>
                                        <input
                                            type="number"
                                            value={resetConfig.threads}
                                            onChange={e => setResetConfig({ ...resetConfig, threads: parseInt(e.target.value) || 1 })}
                                            className={inputCls}
                                            min="1" max="50"
                                        />
                                    </div>
                                </div>

                                {/* Row 2: Captcha & Delay */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block font-medium flex items-center gap-1.5">
                                            <ShieldAlert size={13} className="text-amber-400" /> Giải Captcha (Lần thử / Timeout)
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24">
                                                <input
                                                    type="number"
                                                    value={resetConfig.captcha_retries}
                                                    onChange={e => setResetConfig({ ...resetConfig, captcha_retries: parseInt(e.target.value) || 0 })}
                                                    className={inputCls}
                                                    min="0" max="10"
                                                    title="Số lần thử"
                                                />
                                            </div>
                                            <div className="flex-1 relative">
                                                <input
                                                    type="number"
                                                    value={resetConfig.captcha_timeout}
                                                    onChange={e => setResetConfig({ ...resetConfig, captcha_timeout: parseInt(e.target.value) || 0 })}
                                                    className={inputCls}
                                                    min="10" max="300"
                                                    placeholder="Giây"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 pointer-events-none">giây</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block font-medium flex items-center gap-1.5">
                                            <PlayCircle size={13} className="text-emerald-400" /> Delay khởi động luồng (giây)
                                        </label>
                                        <input
                                            type="number"
                                            value={resetConfig.startup_delay}
                                            onChange={e => setResetConfig({ ...resetConfig, startup_delay: parseInt(e.target.value) || 0 })}
                                            className={inputCls}
                                            min="0" max="60"
                                        />
                                    </div>
                                </div>

                                {/* Row 3: Total Timeout */}
                                <div className="col-span-2">
                                    <label className="text-xs text-slate-500 mb-2 block font-medium flex items-center gap-1.5">
                                        <Clock size={13} className="text-rose-400" /> Thời gian tối đa toàn bộ luồng (giây)
                                    </label>
                                    <input
                                        type="number"
                                        value={resetConfig.flow_timeout}
                                        onChange={e => setResetConfig({ ...resetConfig, flow_timeout: parseInt(e.target.value) || 0 })}
                                        className={inputCls}
                                        min="30" max="3600"
                                    />
                                    <p className="text-[10px] text-slate-600 mt-1.5 italic">Luồng sẽ bị đóng cưỡng bức nếu vượt quá thời gian này.</p>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Footer / Status Bar */}
                    <div className="px-8 py-4 bg-white/3 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5 text-slate-400">
                                <Layers size={14} />
                                <span>Loại: {TASK_TYPES.find(t => t.id === selectedType)?.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400">
                                <Filter size={14} />
                                <span>{resetConfig.target_statuses.length} trạng thái mục tiêu</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            Sẵn sàng khởi chạy
                        </div>
                    </div>
                </div>
            </main>

            {/* --- ACTIVITY / HISTORY RIGHT SIDE --- */}
            <aside className="w-80 flex-shrink-0 space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <History size={18} className="text-slate-400" />
                    <h2 className="text-lg font-bold text-white">Hoạt động gần đây</h2>
                </div>

                <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hôm nay</span>
                            <span className="text-[10px] text-slate-600">09:12 AM</span>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-1 rounded-full bg-emerald-500/40" />
                            <div className="flex-1 space-y-1">
                                <p className="text-xs font-semibold text-slate-200">Reset Password thành công</p>
                                <p className="text-[11px] text-slate-500">5 tài khoản trong nhóm "Default Group"</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3 opacity-60">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hôm qua</span>
                            <span className="text-[10px] text-slate-600">11:45 PM</span>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-1 rounded-full bg-red-500/40" />
                            <div className="flex-1 space-y-1">
                                <p className="text-xs font-semibold text-slate-200">Gửi SMS bị gián đoạn</p>
                                <p className="text-[11px] text-slate-500">Lỗi: Proxy connection timeout (3 accounts)</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats summary */}
                <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-600/10 to-violet-600/10 border border-blue-500/10 space-y-4">
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Thống kê Task</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-2xl font-bold text-white">128</p>
                            <p className="text-[10px] text-slate-500">Đã hoàn thành</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-2xl font-bold text-white">12</p>
                            <p className="text-[10px] text-slate-500">Lỗi/Thất bại</p>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    )
}
