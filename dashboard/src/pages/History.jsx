import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    History as HistoryIcon, RefreshCcw, Clock, CheckCircle2,
    XCircle, Loader2, Calendar, ChevronRight, Square,
    Zap, Layers, Settings2, Terminal, List, LayoutGrid,
    AlertCircle, AlertTriangle, User, ChevronDown
} from 'lucide-react';
import { WorkflowsService, MLXService } from '../services/apiService';
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
    info: 'text-sky-400',
    default: 'text-slate-300',
};

// Account color palette (consistent per account name)
const ACCOUNT_COLORS = [
    { pill: 'bg-blue-500/15 text-blue-300 border-blue-500/25', dot: 'bg-blue-400' },
    { pill: 'bg-violet-500/15 text-violet-300 border-violet-500/25', dot: 'bg-violet-400' },
    { pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
    { pill: 'bg-amber-500/15 text-amber-300 border-amber-500/25', dot: 'bg-amber-400' },
    { pill: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25', dot: 'bg-cyan-400' },
    { pill: 'bg-pink-500/15 text-pink-300 border-pink-500/25', dot: 'bg-pink-400' },
    { pill: 'bg-orange-500/15 text-orange-300 border-orange-500/25', dot: 'bg-orange-400' },
    { pill: 'bg-teal-500/15 text-teal-300 border-teal-500/25', dot: 'bg-teal-400' },
];

function getAccountColor(name, colorMap) {
    if (!name) return null;
    if (!colorMap[name]) {
        colorMap[name] = ACCOUNT_COLORS[Object.keys(colorMap).length % ACCOUNT_COLORS.length];
    }
    return colorMap[name];
}

// Shared color map (module-level để stable giữa rerenders)
const accountColorCache = {};

function duration(start, end) {
    if (!start) return '';
    const ms = (end ? new Date(end) : new Date()) - new Date(start);
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}m ${rs}s`;
}

function LogLine({ log }) {
    const colorCls = LOG_COLORS[log.type] || LOG_COLORS.default;
    const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('vi-VN') : '';
    const account = log.threadId ? log.threadId.split('@')[0] : null;
    const acColor = account ? getAccountColor(account, accountColorCache) : null;

    return (
        <div className="flex gap-2 hover:bg-white/[0.025] rounded-lg px-2 py-1 -mx-2 group items-start">
            {/* Time */}
            <span className="text-slate-700 shrink-0 text-[10px] pt-px w-14 font-mono">{time}</span>

            {/* Account badge */}
            {account ? (
                <span
                    className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md border font-mono max-w-[120px] truncate ${acColor?.pill}`}
                    title={log.threadId}
                >
                    {account}
                </span>
            ) : (
                <span className="shrink-0 w-[80px]" />
            )}

            {/* Message */}
            <span className={`${colorCls} flex-1 break-all text-[11px] leading-relaxed`}>{log.message}</span>
        </div>
    );
}


// ThreadCard — lazy load logs khi user click mo
function ThreadCard({ thread, executionId }) {
    const [open, setOpen] = useState(false);
    const [threadLogs, setThreadLogs] = useState(null); // null = chua load
    const [loadingLogs, setLoadingLogs] = useState(false);
    const s = THREAD_STATUS[thread.status] || THREAD_STATUS.running;

    const handleToggle = async () => {
        const nextOpen = !open;
        setOpen(nextOpen);
        // Lazy load: chi goi API lan dau mo
        if (nextOpen && threadLogs === null && executionId) {
            setLoadingLogs(true);
            try {
                const res = await WorkflowsService.getThreadLogs(executionId, thread.user, { limit: 200 });
                setThreadLogs(res.data?.logs || []);
            } catch {
                setThreadLogs([]);
            } finally {
                setLoadingLogs(false);
            }
        }
    };

    return (
        <div className={`rounded-2xl border ${s.border} ${s.bg} overflow-hidden transition-all`}>
            {/* Card Header */}
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                onClick={handleToggle}
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

            {/* Logs — lazy loaded */}
            {open && (
                <div className="border-t border-white/5 bg-black/20 px-4 py-3 max-h-52 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {loadingLogs ? (
                        <div className="flex items-center gap-2 text-slate-600">
                            <Loader2 size={12} className="animate-spin" /> Đang tải...
                        </div>
                    ) : !threadLogs || threadLogs.length === 0 ? (
                        <p className="text-slate-700 italic">Không có log.</p>
                    ) : threadLogs.map((log, i) => (
                        <LogLine key={log.id || i} log={log} />
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
    const [viewMode, setViewMode] = useState('log');
    const [logs, setLogs] = useState([]);          // Ring-buffer: toi da LOG_WINDOW
    const [totalLogs, setTotalLogs] = useState(0); // Tong so log tren server
    const [threads, setThreads] = useState({});    // { [threadId]: metadata only }
    const [execStatus, setExecStatus] = useState(null);
    const [logsLoading, setLogsLoading] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [stoppingAll, setStoppingAll] = useState(false);
    const [filterAccount, setFilterAccount] = useState(null);
    const [threadSearch, setThreadSearch] = useState('');
    const [threadPage, setThreadPage] = useState(1);
    const logEndRef = useRef(null);
    const listPollRef = useRef(null);

    const LOG_WINDOW = 200;   // So log toi da hien tren client
    const THREAD_PAGE_SIZE = 50;

    // ── Real-time socket handlers (batch) ───────────────────────────────────
    const handleSocketLog = useCallback((entry) => {
        // Single entry (backward compat) - wrap trong batch
        setLogs(prev => {
            const next = [...prev, entry];
            return next.length > LOG_WINDOW ? next.slice(-LOG_WINDOW) : next;
        });
        requestAnimationFrame(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
    }, []);

    const handleLogBatch = useCallback((entries) => {
        if (!Array.isArray(entries) || entries.length === 0) return;
        setLogs(prev => {
            const next = [...prev, ...entries];
            return next.length > LOG_WINDOW ? next.slice(-LOG_WINDOW) : next;
        });
        setTotalLogs(t => t + entries.length);
        requestAnimationFrame(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
    }, []);

    const handleThreadMeta = useCallback(({ threadId, meta }) => {
        // Nhan metadata only — khong co logs[]
        setThreads(prev => ({ ...prev, [threadId]: { ...prev[threadId], ...meta } }));
    }, []);

    // Backward compat shim (neu server cu gui thread-update)
    const handleThreadUpdate = useCallback(({ threadId, thread }) => {
        setThreads(prev => ({ ...prev, [threadId]: { ...(prev[threadId] || {}), ...thread } }));
    }, []);

    const handleStatusChange = useCallback(({ status }) => {
        setExecStatus(status);
        loadExecutionsSilent();
    }, []); // eslint-disable-line

    useExecutionSocket(selectedId, {
        // KHÔNG dung onLog de tranh duplicate (hook backward-compat da goi onLog cho moi entry trong batch)
        onLogBatch: handleLogBatch,
        onThreadMeta: handleThreadMeta,
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

    // ── Load initial logs for selected exec (first page only) ───────────────
    const loadDetail = useCallback(async (id) => {
        if (!id) return;
        setLogsLoading(true);
        try {
            const res = await WorkflowsService.getLogs(id, { limit: LOG_WINDOW, page: 1 });
            const data = res.data || {};
            setLogs(data.logs || []);
            setTotalLogs(data.total || 0);
            // Threads: metadata only (server da strip logs[])
            setThreads(data.threads || {});
            setExecStatus(data.status || null);
            requestAnimationFrame(() => logEndRef.current?.scrollIntoView());
        } catch {
            setLogs([]);
            setTotalLogs(0);
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
            setTotalLogs(0);
            setThreads({});
            setFilterAccount(null);
            setThreadSearch('');
            setThreadPage(1);
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

    const handleStopAll = async () => {
        setStoppingAll(true);
        try {
            await MLXService.stopAllProfiles();
            showToast('Đã dừng tất cả tiến trình mimic', 'warning');
        } catch (e) {
            showToast(e.message, 'error');
        } finally { setStoppingAll(false); }
    };

    const selected = executions.find(e => e.executionId === selectedId);
    const runningExec = executions.filter(e => e.status === 'running').length;
    const liveStatus = execStatus || selected?.status;
    const isRunning = liveStatus === 'running' || liveStatus === 'stopping';
    const statusCfg = STATUS[liveStatus] || STATUS.failed;
    const threadList = Object.values(threads);

    // Thread pagination + search
    const filteredThreads = threadSearch
        ? threadList.filter(t => t.user?.toLowerCase().includes(threadSearch.toLowerCase()))
        : threadList;
    const threadRunning = filteredThreads.filter(t => t.status === 'running').sort((a, b) => a.index - b.index);
    const threadDone = filteredThreads.filter(t => t.status !== 'running').sort((a, b) => a.index - b.index);
    const threadDonePage = threadDone.slice(0, threadPage * THREAD_PAGE_SIZE);
    const hasMoreThreads = threadDone.length > threadPage * THREAD_PAGE_SIZE;

    // Stats
    const successCount = threadList.filter(t => t.status === 'success').length;
    const errorCount = threadList.filter(t => t.status === 'error').length;
    const runningCount = threadList.filter(t => t.status === 'running').length;

    // Log window info
    const hiddenLogs = Math.max(0, totalLogs - LOG_WINDOW);
    const filteredLogs = filterAccount
        ? logs.filter(l => l.threadId?.startsWith(filterAccount))
        : logs;

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
                                    {/* Tab loi */}
                                    {(() => {
                                        const errCount = logs.filter(l => l.type === 'error' || l.type === 'warning').length;
                                        return (
                                            <button
                                                onClick={() => setViewMode('error')}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'error' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-rose-400'
                                                    }`}
                                            >
                                                <AlertTriangle size={12} /> Lỗi
                                                {errCount > 0 && (
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${viewMode === 'error' ? 'bg-white/20 text-white' : 'bg-rose-500/20 text-rose-400'}`}>
                                                        {errCount}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })()}
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

                                {/* Stop All Mimic */}
                                <button
                                    onClick={handleStopAll}
                                    disabled={stoppingAll}
                                    title="Dừng tất cả tiến trình mimic đang chạy"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold hover:bg-orange-500/20 transition-all disabled:opacity-50"
                                >
                                    {stoppingAll ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Dừng tất cả
                                </button>

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
                            /* ─ LOG VIEW with account filter ─ */
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* Account filter bar - chỉ hiện khi có > 1 account */}
                                {(() => {
                                    const accounts = [...new Set(logs.filter(l => l.threadId).map(l => l.threadId.split('@')[0]))];
                                    return accounts.length > 1 ? (
                                        <div className="px-4 py-2 border-b border-white/5 bg-black/10 flex items-center gap-2 flex-wrap shrink-0">
                                            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider shrink-0">Lọc:</span>
                                            <button
                                                onClick={() => setFilterAccount(null)}
                                                className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition-all ${!filterAccount
                                                    ? 'bg-blue-600/30 text-blue-300 border-blue-500/40'
                                                    : 'text-slate-500 border-white/10 hover:border-white/20'
                                                    }`}
                                            >
                                                Tất cả ({logs.length})
                                            </button>
                                            {accounts.map(acc => {
                                                const acColor = getAccountColor(acc, accountColorCache);
                                                const count = logs.filter(l => l.threadId?.startsWith(acc)).length;
                                                return (
                                                    <button
                                                        key={acc}
                                                        onClick={() => setFilterAccount(f => f === acc ? null : acc)}
                                                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition-all ${filterAccount === acc ? acColor?.pill : 'text-slate-500 border-white/10 hover:border-white/20'
                                                            }`}
                                                    >
                                                        {acc} ({count})
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : null;
                                })()}
                                {/* Log list */}
                                <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[12px] leading-relaxed bg-[#090c12] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                    {/* Hidden logs notice */}
                                    {hiddenLogs > 0 && (
                                        <div className="mb-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15 text-[10px] text-amber-500/70 flex items-center gap-2">
                                            <AlertTriangle size={11} />
                                            {hiddenLogs.toLocaleString()} log cũ đã bị ẩn (hiện thị {LOG_WINDOW} log gần nhất)
                                        </div>
                                    )}
                                    {logsLoading && logs.length === 0 ? (
                                        <div className="flex items-center gap-2 text-slate-600 p-4">
                                            <Loader2 size={14} className="animate-spin" /> Đang tải logs...
                                        </div>
                                    ) : logs.length === 0 ? (
                                        <p className="text-slate-700 italic p-4">Chưa có log nào.</p>
                                    ) : (
                                        <div className="space-y-0.5">
                                            {filteredLogs
                                                .map((log, i) => <LogLine key={log.id || i} log={log} />)
                                            }
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
                            </div>
                        ) : viewMode === 'error' ? (
                            /* ─ ERROR VIEW ─ */
                            (() => {
                                const errLogs = logs.filter(l => l.type === 'error' || l.type === 'warning');
                                return (
                                    <div className="flex-1 overflow-y-auto px-4 py-4 font-mono text-[12px] leading-relaxed bg-[#090c12] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                        {errLogs.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-3">
                                                <CheckCircle2 size={24} className="text-emerald-700" />
                                                <p className="text-sm">Không có lỗi nào 🎉</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {errLogs.map((log, i) => (
                                                    <div key={log.id || i} className={`flex gap-3 rounded-lg px-3 py-1.5 -mx-1 border-l-2 ${log.type === 'error'
                                                        ? 'bg-rose-500/5 border-rose-500/40'
                                                        : 'bg-amber-500/5 border-amber-500/40'
                                                        }`}>
                                                        <span className="text-slate-700 shrink-0 text-[10px] mt-0.5 w-14 font-mono">
                                                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('vi-VN') : ''}
                                                        </span>
                                                        {(() => {
                                                            const acc = log.threadId ? log.threadId.split('@')[0] : null;
                                                            const acColor = acc ? getAccountColor(acc, accountColorCache) : null;
                                                            return acc ? (
                                                                <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md border font-mono max-w-[120px] truncate ${acColor?.pill}`} title={log.threadId}>
                                                                    {acc}
                                                                </span>
                                                            ) : <span className="shrink-0 w-[80px]" />;
                                                        })()}
                                                        <span className={`flex-1 break-all ${log.type === 'error' ? 'text-rose-400' : 'text-amber-400'
                                                            }`}>{log.message}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()
                        ) : (
                            /* ─ THREAD VIEW ─ */
                            <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                {threadList.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-3">
                                        <User size={24} />
                                        <p className="text-sm">
                                            {isRunning ? 'Đang chờ tài khoản bắt đầu...' : 'Không có dữ liệu luồng.'}
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Stats */}
                                        {(() => {
                                            const statusMap = {};
                                            threadList.forEach(t => {
                                                if (t.status === 'running') return;
                                                const lgs = logs.filter(l => l.threadId === t.user);
                                                let lastStatus = null;
                                                for (let i = lgs.length - 1; i >= 0; i--) {
                                                    const m = lgs[i].message?.match(/cap nhat trang thai tai khoan thanh:\s*(\S+)/i);
                                                    if (m) { lastStatus = m[1]; break; }
                                                }
                                                if (lastStatus) statusMap[lastStatus] = (statusMap[lastStatus] || 0) + 1;
                                            });
                                            const statusEntries = Object.entries(statusMap).sort((a, b) => b[1] - a[1]);

                                            const STATUS_COLORS = {
                                                verified: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                                                active: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                                                no_mail: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                                                die: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
                                                die_mail: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
                                                captcha: { color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
                                            };
                                            const defClr = { color: 'text-slate-400', bg: 'bg-white/5', border: 'border-white/10' };

                                            return (
                                                <div className="mb-4 space-y-3">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {runningCount > 0 && (
                                                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
                                                                <Loader2 size={11} className="animate-spin" /> {runningCount} đang chạy
                                                            </span>
                                                        )}
                                                        {successCount > 0 && (
                                                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                                                                <CheckCircle2 size={11} /> {successCount} thành công
                                                            </span>
                                                        )}
                                                        {errorCount > 0 && (
                                                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
                                                                <XCircle size={11} /> {errorCount} lỗi
                                                            </span>
                                                        )}
                                                    </div>
                                                    {statusEntries.length > 0 && (
                                                        <div className={`grid gap-3 ${statusEntries.length <= 2 ? 'grid-cols-2' : statusEntries.length <= 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                                                            {statusEntries.map(([st, cnt]) => {
                                                                const c = STATUS_COLORS[st] || defClr;
                                                                return (
                                                                    <div key={st} className={`${c.bg} rounded-2xl p-4 border ${c.border} flex items-center gap-3`}>
                                                                        <div>
                                                                            <p className={`text-2xl font-bold ${c.color}`}>{cnt}</p>
                                                                            <p className={`text-[10px] font-bold ${c.color} uppercase tracking-wide`}>{st}</p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Thread search */}
                                        {threadList.length > 10 && (
                                            <input
                                                type="text"
                                                value={threadSearch}
                                                onChange={e => { setThreadSearch(e.target.value); setThreadPage(1); }}
                                                placeholder={`Tìm kiếm trong ${threadList.length} tài khoản...`}
                                                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 mb-1"
                                            />
                                        )}

                                        {/* Running threads */}
                                        {threadRunning.length > 0 && (
                                            <>
                                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Đang chạy ({threadRunning.length})</p>
                                                {threadRunning.map(t => <ThreadCard key={t.user} thread={t} executionId={selectedId} />)}
                                            </>
                                        )}

                                        {/* Done threads (paginated) */}
                                        {threadDone.length > 0 && (
                                            <>
                                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-3 mb-1">
                                                    Đã hoàn thành ({threadDone.length})
                                                </p>
                                                {threadDonePage.map(t => <ThreadCard key={t.user} thread={t} executionId={selectedId} />)}
                                                {hasMoreThreads && (
                                                    <button
                                                        onClick={() => setThreadPage(p => p + 1)}
                                                        className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 border border-white/5 rounded-xl hover:bg-white/5 transition-all"
                                                    >
                                                        Tải thêm ({threadDone.length - threadPage * THREAD_PAGE_SIZE} còn lại)
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {threadRunning.length === 0 && threadDone.length === 0 && threadSearch && (
                                            <p className="text-center text-xs text-slate-600 py-8">Không tìm thấy tài khoản nào.</p>
                                        )}
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
