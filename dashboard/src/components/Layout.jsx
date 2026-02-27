import { NavLink, Outlet } from 'react-router-dom'
import {
    LayoutDashboard,
    Users,
    Globe,
    ChevronRight,
    Zap,
    Bell,
    Settings,
    Menu,
    X,
    Shield,
    Activity, // Add Activity icon for Tasks
    History,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
    { to: '/accounts', icon: Users, label: 'Tài khoản' },
    { to: '/proxies', icon: Globe, label: 'Proxy' },
    { to: '/mlx', icon: Shield, label: 'MLX Control' },
    { to: '/tasks', icon: Activity, label: 'Công việc' },
    { to: '/history', icon: History, label: 'Lịch sử' },
]

function Sidebar({ collapsed, onToggle }) {
    return (
        <aside
            className={`
        flex flex-col sidebar-glow
        bg-[#161b27] border-r border-white/5
        transition-all duration-300 ease-in-out h-screen sticky top-0
        ${collapsed ? 'w-[72px]' : 'w-[240px]'}
      `}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 h-16 border-b border-white/5 flex-shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/30">
                    <Zap size={18} className="text-white" />
                </div>
                {!collapsed && (
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white leading-tight gradient-text">TextNow</p>
                        <p className="text-[10px] text-slate-500 font-medium">Account Manager</p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {!collapsed && (
                    <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-3">
                        Điều hướng
                    </p>
                )}
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
              ${isActive
                                ? 'bg-blue-500/15 text-blue-400 shadow-sm'
                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                            }
              ${collapsed ? 'justify-center' : ''}
              `
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <Icon size={18} className={`flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                {!collapsed && (
                                    <>
                                        <span className="flex-1">{label}</span>
                                        {isActive && <ChevronRight size={14} className="text-blue-400/60" />}
                                    </>
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Bottom: collapse button */}
            <div className="p-3 border-t border-white/5 flex-shrink-0">
                <button
                    onClick={onToggle}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                     text-slate-500 hover:text-slate-300 hover:bg-white/5 text-sm font-medium transition-all"
                >
                    {collapsed ? <ChevronRight size={16} /> : (
                        <>
                            <Menu size={16} />
                            <span>Thu gọn</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    )
}

function Header() {
    return (
        <header className="h-16 border-b border-white/5 bg-[#161b27]/80 backdrop-blur-xl
                       flex items-center justify-between px-6 sticky top-0 z-30 flex-shrink-0">
            <div>
                <h1 className="text-sm font-semibold text-slate-200">Hệ thống quản lý tài khoản</h1>
                <p className="text-xs text-slate-500">Multilogin • Playwright • MongoDB</p>
            </div>

            <div className="flex items-center gap-2">
                {/* Status badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 status-dot-active"></span>
                    <span className="text-xs text-emerald-400 font-medium">Hoạt động</span>
                </div>

                <button className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5
                           flex items-center justify-center text-slate-400 hover:text-slate-200 transition-all">
                    <Bell size={16} />
                </button>
                <button className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5
                           flex items-center justify-center text-slate-400 hover:text-slate-200 transition-all">
                    <Settings size={16} />
                </button>
            </div>
        </header>
    )
}

export default function Layout() {
    const [collapsed, setCollapsed] = useState(false)

    return (
        <div className="flex h-screen bg-[#0f1117] overflow-hidden">
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

            <div className="flex flex-col flex-1 min-w-0">
                <Header />
                {/* Main content - scrollable */}
                <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
