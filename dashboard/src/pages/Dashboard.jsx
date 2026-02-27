import { useEffect, useState, useCallback } from 'react'
import {
    Users, Globe, CheckCircle, XCircle, Clock, Zap,
    Activity, TrendingUp, RefreshCw, Play, ArrowRight,
    BarChart2, CircleDot, AlertTriangle,
} from 'lucide-react'
import { DashboardService } from '../services/apiService'
import { useNavigate } from 'react-router-dom'

// ─── Status config ────────────────────────────────────────────────────────────
const EXEC_STATUS = {
    running: { label: 'Đang chạy', dot: 'bg-emerald-400 animate-pulse', text: 'text-emerald-400', badge: 'bg-emerald-500/15 border-emerald-500/30' },
    completed: { label: 'Hoàn thành', dot: 'bg-blue-400', text: 'text-blue-400', badge: 'bg-blue-500/15 border-blue-500/30' },
    failed: { label: 'Thất bại', dot: 'bg-red-400', text: 'text-red-400', badge: 'bg-red-500/15 border-red-500/30' },
    stopped: { label: 'Đã dừng', dot: 'bg-amber-400', text: 'text-amber-400', badge: 'bg-amber-500/15 border-amber-500/30' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
    if (!dateStr) return '—'
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'vừa xong'
    if (m < 60) return `${m} phút trước`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} giờ trước`
    return `${Math.floor(h / 24)} ngày trước`
}

function duration(start, end) {
    if (!start) return '—'
    const ms = (end ? new Date(end) : new Date()) - new Date(start)
    const s = Math.floor(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    return `${m}m ${s % 60}s`
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`group glass rounded-2xl p-5 border border-white/5 relative overflow-hidden text-left w-full transition-all duration-300 hover:border-white/10 hover:shadow-lg ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default'}`}
        >
            <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-10 blur-2xl ${accent}`} />
            <div className="relative flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 font-medium mb-1.5 uppercase tracking-wider">{label}</p>
                    <p className="text-4xl font-bold text-white tabular-nums">{value ?? <span className="text-slate-700">—</span>}</p>
                    {sub && <p className="text-xs text-slate-500 mt-1.5">{sub}</p>}
                </div>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent} bg-opacity-20 transition-transform duration-300 group-hover:scale-110`}>
                    <Icon size={20} className="text-white" />
                </div>
            </div>
        </button>
    )
}

function StatusBar({ label, count, total, color, textColor }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
                <span className={`font-medium ${textColor || 'text-slate-400'}`}>{label}</span>
                <span className="text-slate-300 font-semibold tabular-nums">{count} <span className="text-slate-600 font-normal">({pct}%)</span></span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}

function ExecutionRow({ exec }) {
    const cfg = EXEC_STATUS[exec.status] || EXEC_STATUS.completed
    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 group">
            <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{exec.workflowName}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                    {exec.options?.target_statuses?.join(', ')} · {exec.options?.threads || 1} luồng · {timeAgo(exec.started_at)}
                </p>
            </div>
            <div className="text-right shrink-0">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.badge} ${cfg.text}`}>
                    {cfg.label}
                </span>
                <p className="text-[10px] text-slate-600 mt-1">{duration(exec.started_at, exec.ended_at)}</p>
            </div>
        </div>
    )
}

function SectionHeader({ icon: Icon, title, iconColor, action, onAction }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <Icon size={15} className={iconColor} />
                <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
            </div>
            {action && (
                <button onClick={onAction} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                    {action} <ArrowRight size={11} />
                </button>
            )}
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Dashboard() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [lastUpdate, setLastUpdate] = useState(null)
    const navigate = useNavigate()

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true)
        else setRefreshing(true)
        try {
            const res = await DashboardService.getStats()
            setData(res.data)          // interceptor đã unwrap: res = { success, data }
            setLastUpdate(new Date())
        } catch {
            // offline — giữ data cũ
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    // Auto-refresh mỗi 30s nếu có execution đang chạy
    useEffect(() => {
        const hasRunning = data?.executions?.some(e => e.status === 'running')
        if (!hasRunning) return
        const t = setInterval(() => load(true), 15000)
        return () => clearInterval(t)
    }, [data, load])

    const acc = data?.accounts || {}
    const prx = data?.proxies || {}
    const wf = data?.workflows || {}
    const execs = data?.executions || []

    const accTotal = acc.total || 0
    const prxTotal = prx.total || 0
    const runningCount = execs.filter(e => e.status === 'running').length

    if (loading) return (
        <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Đang tải dữ liệu...</p>
            </div>
        </div>
    )

    return (
        <div className="p-6 space-y-6 animate-fade-in max-w-7xl">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Tổng quan hệ thống</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Cập nhật {lastUpdate ? lastUpdate.toLocaleTimeString('vi-VN') : '—'}
                        {runningCount > 0 && <span className="ml-2 text-emerald-400 font-medium">· {runningCount} đang chạy</span>}
                    </p>
                </div>
                <button
                    onClick={() => load(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-white/5 text-sm text-slate-400 hover:text-white transition-all hover:border-white/10 disabled:opacity-50"
                >
                    <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                    Làm mới
                </button>
            </div>

            {/* ── Stats Row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={Users} label="Tổng tài khoản" value={accTotal}
                    sub={`${acc.active || 0} đang hoạt động`}
                    accent="bg-blue-500"
                    onClick={() => navigate('/accounts')}
                />
                <StatCard
                    icon={CheckCircle} label="Tài khoản active" value={acc.active || 0}
                    sub={accTotal ? `${Math.round(((acc.active || 0) / accTotal) * 100)}% tổng số` : 'Chưa có dữ liệu'}
                    accent="bg-emerald-500"
                    onClick={() => navigate('/accounts')}
                />
                <StatCard
                    icon={Globe} label="Tổng proxy" value={prxTotal}
                    sub={`${prx.active || 0} khả dụng`}
                    accent="bg-violet-500"
                    onClick={() => navigate('/proxies')}
                />
                <StatCard
                    icon={Zap} label="Kịch bản" value={wf.total || 0}
                    sub={runningCount > 0 ? `${runningCount} đang thực thi` : 'Không có phiên nào chạy'}
                    accent="bg-amber-500"
                    onClick={() => navigate('/tasks')}
                />
            </div>

            {/* ── Charts + Executions ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Account breakdown */}
                <div className="glass rounded-2xl p-5 border border-white/5">
                    <SectionHeader icon={Activity} title="Phân bổ tài khoản" iconColor="text-blue-400" action="Xem tất cả" onAction={() => navigate('/accounts')} />
                    <div className="space-y-3">
                        <StatusBar label="Hoạt động (active)" count={acc.active || 0} total={accTotal || 1} color="bg-emerald-500" textColor="text-emerald-400" />
                        <StatusBar label="Bị khoá (banned)" count={acc.banned || 0} total={accTotal || 1} color="bg-red-500" textColor="text-red-400" />
                        <StatusBar label="Sai mật khẩu (no_mail)" count={acc.no_mail || 0} total={accTotal || 1} color="bg-orange-500" textColor="text-orange-400" />
                        <StatusBar label="Chờ xử lý (pending)" count={acc.pending || 0} total={accTotal || 1} color="bg-amber-500" textColor="text-amber-400" />
                        <StatusBar label="Không kích hoạt" count={acc.inactive || 0} total={accTotal || 1} color="bg-slate-500" />
                    </div>
                    {/* Summary numbers */}
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5">
                        {[
                            { label: 'Active', val: acc.active || 0, color: 'text-emerald-400' },
                            { label: 'Banned', val: acc.banned || 0, color: 'text-red-400' },
                            { label: 'Khác', val: accTotal - (acc.active || 0) - (acc.banned || 0), color: 'text-slate-400' },
                        ].map(({ label, val, color }) => (
                            <div key={label} className="text-center">
                                <p className={`text-xl font-bold ${color} tabular-nums`}>{val}</p>
                                <p className="text-[10px] text-slate-600 mt-0.5">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Proxy breakdown */}
                <div className="glass rounded-2xl p-5 border border-white/5">
                    <SectionHeader icon={TrendingUp} title="Phân bổ proxy" iconColor="text-violet-400" action="Xem tất cả" onAction={() => navigate('/proxies')} />
                    <div className="space-y-3">
                        <StatusBar label="Hoạt động (active)" count={prx.active || 0} total={prxTotal || 1} color="bg-emerald-500" textColor="text-emerald-400" />
                        <StatusBar label="Không kích hoạt" count={prx.inactive || 0} total={prxTotal || 1} color="bg-slate-500" />
                        <StatusBar label="Đã chết (dead)" count={prx.dead || 0} total={prxTotal || 1} color="bg-red-500" textColor="text-red-400" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5">
                        {[
                            { label: 'Khả dụng', val: prx.active || 0, color: 'text-emerald-400' },
                            { label: 'Inactive', val: prx.inactive || 0, color: 'text-slate-400' },
                            { label: 'Dead', val: prx.dead || 0, color: 'text-red-400' },
                        ].map(({ label, val, color }) => (
                            <div key={label} className="text-center">
                                <p className={`text-xl font-bold ${color} tabular-nums`}>{val}</p>
                                <p className="text-[10px] text-slate-600 mt-0.5">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent executions */}
                <div className="glass rounded-2xl p-5 border border-white/5">
                    <SectionHeader icon={BarChart2} title="Lịch sử thực thi" iconColor="text-amber-400" action="Xem chi tiết" onAction={() => navigate('/history')} />
                    {execs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <CircleDot size={28} className="text-slate-700 mb-2" />
                            <p className="text-sm text-slate-600">Chưa có phiên nào chạy</p>
                            <button onClick={() => navigate('/tasks')} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/15 transition-all">
                                <Play size={11} /> Chạy kịch bản
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {execs.slice(0, 6).map(exec => (
                                <ExecutionRow key={exec.executionId} exec={exec} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── System info ── */}
            <div className="glass rounded-2xl p-5 border border-white/5">
                <SectionHeader icon={Zap} title="Thông tin hệ thống" iconColor="text-amber-400" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Automation Engine', value: 'Playwright + CDP', icon: Play, color: 'text-emerald-400' },
                        { label: 'Antidetect Browser', value: 'Multilogin X', icon: Globe, color: 'text-violet-400' },
                        { label: 'Database', value: 'MongoDB Atlas', icon: Activity, color: 'text-blue-400' },
                        { label: 'Runtime', value: 'Node.js ESM', icon: Zap, color: 'text-amber-400' },
                    ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="bg-white/3 rounded-xl p-3.5 border border-white/5 flex items-start gap-3">
                            <Icon size={14} className={`${color} mt-0.5 shrink-0`} />
                            <div>
                                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-medium">{label}</p>
                                <p className="text-sm text-slate-200 font-semibold mt-0.5">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Quick actions ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Thêm tài khoản', icon: Users, to: '/accounts', accent: 'from-blue-600/20 to-blue-600/5 border-blue-500/20 hover:border-blue-500/40', icon_color: 'text-blue-400' },
                    { label: 'Thêm proxy', icon: Globe, to: '/proxies', accent: 'from-violet-600/20 to-violet-600/5 border-violet-500/20 hover:border-violet-500/40', icon_color: 'text-violet-400' },
                    { label: 'Tạo kịch bản', icon: Zap, to: '/tasks', accent: 'from-amber-600/20 to-amber-600/5 border-amber-500/20 hover:border-amber-500/40', icon_color: 'text-amber-400' },
                    { label: 'Xem lịch sử', icon: Clock, to: '/history', accent: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/20 hover:border-emerald-500/40', icon_color: 'text-emerald-400' },
                ].map(({ label, icon: Icon, to, accent, icon_color }) => (
                    <button
                        key={label}
                        onClick={() => navigate(to)}
                        className={`flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br ${accent} border transition-all duration-200 hover:-translate-y-0.5 group`}
                    >
                        <div className={`w-8 h-8 rounded-lg glass flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                            <Icon size={15} className={icon_color} />
                        </div>
                        <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{label}</span>
                        <ArrowRight size={13} className="text-slate-600 ml-auto group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                    </button>
                ))}
            </div>
        </div>
    )
}
