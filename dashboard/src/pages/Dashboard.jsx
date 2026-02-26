import { useEffect, useState } from 'react'
import { Users, Globe, CheckCircle, AlertCircle, TrendingUp, Activity, Clock, Zap } from 'lucide-react'
import { DashboardService } from '../services/apiService'

function StatCard({ icon: Icon, label, value, sub, color, gradient }) {
    return (
        <div className={`card-hover glass rounded-2xl p-5 border border-white/5 relative overflow-hidden`}>
            {/* Background glow */}
            <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 blur-xl ${gradient}`} />

            <div className="relative flex items-start justify-between">
                <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
                    <p className="text-3xl font-bold text-white">{value ?? '—'}</p>
                    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
                </div>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon size={20} className="text-white" />
                </div>
            </div>
        </div>
    )
}

function StatusBar({ label, count, total, color }) {
    const pct = total ? Math.round((count / total) * 100) : 0
    return (
        <div>
            <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-300 font-semibold">{count} <span className="text-slate-600">({pct}%)</span></span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${color}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

export default function Dashboard() {
    const [accountStats, setAccountStats] = useState(null)
    const [proxyStats, setProxyStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            try {
                const [acc, prx] = await Promise.all([
                    DashboardService.getAccountStats(),
                    DashboardService.getProxyStats(),
                ])
                setAccountStats(acc.data)
                setProxyStats(prx.data)
            } catch {
                // Offline mode - hiển thị placeholder
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const findCount = (stats, key) =>
        stats?.stats?.find((s) => s._id === key)?.count ?? 0

    const accTotal = accountStats?.total ?? 0
    const accActive = findCount(accountStats, 'active')
    const accBanned = findCount(accountStats, 'banned')
    const accPending = findCount(accountStats, 'pending')

    const prxTotal = proxyStats?.total ?? 0
    const prxActive = findCount(proxyStats, 'active')
    const prxDead = findCount(proxyStats, 'dead')

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page title */}
            <div>
                <h2 className="text-2xl font-bold text-white">Tổng quan hệ thống</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Thống kê theo thời gian thực · Cập nhật lúc{' '}
                    {new Date().toLocaleTimeString('vi-VN')}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Tổng tài khoản" value={accTotal} sub="Tất cả trạng thái" color="bg-blue-500/20" gradient="bg-blue-500" />
                <StatCard icon={CheckCircle} label="Đang hoạt động" value={accActive} sub="Tài khoản active" color="bg-emerald-500/20" gradient="bg-emerald-500" />
                <StatCard icon={Globe} label="Tổng proxy" value={prxTotal} sub="Đã cấu hình" color="bg-violet-500/20" gradient="bg-violet-500" />
                <StatCard icon={AlertCircle} label="Proxy hoạt động" value={prxActive} sub="Đang khả dụng" color="bg-cyan-500/20" gradient="bg-cyan-500" />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Account breakdown */}
                <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity size={16} className="text-blue-400" />
                        <h3 className="text-sm font-semibold text-slate-200">Phân bổ tài khoản</h3>
                    </div>
                    <StatusBar label="Hoạt động" count={accActive} total={accTotal || 1} color="bg-emerald-500" />
                    <StatusBar label="Bị khoá" count={accBanned} total={accTotal || 1} color="bg-red-500" />
                    <StatusBar label="Chờ xử lý" count={accPending} total={accTotal || 1} color="bg-amber-500" />
                    <StatusBar label="Không kích hoạt" count={findCount(accountStats, 'inactive')} total={accTotal || 1} color="bg-slate-500" />
                </div>

                {/* Proxy breakdown */}
                <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={16} className="text-violet-400" />
                        <h3 className="text-sm font-semibold text-slate-200">Phân bổ proxy</h3>
                    </div>
                    <StatusBar label="Hoạt động" count={prxActive} total={prxTotal || 1} color="bg-emerald-500" />
                    <StatusBar label="Không kích hoạt" count={findCount(proxyStats, 'inactive')} total={prxTotal || 1} color="bg-slate-500" />
                    <StatusBar label="Đã chết" count={prxDead} total={prxTotal || 1} color="bg-red-500" />
                </div>
            </div>

            {/* System info */}
            <div className="glass rounded-2xl p-5 border border-white/5">
                <div className="flex items-center gap-2 mb-4">
                    <Zap size={16} className="text-amber-400" />
                    <h3 className="text-sm font-semibold text-slate-200">Thông tin hệ thống</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Engine', value: 'Playwright + CDP' },
                        { label: 'Antidetect', value: 'Multilogin' },
                        { label: 'Database', value: 'MongoDB' },
                        { label: 'Runtime', value: 'Node.js ESM' },
                    ].map(({ label, value }) => (
                        <div key={label} className="bg-white/3 rounded-xl p-3 border border-white/5">
                            <p className="text-[10px] text-slate-600 uppercase tracking-wider font-medium">{label}</p>
                            <p className="text-sm text-slate-200 font-semibold mt-1">{value}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
