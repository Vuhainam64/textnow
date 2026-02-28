import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    History as HistoryIcon, RefreshCcw, Clock, CheckCircle2,
    XCircle, Loader2, Calendar, ChevronRight, Square,
    Zap, Layers, Settings2, Terminal, List, LayoutGrid,
    AlertCircle, User, ChevronDown
} from 'lucide-react';
import { WorkflowsService } from '../services/apiService';
import { showToast } from '../components/Toast';
import { useExecutionSocket } from '../hooks/useExecutionSocket';

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
    running: { label: 'Đang chạy', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-400', Icon: Loader2, spin: true },
    completed: { label: 'Hoàn thành', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400', Icon: CheckCircle2, spin: false },
    failed: { label: 'Thất bại', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', dot: 'bg-rose-400', Icon: XCircle, spin: false },
    stopped: { label: 'Đã dừng', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-400', Icon: Square, spin: false },
    stopping: { label: 'Đang dừng', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-400', Icon: Loader2, spin: true },
};

const THREAD_STATUS = {
    running: { label: 'Đang chạy', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', Icon: Loader2, spin: true },
    success: { label: 'Thành công', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', Icon: CheckCircle2, spin: false },
    error: { label: 'Lỗi', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', Icon: XCircle, spin: false },
};

const LOG_COLORS = {
    error: 'text-rose-400',
    warning: 'text-amber-400',
    success: 'text-emerald-400',
    default: 'text-slate-300',
    info: 'text-slate-300',
};

function duration(start, end) {
    if (!start) return '—';
    const ms = new Date(end || Date.now()) - new Date(start);
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function LogLine({ log }) {
    const colorCls = LOG_COLORS[log.type] || LOG_COLORS.default;
    const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('vi-VN') : '';
    return (
        <div className="flex gap-3 hover:bg-white/[0.025] rounded px-2 py-px -mx-2 group">
            <span className="text-slate-700 shrink-0 text-[10px] mt-0.5 pt-px w-16">{time}</span>
            {log.threadId && (
                <span className="text-[10px] text-slate-600 shrink-0 font-mono truncate max-w-[80px]" title={log.threadId}>
                    [{log.threadId.split('@')[0]}]
                </span>
            )}
            <span className={`${colorCls} flex-1 break-all`}>{log.message}</span>
        </div>
    );
}

// ─── Thread Card ──────────────────────────────────────────────────────────────
function ThreadCard({ thread }) {
    const [open, setOpen] = useState(false);
    const s = THREAD_STATUS[thread.status] || THREAD_STATUS.running;

    return (
        <div className={`rounded-2xl border ${s.border} ${s.bg} overflow-hidden transition-all`}>
            {/* Card Header */}
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                onClick={() => setOpen(o => !o)}
            >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white/5`}>
                    <s.Icon size={15} className={`${s.color} ${s.spin ? 'animate-spin' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 truncate">{thread.user}</span>
                        <span className={`text-[10px] font-bold ${s.color}`}>{s.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 mt-px">
                        <span>[{thread.index}/{thread.total}]</span>
                        <span>·</span>
                        <span>{duration(thread.started_at, thread.ended_at)}</span>
                        {thread.error && <span className="text-rose-500 truncate max-w-xs">{thread.error}</span>}
                    </div>
                </div>
                <ChevronDown size={14} className={`text-slate-600 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
            </div>

            {/* Logs toggle */}
            {open && (
                <div className="border-t border-white/5 bg-black/20 px-4 py-3 max-h-52 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {thread.logs?.length === 0 ? (
                        <p className="text-slate-700 italic">Không có log.</p>
                    ) : thread.logs?.map((log, i) => (
                        <LogLine key={i} log={log} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function History() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [executions, setExecutions] = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [selectedId, setSelectedId] = useState(searchParams.get('exec') || null);
    const [viewMode, setViewMode] = useState('log'); // 'log' | 'thread'
    const [logs, setLogs] = useState([]);
    const [threads, setThreads] = useState({});    // { [user]: thread }
    const [execStatus, setExecStatus] = useState(null);
    const [logsLoading, setLogsLoading] = useState(false);
    const [stopping, setStopping] = useState(false);
    const logEndRef = useRef(null);
    const listPollRef = useRef(null);

    // ── Real-time socket handlers ────────────────────────────────────────────
    const handleSocketLog = useCallback((entry) => {
        setLogs(prev => [...prev, entry]);

        // Cap nhat log vao thread tuong ung
        if (entry.threadId) {
            setThreads(t => {
                const existing = t[entry.threadId];
                if (existing) {
                    // Thread da co → append log
                    return {
                        ...t,
                        [entry.threadId]: {
                            ...existing,
                            logs: [...(existing.logs || []), entry],
                        }
                    };
                } else {
                    // Thread CHUA co (log den som hon workflow-thread-update)
                    // Tao placeholder de khong mat log
                    return {
                        ...t,
                        [entry.threadId]: {
                            user: entry.threadId,
                            status: 'running',
                            logs: [entry],
                        }
                    };
                }
            });
        }

        requestAnimationFrame(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
    }, []);

    const handleThreadUpdate = useCallback(({ threadId, thread }) => {
        // Merge only metadata; logs come from handleSocketLog to avoid duplicates
        setThreads(prev => {
            const existing = prev[threadId] || {};
            return {
                ...prev,
                [threadId]: {
                    ...thread,
                    logs: existing.logs || thread.logs || [],   // keep client-accumulated logs
                }
            };
        });
    }, []);

    const handleStatusChange = useCallback(({ status }) => {
        setExecStatus(status);
        // Refresh list to update sidebar status
        loadExecutionsSilent();
    }, []); // eslint-disable-line

    useExecutionSocket(selectedId, {
        onLog: handleSocketLog,
        onThreadUpdate: handleThreadUpdate,
        onStatusChange: handleStatusChange,
    });

    // ── Load execution list ──────────────────────────────────────────────────
    const loadExecutions = useCallback(async (silent = false) => {
        if (!silent) setLoadingList(true);
        try {
            const res = await WorkflowsService.getAllExecutions();
            setExecutions(res.data || []);
        } catch { /* ignore */ } finally {
            if (!silent) setLoadingList(false);
        }
    }, []);

    function loadExecutionsSilent() { loadExecutions(true); }

    // ── Load initial logs for selected exec ──────────────────────────────────
    const loadDetail = useCallback(async (id) => {
        if (!id) return;
        setLogsLoading(true);
        try {
            const res = await WorkflowsService.getLogs(id);
            setLogs(res.data?.logs || []);
            setThreads(res.data?.threads || {});
            setExecStatus(res.data?.status || null);
            requestAnimationFrame(() => logEndRef.current?.scrollIntoView());
        } catch {
            setLogs([]);
            setThreads({});
        } finally { setLogsLoading(false); }
    }, []);

    // ── Init ─────────────────────────────────────────────────────────────────
    useEffect(() => { loadExecutions(); }, [loadExecutions]);

    useEffect(() => {
        const paramId = searchParams.get('exec');
        if (paramId && paramId !== selectedId) setSelectedId(paramId);
    }, [searchParams]); // eslint-disable-line

    useEffect(() => {
        if (selectedId) {
            setLogs([]);
            setThreads({});
            loadDetail(selectedId);
        }
    }, [selectedId, loadDetail]);

    // ── Slower poll for list (backup for after socket ends) ──────────────────
    useEffect(() => {
        listPollRef.current = setInterval(() => loadExecutions(true), 8000);
        return () => clearInterval(listPollRef.current);
    }, [loadExecutions]);

    // ── Select execution ─────────────────────────────────────────────────────
    const handleSelect = (id) => {
        setSelectedId(id);
        navigate(`/history?exec=${id}`, { replace: true });
    };

    // ── Stop ─────────────────────────────────────────────────────────────────
    const handleStop = async () => {
        if (!selectedId) return;
        setStopping(true);
        try {
            await WorkflowsService.stop(selectedId);
            showToast('Đã gửi yêu cầu dừng', 'warning');
        } catch (e) {
            showToast(e.response?.data?.error || e.message, 'error');
        } finally { setStopping(false); }
    };

    const selected = executions.find(e => e.executionId === selectedId);
    const runningExec = executions.filter(e => e.status === 'running').length;
    const liveStatus = execStatus || selected?.status;
    const isRunning = liveStatus === 'running' || liveStatus === 'stopping';
    const statusCfg = STATUS[liveStatus] || STATUS.failed;
    const threadList = Object.values(threads);

    // Stats
    const successCount = threadList.filter(t => t.status === 'success').length;
    const errorCount = threadList.filter(t => t.status === 'error').length;
    const runningCount = threadList.filter(t => t.status === 'running').length;

    return (
        <div className="flex h-full overflow-hidden animate-in fade-in duration-300">

            {/* ── LEFT: Execution list ─────────────────────────────────── */}
            <aside className="w-72 flex-shrink-0 border-r border-white/5 flex flex-col bg-white/[0.01]">
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HistoryIcon size={15} className="text-slate-400" />
                        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Lịch sử</h2>
                        {runningExec > 0 && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold">
                                <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />{runningExec}
                            </span>
                        )}
                    </div>
                    <button onClick={() => loadExecutions()} title="Refresh"
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-white/5 transition-all">
                        <RefreshCcw size={13} className={loadingList ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
                    {loadingList ? (
                        Array(4).fill(0).map((_, i) => (
                            <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
                        ))
                    ) : executions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-3 px-4 text-center">
                            <Terminal size={24} />
                            <p className="text-xs">Chưa có lần chạy nào.<br />
                                <span className="text-blue-400 cursor-pointer" onClick={() => navigate('/tasks')}>Tạo workflow</span> để bắt đầu.
                            </p>
                        </div>
                    ) : executions.map(exec => {
                        const s = STATUS[exec.status] || STATUS.failed;
                        const isActive = exec.executionId === selectedId;
                        return (
                            <div
                                key={exec.executionId}
                                onClick={() => handleSelect(exec.executionId)}
                                className={`group relative px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${isActive ? `${s.bg} ${s.border}` : 'hover:bg-white/5 border-transparent'
                                    }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? s.bg : 'bg-white/5'}`}>
                                        <s.Icon size={13} className={`${s.color} ${s.spin ? 'animate-spin' : ''}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold truncate text-slate-200">{exec.workflowName}</p>
                                        <div className="flex gap-2 items-center mt-px">
                                            <span className={`text-[9px] font-bold ${s.color}`}>{s.label}</span>
                                            <span className="text-[9px] text-slate-700">·</span>
                                            <span className="text-[9px] text-slate-600">{duration(exec.started_at, exec.ended_at)}</span>
                                        </div>
                                    </div>
                                    {isActive && <ChevronRight size={11} className={`${s.color} shrink-0`} />}
                                </div>
                                <p className="text-[9px] text-slate-700 mt-1 pl-9">
                                    {new Date(exec.started_at).toLocaleString('vi-VN')}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </aside>

            {/* ── MAIN: Detail Panel ───────────────────────────────────── */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {!selectedId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
                        <Terminal size={28} />
                        <p className="text-sm font-medium">Chọn một lần chạy để xem chi tiết</p>
                    </div>
                ) : (
                    <>
                        {/* ── Header ── */}
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <Zap size={13} className="text-blue-400" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chi tiết lần chạy</span>
                                </div>
                                <h1 className="text-lg font-bold text-white">{selected?.workflowName || selectedId}</h1>
                                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                                    <span className="flex items-center gap-1"><Calendar size={10} /> {selected && new Date(selected.started_at).toLocaleString('vi-VN')}</span>
                                    <span className="flex items-center gap-1"><Clock size={10} /> {duration(selected?.started_at, selected?.ended_at)}</span>
                                    {threadList.length > 0 && (
                                        <>
                                            <span className="text-emerald-400 font-bold">✓ {successCount}</span>
                                            <span className="text-rose-400 font-bold">✗ {errorCount}</span>
                                            {runningCount > 0 && <span className="text-blue-400 font-bold animate-pulse">{runningCount} đang chạy</span>}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* View mode toggle */}
                                <div className="flex items-center bg-white/5 rounded-xl p-0.5 border border-white/8">
                                    <button
                                        onClick={() => setViewMode('log')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'log' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                    >
                                        <Terminal size={12} /> Log
                                    </button>
                                    <button
                                        onClick={() => setViewMode('thread')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'thread' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                    >
                                        <LayoutGrid size={12} /> Luồng
                                    </button>
                                </div>

                                {/* Status */}
                                {liveStatus && (
                                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                                        <statusCfg.Icon size={12} className={statusCfg.spin ? 'animate-spin' : ''} />
                                        {statusCfg.label}
                                    </span>
                                )}

                                {/* Stop */}
                                {isRunning && (
                                    <button
                                        onClick={handleStop}
                                        disabled={stopping || liveStatus === 'stopping'}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-all disabled:opacity-50"
                                    >
                                        {stopping ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />} Dừng
                                    </button>
                                )}

                                <button onClick={() => loadDetail(selectedId)}
                                    className="p-2 rounded-xl bg-white/5 text-slate-500 hover:bg-white/10 transition-all">
                                    <RefreshCcw size={13} className={logsLoading ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>

                        {/* ── Config summary ── */}
                        {selected?.options && (
                            <div className="px-6 py-2 border-b border-white/5 flex items-center gap-4 text-[10px] text-slate-600 bg-white/[0.01] shrink-0 flex-wrap">
                                <Settings2 size={11} />
                                {selected.options.threads > 0 && <span>{selected.options.threads} luồng · {selected.options.startup_delay}s delay</span>}
                                {selected.options.limit && <span>Giới hạn: {selected.options.limit} acc</span>}
                                {selected.options.target_statuses?.length > 0 && (
                                    <span>Trạng thái: {selected.options.target_statuses.join(', ')}</span>
                                )}
                                {selected.options.new_password && <span>Password: {'*'.repeat(8)}</span>}
                            </div>
                        )}

                        {/* ── Content area ── */}
                        {viewMode === 'log' ? (
                            /* ─ LOG VIEW ─ */
                            <div className="flex-1 overflow-y-auto px-4 py-4 font-mono text-[12px] leading-relaxed bg-[#090c12] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                {logsLoading && logs.length === 0 ? (
                                    <div className="flex items-center gap-2 text-slate-600 p-4">
                                        <Loader2 size={14} className="animate-spin" /> Đang tải logs...
                                    </div>
                                ) : logs.length === 0 ? (
                                    <p className="text-slate-700 italic p-4">Chưa có log nào.</p>
                                ) : (
                                    <div className="space-y-0.5">
                                        {logs.map((log, i) => <LogLine key={log.id || i} log={log} />)}
                                    </div>
                                )}
                                {isRunning && (
                                    <div className="flex items-center gap-2 mt-2 text-blue-400 px-2">
                                        <span className="animate-pulse text-sm">▋</span>
                                        <span className="text-[11px]">Đang chạy...</span>
                                    </div>
                                )}
                                <div ref={logEndRef} />
                            </div>
                        ) : (
                            /* ─ THREAD VIEW ─ */
                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                {threadList.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-3">
                                        <User size={24} />
                                        <p className="text-sm">
                                            {isRunning ? 'Đang chờ tài khoản bắt đầu...' : 'Không có dữ liệu luồng.'}
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Summary row */}
                                        <div className="grid grid-cols-3 gap-3 mb-4">
                                            {[
                                                { label: 'Đang chạy', value: runningCount, color: 'text-blue-400', bg: 'bg-blue-500/10', Icon: Loader2, spin: true },
                                                { label: 'Thành công', value: successCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10', Icon: CheckCircle2, spin: false },
                                                { label: 'Lỗi', value: errorCount, color: 'text-rose-400', bg: 'bg-rose-500/10', Icon: XCircle, spin: false },
                                            ].map(({ label, value, color, bg, Icon, spin }) => (
                                                <div key={label} className={`${bg} rounded-2xl p-4 border border-white/5 flex items-center gap-3`}>
                                                    <Icon size={18} className={`${color} ${spin && value > 0 ? 'animate-spin' : ''}`} />
                                                    <div>
                                                        <p className={`text-xl font-bold ${color}`}>{value}</p>
                                                        <p className="text-[10px] text-slate-500">{label}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Thống kê theo trạng thái tài khoản */}
                                        {(() => {
                                            // Parse logs cua moi thread de lay trang thai cuoi cung
                                            const statusMap = {};
                                            threadList.forEach(t => {
                                                if (t.status === 'running') return; // chi dem thread da xong
                                                const logs = t.logs || [];
                                                // Tim dong log "cap nhat trang thai tai khoan thanh: xxx"
                                                let lastStatus = null;
                                                for (let i = logs.length - 1; i >= 0; i--) {
                                                    const m = logs[i].message?.match(/cap nhat trang thai tai khoan thanh:\s*(\S+)/i);
                                                    if (m) { lastStatus = m[1]; break; }
                                                }
                                                if (lastStatus) {
                                                    statusMap[lastStatus] = (statusMap[lastStatus] || 0) + 1;
                                                }
                                            });

                                            const entries = Object.entries(statusMap);
                                            if (entries.length === 0) return null;

                                            const STATUS_COLORS = {
                                                verified: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                                                active: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                                                no_mail: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                                                die: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
                                                die_mail: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
                                                captcha: { color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
                                            };
                                            const defaultColor = { color: 'text-slate-400', bg: 'bg-white/5', border: 'border-white/10' };

                                            return (
                                                <div className="mb-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                                    <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold mb-3">Thống kê trạng thái tài khoản</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {entries.sort((a, b) => b[1] - a[1]).map(([st, cnt]) => {
                                                            const c = STATUS_COLORS[st] || defaultColor;
                                                            return (
                                                                <div key={st} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${c.bg} ${c.border}`}>
                                                                    <span className={`text-lg font-bold ${c.color}`}>{cnt}</span>
                                                                    <span className={`text-[10px] font-bold ${c.color} uppercase`}>{st}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Thread cards */}
                                        {threadList
                                            .sort((a, b) => a.index - b.index)
                                            .map(thread => (
                                                <ThreadCard key={thread.user} thread={thread} />
                                            ))}
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
