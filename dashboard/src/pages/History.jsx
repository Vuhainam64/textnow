import React, { useState, useEffect, useCallback } from 'react';
import {
    History as HistoryIcon,
    Search,
    RefreshCcw,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Calendar,
    ChevronRight,
    Play
} from 'lucide-react';
import { TasksService } from '../services/apiService';
import { showToast } from '../components/Toast';

const STATUS_CONFIG = {
    pending: { label: 'Chờ xử lý', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
    running: { label: 'Đang chạy', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Loader2 },
    completed: { label: 'Hoàn thành', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
    failed: { label: 'Thất bại', color: 'text-rose-400', bg: 'bg-rose-500/10', icon: XCircle },
};

export default function History() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ running: 0, pending: 0, completed_today: 0 });

    const loadHistory = useCallback(async () => {
        try {
            // Demo data vì backend team đang hoàn thiện API /history
            // Trong thực tế sẽ gọi: const res = await TasksService.getHistory()
            const res = await TasksService.getStatus();
            setStats(res);

            // Mock data để bạn hình dung giao diện
            setTasks([
                {
                    _id: '1',
                    type: 'reset_pass',
                    type_label: 'Reset Password',
                    status: 'running',
                    progress: 45,
                    total: 6,
                    success: 2,
                    failed: 1,
                    created_at: new Date().toISOString(),
                    config: { account_group: 'test', threads: 5 }
                },
                {
                    _id: '2',
                    type: 'reset_pass',
                    type_label: 'Reset Password',
                    status: 'completed',
                    progress: 100,
                    total: 12,
                    success: 10,
                    failed: 2,
                    created_at: new Date(Date.now() - 3600000).toISOString(),
                    config: { account_group: 'Default Group', threads: 3 }
                }
            ]);
        } catch (error) {
            showToast('Không thể tải lịch sử task', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadHistory();
        const timer = setInterval(loadHistory, 5000); // Auto refresh mỗi 5s
        return () => clearInterval(timer);
    }, [loadHistory]);

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="glass p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Play size={16} className="text-blue-400" />
                        </div>
                        <span className="text-xs font-medium text-slate-500 uppercase">Đang chạy</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.running}</div>
                </div>
                <div className="glass p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 size={16} className="text-emerald-400" />
                        </div>
                        <span className="text-xs font-medium text-slate-500 uppercase">Hoàn thành</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.completed_today}</div>
                </div>
                {/* ... other stats ... */}
            </div>

            {/* Task List */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HistoryIcon size={18} className="text-blue-400" />
                        <h2 className="font-bold text-slate-200">Lịch sử chạy task</h2>
                    </div>
                    <button onClick={loadHistory} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-all">
                        <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div className="divide-y divide-white/5">
                    {tasks.map(task => {
                        const Config = STATUS_CONFIG[task.status];
                        return (
                            <div key={task._id} className="p-6 hover:bg-white/[0.02] transition-colors group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex gap-4">
                                        <div className={`w-12 h-12 rounded-2xl ${Config.bg} flex items-center justify-center`}>
                                            <Config.icon size={24} className={`${Config.color} ${task.status === 'running' ? 'animate-spin-slow' : ''}`} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-slate-200">{task.type_label}</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${Config.bg} ${Config.color}`}>
                                                    {Config.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(task.created_at).toLocaleString('vi-VN')}</span>
                                                <span className="flex items-center gap-1"><HistoryIcon size={12} /> ID: {task._id}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-all flex items-center gap-1 text-xs">
                                        Xem chi tiết <ChevronRight size={14} />
                                    </button>
                                </div>

                                {/* Progress Section */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-medium">
                                        <div className="flex gap-4">
                                            <span className="text-slate-400">Tiến độ: <span className="text-white">{task.progress}%</span></span>
                                            <span className="text-emerald-400">Thành công: {task.success}</span>
                                            <span className="text-rose-400">Thất bại: {task.failed}</span>
                                        </div>
                                        <span className="text-slate-500">{task.total} tài khoản</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 rounded-full ${task.status === 'failed' ? 'bg-rose-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}
                                            style={{ width: `${task.progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}

