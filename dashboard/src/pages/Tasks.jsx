import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Plus, Play, Key, Layers, Calendar, ChevronRight,
    Zap, Trash2, Edit3, FileText, Filter, Loader2,
    Settings2, RefreshCw, ShieldCheck, History, Info,
    RotateCcw, Eye
} from 'lucide-react'
import { AccountsService, ProxiesService, WorkflowsService } from '../services/apiService'
import Select from '../components/Select'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { inputCls, STATUS_MAP } from '../lib/ui'
import { showToast } from '../components/Toast'
import WorkflowBuilder from './Workflow'
import { useT } from '../lib/i18n'

// ─── Default run config ────────────────────────────────────────────────────────
const defaultRunConfig = () => ({
    account_group_id: '',
    proxy_group_id: '',
    target_statuses: ['active', 'pending'],
    new_password: localStorage.getItem('task_new_password') || '',
    limit: '',
    threads: 2,
    startup_delay: 5,
})

export default function Tasks() {
    const t = useT()
    const navigate = useNavigate()
    const [view, setView] = useState('tasks') // 'tasks' | 'editor'
    const [editingWorkflow, setEditingWorkflow] = useState(null)
    const [workflows, setWorkflows] = useState([])
    const [loadingWf, setLoadingWf] = useState(true)
    const [selectedWf, setSelectedWf] = useState(null)

    const [accountGroups, setAccountGroups] = useState([])
    const [proxyGroups, setProxyGroups] = useState([])
    const [statusCounts, setStatusCounts] = useState({})
    const [matchingCount, setMatchingCount] = useState(0)
    const [running, setRunning] = useState(false)

    const [runConfig, setRunConfig] = useState(defaultRunConfig())

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newWfData, setNewWfData] = useState({ name: '', description: '' })
    const [confirmDelete, setConfirmDelete] = useState(null)

    // ── Load data ──────────────────────────────────────────────────────────────
    const loadWorkflows = useCallback(async () => {
        setLoadingWf(true)
        try {
            const res = await WorkflowsService.getAll()
            const list = res.data || []
            setWorkflows(list)
            // Tự chọn kịch bản đầu tiên nếu chưa có gì được chọn
            setSelectedWf(prev => prev ?? (list[0] || null))
        } finally { setLoadingWf(false) }
    }, [])

    const fetchAccountStats = useCallback(async (groupId) => {
        if (!groupId) { setStatusCounts({}); return }
        try {
            const res = await AccountsService.getStats({ group_id: groupId })
            const map = {}
            if (res.success && res.data?.stats) res.data.stats.forEach(s => map[s._id] = s.count)
            setStatusCounts(map)
        } catch (e) { console.error(e) }
    }, [])

    useEffect(() => {
        const load = async () => {
            const [accRes, proxyRes] = await Promise.all([
                AccountsService.getGroups(),
                ProxiesService.getGroups()
            ])
            setAccountGroups(accRes.data || [])
            setProxyGroups(proxyRes.data || [])
            if (accRes.data?.length > 0) {
                const gid = accRes.data[0]._id
                setRunConfig(c => ({ ...c, account_group_id: gid }))
                fetchAccountStats(gid)
            }
            if (proxyRes.data?.length > 0) setRunConfig(c => ({ ...c, proxy_group_id: proxyRes.data[0]._id }))
        }
        load()
        loadWorkflows()
    }, [fetchAccountStats, loadWorkflows])

    useEffect(() => { fetchAccountStats(runConfig.account_group_id) }, [runConfig.account_group_id, fetchAccountStats])
    useEffect(() => {
        const total = runConfig.target_statuses.reduce((sum, s) => sum + (statusCounts[s] || 0), 0)
        setMatchingCount(total)
    }, [runConfig.target_statuses, statusCounts])

    // ── Workflow CRUD ──────────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!newWfData.name.trim()) return showToast('Vui lòng nhập tên kịch bản', 'warning')
        try {
            const initialNodes = [{
                id: 'source_start', type: 'sourceNode', position: { x: 250, y: 50 },
                data: { label: 'START', category: 'Hệ thống', icon: 'Zap', color: 'bg-emerald-500/20 text-emerald-400', config: {} }
            }]
            const res = await WorkflowsService.create({ ...newWfData, nodes: initialNodes, edges: [] })
            showToast('✅ Đã tạo kịch bản mới')
            setShowCreateModal(false)
            setNewWfData({ name: '', description: '' })
            await loadWorkflows()
            // Open editor directly
            setEditingWorkflow(res.data)
            setView('editor')
        } catch (e) { showToast(e.message, 'error') }
    }

    const handleDelete = async () => {
        try {
            await WorkflowsService.delete(confirmDelete)
            showToast('Đã xoá kịch bản')
            setConfirmDelete(null)
            if (selectedWf?._id === confirmDelete) setSelectedWf(null)
            loadWorkflows()
        } catch (e) { showToast(e.message, 'error') }
    }

    // ── Run ────────────────────────────────────────────────────────────────────
    const handleRun = async () => {
        if (!selectedWf) return showToast('Vui lòng chọn kịch bản', 'warning')
        if (!runConfig.account_group_id) return showToast('Vui lòng chọn Nhóm tài khoản', 'warning')
        if (matchingCount === 0 && !runConfig.test_mode) return showToast('Không có tài khoản nào thoả mãn điều kiện', 'warning')

        if (runConfig.new_password) localStorage.setItem('task_new_password', runConfig.new_password)

        setRunning(true)
        try {
            const res = await WorkflowsService.run(selectedWf._id, {
                ...runConfig,
                threads: parseInt(runConfig.threads) || 1,
                startup_delay: parseInt(runConfig.startup_delay) || 0,
                limit: runConfig.limit !== '' ? parseInt(runConfig.limit) : undefined,
            })
            const execId = res.data?.executionId || res.executionId
            showToast(`✅ Đã khởi chạy!`, 'success')
            // Chuyển sang trang lịch sử và highlight execution vừa chạy
            navigate(`/history?exec=${execId}`)
        } catch (err) {
            showToast(err.response?.data?.error || err.message, 'error')
        } finally { setRunning(false) }
    }

    const toggleStatus = (s) => setRunConfig(c => ({
        ...c,
        target_statuses: c.target_statuses.includes(s)
            ? c.target_statuses.filter(x => x !== s)
            : [...c.target_statuses, s]
    }))

    // ── Editor view ────────────────────────────────────────────────────────────
    if (view === 'editor' && editingWorkflow) {
        return (
            <WorkflowBuilder
                _overrideWorkflow={editingWorkflow}
                _overrideOnBack={() => { setView('tasks'); loadWorkflows() }}
                _overrideOnUpdate={loadWorkflows}
            />
        )
    }

    // ── Tasks view ─────────────────────────────────────────────────────────────
    return (
        <div className="flex h-full overflow-hidden animate-in fade-in duration-300">

            {/* ── LEFT: Script List ── */}
            <aside className="w-72 flex-shrink-0 border-r border-white/5 flex flex-col bg-white/[0.01]">
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">{t('nav.workflow')}</h2>
                        <p className="text-[10px] text-slate-600 mt-0.5">{workflows.length} {t('tasks.workflow').toLowerCase()}</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-all shadow-lg shadow-blue-500/20"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {loadingWf ? (
                        Array(4).fill(0).map((_, i) => (
                            <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
                        ))
                    ) : workflows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-3">
                            <FileText size={28} />
                            <p className="text-xs text-center">{t('workflow.noWorkflows')}</p>
                        </div>
                    ) : workflows.map(wf => {
                        const isActive = selectedWf?._id === wf._id
                        return (
                            <div
                                key={wf._id}
                                onClick={() => setSelectedWf(wf)}
                                className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all ${isActive ? 'bg-blue-600/15 border border-blue-500/30' : 'hover:bg-white/5 border border-transparent'
                                    }`}
                            >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-500 group-hover:text-slate-300'
                                    }`}>
                                    <Zap size={16} className={isActive ? 'fill-blue-400/20' : ''} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-bold truncate ${isActive ? 'text-blue-300' : 'text-slate-300'}`}>{wf.name}</p>
                                    <p className="text-[10px] text-slate-600">{wf.nodes?.length || 0} {t('workflow.steps').toLowerCase()} · {new Date(wf.updated_at).toLocaleDateString()}</p>
                                </div>
                                {/* Actions (hover) */}
                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); setEditingWorkflow(wf); setView('editor') }}
                                        className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
                                        <Edit3 size={12} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(wf._id) }}
                                        className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                {isActive && <ChevronRight size={14} className="text-blue-400 shrink-0" />}
                            </div>
                        )
                    })}
                </div>

                {/* Tip */}
                <div className="px-4 py-3 border-t border-white/5">
                    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                        <p className="text-[10px] text-amber-400/70 leading-relaxed flex items-start gap-1.5">
                            <Info size={11} className="mt-0.5 shrink-0" />
                            Chọn kịch bản, cấu hình nguồn dữ liệu rồi nhấn <strong>Chạy ngay</strong>.
                        </p>
                    </div>
                </div>
            </aside>

            {/* ── MAIN: Run Config ── */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {!selectedWf ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                            <Zap size={28} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-slate-500">Chọn kịch bản để bắt đầu</p>
                            <p className="text-xs text-slate-600 mt-1">hoặc nhấn <span className="text-blue-400">+</span> để tạo kịch bản mới</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div>
                                <div className="flex items-center gap-2 text-blue-400 mb-1">
                                    <Settings2 size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{t('workflow.runConfig')}</span>
                                </div>
                                <h1 className="text-xl font-bold text-white">{selectedWf.name}</h1>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { setEditingWorkflow(selectedWf); setView('editor') }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/10 transition-all"
                                >
                                    <Edit3 size={13} /> {t('workflow.openEditor')}
                                </button>
                                <button
                                    onClick={handleRun}
                                    disabled={running}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} fill="white" />}
                                    {running ? t('workflow.running').toUpperCase() : t('workflow.startRun').toUpperCase()}
                                </button>
                            </div>
                        </div>

                        {/* Config Form */}
                        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">

                            {/* Account Group */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-blue-400" />
                                    <h3 className="text-sm font-bold text-slate-200">{t('workflow.accountSection')}</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block font-medium">{t('workflow.accountGroup')} <span className="text-rose-500">*</span></label>
                                        <Select
                                            options={accountGroups.map(g => ({ value: g._id, label: `${g.name} (${g.account_count || 0})` }))}
                                            value={runConfig.account_group_id}
                                            onChange={e => setRunConfig(c => ({ ...c, account_group_id: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block font-medium">{t('workflow.proxyGroup')} <span className="text-slate-600">({t('common.save').slice(0, 3) === 'Lưu' ? 'tuỳ chọn' : 'optional'})</span></label>
                                        <Select
                                            options={[{ value: '', label: '— Không dùng proxy —' }, ...proxyGroups.map(g => ({ value: g._id, label: g.name }))]}
                                            value={runConfig.proxy_group_id}
                                            onChange={e => setRunConfig(c => ({ ...c, proxy_group_id: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {/* Status filters */}
                                <div>
                                    <label className="text-xs text-slate-500 mb-2 block font-medium">{t('workflow.targetStatuses')}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {Array.from(new Set([...Object.keys(STATUS_MAP), ...Object.keys(statusCounts)])).map(status => {
                                            const info = STATUS_MAP[status] || { label: status, dot: 'bg-slate-500' }
                                            const isSelected = runConfig.target_statuses.includes(status)
                                            const count = statusCounts[status] || 0
                                            if (count === 0 && !Object.keys(STATUS_MAP).includes(status) && !isSelected) return null
                                            return (
                                                <button key={status} onClick={() => toggleStatus(status)}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${isSelected ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
                                                        }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
                                                    <span>{info.label}</span>
                                                    <span className={`px-1.5 rounded-md text-[10px] font-bold ${isSelected ? 'bg-blue-500/30' : 'bg-white/5 text-slate-600'}`}>{count}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {matchingCount > 0 && (
                                        <p className="text-[11px] text-emerald-400 font-bold mt-2 animate-pulse">
                                            ✓ {t('accounts.title')}: {matchingCount} {t('accounts.title').toLowerCase()}
                                        </p>
                                    )}
                                </div>
                            </section>

                            <div className="h-px bg-white/5" />

                            {/* Password & Test mode */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Key size={16} className="text-amber-400" />
                                    <h3 className="text-sm font-bold text-slate-200">{t('workflow.runParams')}</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block font-medium flex items-center gap-1.5">
                                            <Key size={12} className="text-blue-400" /> {t('workflow.newPassword')}
                                            <span className="text-slate-600 font-normal">({t('workflow.ifNeeded')})</span>
                                        </label>
                                        <input
                                            value={runConfig.new_password}
                                            onChange={e => setRunConfig(c => ({ ...c, new_password: e.target.value }))}
                                            className={inputCls}
                                            placeholder={t('workflow.leaveEmptyIfNotNeeded')}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block font-medium flex items-center gap-1.5">
                                            <Layers size={12} className="text-amber-400" /> {t('workflow.accountLimit')}
                                        </label>
                                        <input
                                            type="number" min="0"
                                            value={runConfig.limit}
                                            onChange={e => setRunConfig(c => ({ ...c, limit: e.target.value }))}
                                            className={inputCls}
                                            placeholder={t('workflow.limitPlaceholder')}
                                        />
                                        <p className="text-[10px] text-slate-600 mt-1.5 italic">{t('workflow.limitHint')}</p>
                                    </div>
                                </div>

                                {/* Threads & startup delay */}
                                <div className="grid grid-cols-2 gap-4 pt-1">
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block font-medium flex items-center gap-1.5">
                                            <Layers size={12} className="text-purple-400" /> {t('workflow.threads')}
                                        </label>
                                        <input
                                            type="number" min="1" max="50"
                                            value={runConfig.threads}
                                            onChange={e => setRunConfig(c => ({ ...c, threads: e.target.value }))}
                                            className={inputCls}
                                        />
                                        <p className="text-[10px] text-slate-600 mt-1.5 italic">{t('workflow.threadsHint')}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block font-medium flex items-center gap-1.5">
                                            <RefreshCw size={12} className="text-teal-400" /> {t('workflow.startupDelay')}
                                        </label>
                                        <input
                                            type="number" min="0" max="60"
                                            value={runConfig.startup_delay}
                                            onChange={e => setRunConfig(c => ({ ...c, startup_delay: e.target.value }))}
                                            className={inputCls}
                                        />
                                        <p className="text-[10px] text-slate-600 mt-1.5 italic">{t('workflow.startupDelayHint')}</p>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Status bar */}
                        <div className="px-8 py-3 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1"><Layers size={12} /> {selectedWf.nodes?.length || 0} {t('workflow.steps')}</span>
                                <span className="flex items-center gap-1"><Filter size={12} /> {runConfig.target_statuses.length} {t('common.status').toLowerCase()}</span>
                                <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(selectedWf.updated_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {t('workflow.ready')}
                            </div>
                        </div>
                    </>
                )}
            </main>

            {/* ── Modals ── */}
            {showCreateModal && (
                <Modal title="Tạo kịch bản mới" onClose={() => setShowCreateModal(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-2 pl-1">Tên kịch bản *</label>
                            <input
                                autoFocus
                                className={inputCls}
                                placeholder="Ví dụ: Reset Password TextNow"
                                value={newWfData.name}
                                onChange={e => setNewWfData({ ...newWfData, name: e.target.value })}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-2 pl-1">Mô tả</label>
                            <textarea
                                rows={2}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 resize-none"
                                placeholder="Mô tả ngắn về kịch bản..."
                                value={newWfData.description}
                                onChange={e => setNewWfData({ ...newWfData, description: e.target.value })}
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-white/5 transition-all">Huỷ</button>
                            <button onClick={handleCreate} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
                                <Plus size={15} /> Tạo & Mở Editor
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {confirmDelete && (
                <ConfirmModal
                    title="Xoá kịch bản"
                    message="Bạn có chắc chắn muốn xoá kịch bản này? Hành động không thể hoàn tác."
                    onConfirm={handleDelete}
                    onClose={() => setConfirmDelete(null)}
                />
            )}
        </div>
    )
}
