import { useState } from 'react'
import { Folder, Monitor, Shield } from 'lucide-react'
import GroupsTab from '../components/MLX/GroupsTab'
import ProfilesTab from '../components/MLX/ProfilesTab'

const TABS = [
    { id: 'groups', label: 'Groups', icon: Folder },
    { id: 'profiles', label: 'Profiles', icon: Monitor },
]

export default function MLXControl() {
    const [activeTab, setActiveTab] = useState('groups')
    const Tab = activeTab === 'groups' ? GroupsTab : ProfilesTab

    return (
        <div className="space-y-5">
            {/* Page Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <Shield size={15} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">MLX Control</h2>
                    </div>
                    <p className="text-sm text-slate-500">Quản lý Groups và Profiles trên Multilogin X</p>
                </div>

                {/* MLX badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                    <span className="w-2 h-2 rounded-full bg-violet-400 status-dot-active" />
                    <span className="text-xs text-violet-400 font-medium">MLX Connected</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 glass rounded-xl border border-white/5 w-fit">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
              ${activeTab === id
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Icon size={15} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <Tab />
        </div>
    )
}
