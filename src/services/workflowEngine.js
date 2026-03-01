import Account from '../models/Account.js';
import Proxy from '../models/Proxy.js';
import socketService from './socketService.js';
// Node handlers — each file handles a category of workflow blocks
import { handleKhaiBaoBien, handleLapLai, handleDieuKien, handleChoDoi } from './nodeHandlers/logicNodes.js';
import { handleTaoProfile, handleMoTrinhDuyet, handleKetNoiBrowser, handleMoTrangWeb, handleClickChuot, handleNhapVanBan, handleDongTrinhDuyet, handleXoaProfile, handleXoaProfileLocal, handleCapNhatTrangThai, handleCapNhatMatKhau, handlePerimeterX } from './nodeHandlers/browserNodes.js';
import { handleKiemTraEmail, handleDocEmail, handleXoaMail } from './nodeHandlers/emailNodes.js';

class WorkflowEngine {
    constructor() {
        this.activeExecutions = new Map();
        // Log batch queues: executionId → { logs: [], timer }
        this._logQueues = new Map();
        // Thread meta throttle: executionId+threadId → timer
        this._threadMetaTimers = new Map();
    }

    // ─── Gioi han log ──────────────────────────────────────────────────────────
    static MAX_GLOBAL_LOGS = 5000;   // Toi da log toan cuc trong 1 execution
    static LOG_BATCH_MS = 400;    // Flush log batch moi 400ms
    static THREAD_THROTTLE_MS = 800; // Throttle thread-meta emit moi 800ms

    /**
     * Dừng một quy trình đang chạy
     */
    stop(executionId) {
        const exec = this.activeExecutions.get(executionId);
        if (exec && exec.status === 'running') {
            exec.status = 'stopping';
            this._log(executionId, `🛑 Đang dừng quy trình theo yêu cầu của người dùng...`, 'warning');
            return true;
        }
        return false;
    }

    /**
     * Khởi chạy một quy trình
     */
    async execute(workflow, options = {}) {
        const executionId = `exec_${Date.now()}`;
        console.log(`[Engine] 🚀 Bắt đầu thực thi quy trình: ${workflow.name} (${executionId})`);

        this.activeExecutions.set(executionId, {
            workflowName: workflow.name,
            workflowId: workflow._id,
            status: 'running',
            started_at: new Date(),
            logs: [],           // Global log ring-buffer (MAX_GLOBAL_LOGS entries)
            threads: {},        // Chỉ lưu metadata (KHÔNG có logs[])
            options
        });

        // Khoi tao log queue cho execution nay
        this._logQueues.set(executionId, { logs: [], timer: null });

        // Chạy bất đồng bộ
        this._run(executionId, workflow, options).catch(err => {
            console.error(`[Engine] ❌ Lỗi thực thi quy trình ${workflow.name}:`, err);
        });

        return executionId;
    }

    async _run(executionId, workflow, options = {}) {
        const { nodes, edges } = workflow;
        const exec = this.activeExecutions.get(executionId);

        try {
            // 1. Tìm khối START
            const sourceNode = nodes.find(n => n.type === 'sourceNode');
            if (!sourceNode) throw new Error('Không tìm thấy khối START');

            // 2. Lấy cấu hình runtime
            const {
                account_group_id,
                target_statuses = ['active'],
                proxy_group_id,
                new_password = '',
                limit = null,
                threads = 1,
                startup_delay = 0,
                start_node_id = null,
                ws_endpoint = null,
                profile_id = null,
            } = options;

            if (!account_group_id) throw new Error('Thiếu account_group_id — vui lòng chọn Nhóm tài khoản khi chạy');

            this._log(executionId, `🔍 Đang lấy danh sách tài khoản từ nhóm...`);
            let query = Account.find({
                group_id: account_group_id,
                status: { $in: target_statuses }
            });

            if (limit && limit > 0) {
                query = query.limit(limit);
            }

            const accounts = await query;

            if (accounts.length === 0) {
                this._log(executionId, `⚠️ Không tìm thấy tài khoản nào phù hợp. Kết thúc.`, 'warning');
                exec.status = 'completed';
                socketService.to(executionId).emit('workflow-status', { status: 'completed' });
                return;
            }

            this._log(executionId, `Tim thay ${accounts.length} tai khoan. Chay ${threads} luong song song, khoi dong cach nhau ${startup_delay}s...`, 'success');

            // ── Parallel thread pool ─────────────────────────────────────────────
            const isMultiThread = threads > 1 || accounts.length > 1;
            let activeThreadCount = 0;
            let aborted = false;

            const processAccount = async (account, i) => {
                const threadId = account.textnow_user;

                if (this.activeExecutions.get(executionId)?.status === 'stopping') {
                    throw new Error('USER_ABORTED');
                }

                activeThreadCount++;

                // Init thread entry — CHỈ metadata, không có logs[]
                exec.threads[threadId] = {
                    user: threadId,
                    index: i + 1,
                    total: accounts.length,
                    status: 'running',
                    started_at: new Date(),
                    ended_at: null,
                    error: null,
                };

                // Emit thread-meta (metadata only, no logs)
                this._emitThreadMeta(executionId, threadId);

                this._log(executionId, `[${i + 1}/${accounts.length}] Bat dau xu ly: ${threadId}`, 'default', threadId);

                let context = {
                    account,
                    threadId,
                    proxy: null,
                    profileId: profile_id || null,
                    browser: null,
                    context: null,
                    page: null,
                    new_password,
                    log: (message, type = 'default') => this._log(executionId, message, type, threadId),
                };

                try {
                    // Lấy proxy
                    if (proxy_group_id) {
                        const proxy = await Proxy.findOneAndDelete({ group_id: proxy_group_id });
                        if (proxy) {
                            context.proxy = proxy;
                            context.log(`   + Da lay proxy: ${proxy.host}:${proxy.port}`);
                        } else {
                            context.log(`   Het proxy trong nhom. Tiep tuc khong dung proxy.`, 'warning');
                        }
                    }

                    // Chay graph
                    let startId = sourceNode.id;
                    if (start_node_id) {
                        const targetNode = nodes.find(n => n.id === start_node_id);
                        if (targetNode) {
                            startId = start_node_id;
                            context.log(`   + Resume tu khoi: ${targetNode.data?.label || start_node_id}`);
                        } else {
                            context.log(`   - Khong tim thay start_node_id: ${start_node_id}. Dung START.`, 'warning');
                        }
                    }

                    // Neu co ws_endpoint → ket noi lai browser session
                    if (ws_endpoint) {
                        try {
                            const { connectBrowser, getPage } = await import('./browserService.js');
                            const { browser, context: bCtx } = await connectBrowser(ws_endpoint);
                            context.browser = browser;
                            context.context = bCtx;
                            context.page = await getPage(bCtx);
                            context.wsEndpoint = ws_endpoint;
                            const portMatch = ws_endpoint.match(/(\d{4,5})/);
                            context.log(`   + Ket noi browser tai: ${ws_endpoint.split('/')[2]} (port ${portMatch?.[1] || '?'})`);
                        } catch (err) {
                            context.log(`   - Khong ket noi duoc browser: ${err.message}`, 'error');
                        }
                    }

                    let currentNodeId = startId;
                    let currentResult = true;

                    if (start_node_id && startId !== sourceNode.id) {
                        const startNodeObj = nodes.find(n => n.id === startId);
                        if (startNodeObj) {
                            currentResult = await this._executeNode(executionId, startNodeObj, context, isMultiThread);
                            if (currentResult === undefined || currentResult === null) currentResult = true;
                        }
                    }

                    while (true) {
                        if (this.activeExecutions.get(executionId)?.status === 'stopping') {
                            throw new Error('USER_ABORTED');
                        }

                        const outgoingEdges = edges.filter(e => e.source === currentNodeId);
                        if (outgoingEdges.length === 0) break;

                        let nextEdge = null;
                        if (outgoingEdges.length > 1) {
                            const targetHandle = currentResult ? 'true' : 'false';
                            nextEdge = outgoingEdges.find(e => e.sourceHandle === targetHandle) || outgoingEdges[0];
                        } else {
                            nextEdge = outgoingEdges[0];
                        }

                        const nextNode = nodes.find(n => n.id === nextEdge.target);
                        if (!nextNode) break;

                        currentResult = await this._executeNode(executionId, nextNode, context, isMultiThread);
                        if (currentResult === undefined || currentResult === null) currentResult = true;
                        currentNodeId = nextNode.id;
                    }

                    context.log(`Hoan thanh: ${account.textnow_user}`, 'success');
                    exec.threads[threadId].status = 'success';
                    exec.threads[threadId].ended_at = new Date();
                    this._emitThreadMeta(executionId, threadId, true); // force emit on status change

                } catch (nodeErr) {
                    if (nodeErr.message === 'USER_ABORTED') {
                        aborted = true;
                        exec.threads[threadId].status = 'error';
                        exec.threads[threadId].ended_at = new Date();
                        exec.threads[threadId].error = 'Bi dung';
                        this._emitThreadMeta(executionId, threadId, true);
                        throw nodeErr;
                    }
                    context.log(`Loi: ${nodeErr.message}`, 'error');
                    exec.threads[threadId].status = 'error';
                    exec.threads[threadId].ended_at = new Date();
                    exec.threads[threadId].error = nodeErr.message;
                    this._emitThreadMeta(executionId, threadId, true);
                } finally {
                    activeThreadCount--;
                }
            };

            // Pool N slot cố định
            let accountIndex = 0;

            const runSlot = async (slotIndex) => {
                if (startup_delay > 0 && slotIndex > 0) {
                    const delay = slotIndex * startup_delay * 1000;
                    this._log(executionId, `[Slot ${slotIndex + 1}] Khoi dong sau ${slotIndex * startup_delay}s...`);
                    await new Promise((resolve, reject) => {
                        const check = setInterval(() => {
                            if (this.activeExecutions.get(executionId)?.status === 'stopping') {
                                clearInterval(check); reject(new Error('USER_ABORTED'));
                            }
                        }, 500);
                        setTimeout(() => { clearInterval(check); resolve(); }, delay);
                    }).catch(() => { aborted = true; });
                }
                while (!aborted && this.activeExecutions.get(executionId)?.status !== 'stopping') {
                    const i = accountIndex++;
                    if (i >= accounts.length) break;
                    await processAccount(accounts[i], i);
                }
            };

            await Promise.allSettled(
                Array.from({ length: Math.min(threads, accounts.length) }, (_, slotIndex) => runSlot(slotIndex))
            );

            // Flush pending logs truoc khi done
            this._flushLogs(executionId);

            this._log(executionId, `✨ TẤT CẢ HOÀN TẤT ✨`, 'success');
            exec.status = 'completed';
            exec.ended_at = new Date();
            socketService.to(executionId).emit('workflow-status', { status: 'completed' });

        } catch (err) {
            this._flushLogs(executionId);
            if (err.message === 'USER_ABORTED') {
                this._log(executionId, `🛑 Đã dừng quy trình thành công.`, 'warning');
                exec.status = 'stopped';
                exec.ended_at = new Date();
                socketService.to(executionId).emit('workflow-status', { status: 'stopped' });
            } else {
                this._log(executionId, `🚨 Lỗi hệ thống: ${err.message}`, 'error');
                exec.status = 'failed';
                exec.ended_at = new Date();
                socketService.to(executionId).emit('workflow-status', { status: 'failed' });
            }
        } finally {
            // Cleanup queue
            const q = this._logQueues.get(executionId);
            if (q?.timer) clearTimeout(q.timer);
            this._logQueues.delete(executionId);
        }

        this._cleanupOldExecutions(executionId);
    }

    // ─── Emit thread metadata only (no logs) ──────────────────────────────────
    _emitThreadMeta(executionId, threadId, force = false) {
        const exec = this.activeExecutions.get(executionId);
        if (!exec) return;
        const meta = exec.threads[threadId];
        if (!meta) return;

        const key = `${executionId}:${threadId}`;

        // Force emit ngay (status change)
        if (force) {
            const prev = this._threadMetaTimers.get(key);
            if (prev) { clearTimeout(prev); this._threadMetaTimers.delete(key); }
            socketService.to(executionId).emit('workflow-thread-meta', { threadId, meta });
            return;
        }

        // Throttled emit
        if (!this._threadMetaTimers.has(key)) {
            this._threadMetaTimers.set(key, setTimeout(() => {
                this._threadMetaTimers.delete(key);
                const currentExec = this.activeExecutions.get(executionId);
                if (currentExec?.threads[threadId]) {
                    socketService.to(executionId).emit('workflow-thread-meta', {
                        threadId,
                        meta: currentExec.threads[threadId]
                    });
                }
            }, WorkflowEngine.THREAD_THROTTLE_MS));
        }
    }

    // ─── Batch log flush ──────────────────────────────────────────────────────
    _flushLogs(executionId) {
        const q = this._logQueues.get(executionId);
        if (!q || q.logs.length === 0) return;
        const batch = q.logs.splice(0);
        if (q.timer) { clearTimeout(q.timer); q.timer = null; }
        socketService.to(executionId).emit('workflow-log-batch', batch);
    }

    _cleanupOldExecutions(currentId) {
        const MAX_KEEP = 30;
        const MAX_AGE_MS = 30 * 60 * 1000;
        const now = Date.now();

        for (const [id, ex] of this.activeExecutions.entries()) {
            if (id === currentId || ex.status === 'running' || ex.status === 'stopping') continue;
            const age = now - new Date(ex.ended_at || ex.started_at).getTime();
            if (age > MAX_AGE_MS) {
                this.activeExecutions.delete(id);
                console.log(`[Engine] ♻️  Xoa execution cu (${Math.round(age / 60000)}m): ${id}`);
            }
        }

        const done = [...this.activeExecutions.entries()]
            .filter(([id, ex]) => id !== currentId && ex.status !== 'running' && ex.status !== 'stopping')
            .sort((a, b) => new Date(a[1].ended_at || 0) - new Date(b[1].ended_at || 0));

        while (this.activeExecutions.size > MAX_KEEP && done.length > 0) {
            const [oldId] = done.shift();
            this.activeExecutions.delete(oldId);
            console.log(`[Engine] ♻️  Xoa execution vuot gioi han: ${oldId}`);
        }
    }

    /**
     * Thực thi logic cụ thể cho từng loại khối
     */
    async _executeNode(executionId, node, context, isMultiThread = false) {
        const { label, config } = node.data;
        const tid = context.threadId || null;
        this._log(executionId, `⚙️ Đang thực hiện: ${label}...`, 'default', tid);

        // Chỉ emit node-active khi single thread (không spam khi multi-thread)
        if (!isMultiThread) {
            socketService.to(executionId).emit('workflow-node-active', { nodeId: node.id });
        }

        try {
            const timeoutSec = parseInt(config?.timeout) || 60;

            const result = await Promise.race([
                this._runNodeLogic(executionId, node, context),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`⏰ Khối "${label}" đã vượt quá thời gian chờ (${timeoutSec}s)`)), timeoutSec * 1000)
                )
            ]);

            const delayMin = parseInt(config?.delay_min) || 0;
            const delayMax = parseInt(config?.delay_max) || 0;

            if (delayMax > 0 && delayMax >= delayMin) {
                const randomDelay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
                if (randomDelay > 0) {
                    this._log(executionId, `   ⏳ Nghỉ ngẫu nhiên ${randomDelay} giây trước khối tiếp theo...`, 'default', tid);
                    await this._wait(executionId, randomDelay * 1000);
                }
            }

            return result;
        } catch (err) {
            if (err.message === 'USER_ABORTED') throw err;
            this._log(executionId, `   Lỗi: ${err.message}`, 'error', tid);
            return false;
        }
    }

    /**
     * _runNodeLogic: Dispatcher
     */
    async _runNodeLogic(executionId, node, context) {
        const { label, config } = node.data;
        switch (label) {
            // ── Logic ─────────────────────────────────────────────────────────
            case 'Khai báo biến': return handleKhaiBaoBien(executionId, config, context, this);
            case 'Lặp lại': return handleLapLai(executionId, config, context, node, this);
            case 'Điều kiện': return handleDieuKien(executionId, config, context, this);
            case 'Chờ đợi': return handleChoDoi(executionId, config, context, this);
            // ── Browser / Profile ─────────────────────────────────────────────
            case 'Tạo profile mới': return handleTaoProfile(executionId, config, context, this);
            case 'Mở trình duyệt': return handleMoTrinhDuyet(executionId, config, context, this);
            case 'Kết nối Browser': return handleKetNoiBrowser(executionId, config, context, this);
            case 'Mở trang web': return handleMoTrangWeb(executionId, config, context, this);
            case 'Click chuột': return handleClickChuot(executionId, config, context, this);
            case 'Nhập văn bản': return handleNhapVanBan(executionId, config, context, this);
            case 'Đóng trình duyệt': return handleDongTrinhDuyet(executionId, config, context, this);
            case 'Xoá profile': return handleXoaProfile(executionId, config, context, this);
            case 'Xoá profile local': return handleXoaProfileLocal(executionId, config, context, this);
            case 'Cập nhật trạng thái': return handleCapNhatTrangThai(executionId, config, context, this);
            case 'Cập nhật mật khẩu': return handleCapNhatMatKhau(executionId, config, context, this);
            case 'PerimeterX': return handlePerimeterX(executionId, config, context, this);
            // ── Email ─────────────────────────────────────────────────────────
            case 'Kiểm tra Email': return handleKiemTraEmail(executionId, config, context, this);
            case 'Đọc Email': return handleDocEmail(executionId, config, context, this);
            case 'Xoá tất cả Mail': return handleXoaMail(executionId, config, context, this);

            default:
                this._log(executionId, `   ⚠️ Khối "${label}" chưa được hỗ trợ. Bỏ qua.`, 'warning');
        }
    }

    /**
     * _log — thêm vào ring-buffer + batch queue
     */
    _log(executionId, message, type = 'default', threadId = null) {
        const exec = this.activeExecutions.get(executionId);
        if (!exec) return;

        const logEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            message,
            type,
            threadId: threadId || null,
        };

        // Ring-buffer global logs
        exec.logs.push(logEntry);
        if (exec.logs.length > WorkflowEngine.MAX_GLOBAL_LOGS) {
            exec.logs.splice(0, exec.logs.length - WorkflowEngine.MAX_GLOBAL_LOGS);
        }

        // Batch queue → flush moi LOG_BATCH_MS
        const q = this._logQueues.get(executionId);
        if (q) {
            q.logs.push(logEntry);
            if (!q.timer) {
                q.timer = setTimeout(() => {
                    this._flushLogs(executionId);
                }, WorkflowEngine.LOG_BATCH_MS);
            }
        }

        console.log(`[Engine][${executionId?.slice(-8)}][${threadId || 'sys'}] ${message}`);
    }

    _resolveValue(value, context) {
        if (!value || typeof value !== 'string') return value;
        const randomStr = len => Array.from({ length: len }, () =>
            'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]
        ).join('');
        return value.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
            if (key === 'email') return context.account?.textnow_user || '';
            if (key === 'pass') return context.account?.textnow_pass || '';
            if (key === 'hotmail') return context.account?.hotmail_user || '';
            if (key === 'hotmail_pass') return context.account?.hotmail_pass || '';
            const m = key.match(/^random(\d+)$/);
            if (m) return randomStr(parseInt(m[1]));
            return context[key] || '';
        });
    }

    async _wait(executionId, ms) {
        const startWait = Date.now();
        while (Date.now() - startWait < ms) {
            if (this.activeExecutions.get(executionId)?.status === 'stopping') {
                throw new Error('USER_ABORTED');
            }
            await new Promise(r => setTimeout(r, 500));
        }
    }
}

export default new WorkflowEngine();
