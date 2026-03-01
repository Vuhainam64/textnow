import { NavLink, Outlet } from 'react-router-dom'
import pkg from '../../package.json'
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
    Activity,
    History,
    RefreshCw,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { MLXService } from '../services/apiService'
import SettingsModal from './SettingsModal'
import ServerSwitcher from './ServerSwitcher'
import LanguageSwitcher from './LanguageSwitcher'
import { useT } from '../lib/i18n'

function Sidebar({ collapsed, onToggle }) {
    const t = useT()

    const navItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
        { to: '/accounts', icon: Users, label: t('nav.accounts') },
        { to: '/proxies', icon: Globe, label: t('nav.proxies') },
        { to: '/mlx', icon: Shield, label: t('nav.mlx') },
        { to: '/tasks', icon: Zap, label: t('nav.workflow') },
        { to: '/history', icon: History, label: t('nav.history') },
    ]

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
                        {t('nav.navigation')}
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

            {/* Version + collapse button */}
            <div className="p-3 border-t border-white/5 flex-shrink-0 space-y-1">
                {/* Version badge */}
                {!collapsed ? (
                    <div className="flex items-center gap-2 px-3 py-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <span className="text-[10px] text-slate-600 font-mono">v{pkg.version}</span>
                        <span className="ml-auto text-[9px] text-slate-700 font-medium uppercase tracking-widest">stable</span>
                    </div>
                ) : (
                    <div className="flex justify-center py-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                )}
                <button
                    onClick={onToggle}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                     text-slate-500 hover:text-slate-300 hover:bg-white/5 text-sm font-medium transition-all"
                >
                    {collapsed ? <ChevronRight size={16} /> : (
                        <>
                            <Menu size={16} />
                            <span>{t('nav.collapse')}</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    )
}

function Header({ onShowSettings }) {
    const t = useT()
    const [agentConnected, setAgentConnected] = useState(false)
    const [checking, setChecking] = useState(false)

    const checkStatus = async () => {
        setChecking(true)
        try {
            const res = await MLXService.getAgentStatus()
            const isConnected = res.data?.connected || res.connected || false
            setAgentConnected(isConnected)
        } catch (e) {
            setAgentConnected(false)
        } finally {
            setChecking(false)
        }
    }

    useEffect(() => {
        checkStatus()
        const timer = setInterval(checkStatus, 15000)
        return () => clearInterval(timer)
    }, [])

    const handleConnectAgent = () => {
        window.location.href = 'mlx:///start?port=45001'
        setTimeout(checkStatus, 3000)
    }

    return (
        <header className="h-16 border-b border-white/5 bg-[#161b27]/80 backdrop-blur-xl
                       flex items-center justify-between px-6 sticky top-0 z-30 flex-shrink-0">
            <div>
                <h1 className="text-sm font-semibold text-slate-200 uppercase tracking-tight">{t('nav.systemTitle')}</h1>
                <p className="text-[10px] text-slate-500 font-medium">Multilogin • Playwright • MongoDB</p>
            </div>

            <div className="flex items-center gap-3">
                {/* Server Switcher */}
                <ServerSwitcher onChange={() => window.location.reload()} />
                {/* MLX Agent Status */}
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${agentConnected
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${agentConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                            {agentConnected ? t('nav.agentConnected') : t('nav.agentDisconnected')}
                        </span>
                    </div>

                    {!agentConnected && (
                        <button
                            onClick={handleConnectAgent}
                            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold uppercase shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all flex items-center gap-2"
                        >
                            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
                            {t('nav.connectAgent')}
                        </button>
                    )}
                </div>
                {/* Language Switcher */}
                <LanguageSwitcher />
                <div className="h-6 w-px bg-white/5 mx-1" />

                <div className="flex items-center gap-2">
                    <button className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5
                               flex items-center justify-center text-slate-400 hover:text-slate-200 transition-all">
                        <Bell size={16} />
                    </button>
                    <button
                        onClick={onShowSettings}
                        className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5
                               flex items-center justify-center text-slate-400 hover:text-slate-200 transition-all">
                        <Settings size={16} />
                    </button>
                </div>
            </div>
        </header>
    )
}

export default function Layout() {
    const [collapsed, setCollapsed] = useState(false)
    const [showSettings, setShowSettings] = useState(false)

    return (
        <div className="flex h-screen bg-[#0f1117] overflow-hidden">
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

            <div className="flex flex-col flex-1 min-w-0">
                <Header onShowSettings={() => setShowSettings(true)} />
                {/* Main content - scrollable */}
                <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <Outlet />
                </main>
            </div>

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </div>
    )
}
