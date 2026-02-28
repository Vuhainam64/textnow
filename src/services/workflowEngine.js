import Account from '../models/Account.js';
import Proxy from '../models/Proxy.js';
import socketService from './socketService.js';
// Node handlers — each file handles a category of workflow blocks
import { handleKhaiBaoBien, handleLapLai, handleDieuKien, handleChoDoi } from './nodeHandlers/logicNodes.js';
import { handleTaoProfile, handleMoTrinhDuyet, handleMoTrangWeb, handleClickChuot, handleNhapVanBan, handleDongTrinhDuyet, handleXoaProfile, handleXoaProfileLocal, handleCapNhatTrangThai, handlePerimeterX } from './nodeHandlers/browserNodes.js';
import { handleKiemTraEmail, handleDocEmail, handleXoaMail } from './nodeHandlers/emailNodes.js';

class WorkflowEngine {
    constructor() {
        this.activeExecutions = new Map();
    }

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
            workflow,
            status: 'running',
            started_at: new Date(),
            logs: [],
            threads: {},   // accountUser → { status, logs, started_at, ended_at }
            options
        });

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
            // 1. Tìm khối START (entry point của graph)
            const sourceNode = nodes.find(n => n.type === 'sourceNode');
            if (!sourceNode) throw new Error('Không tìm thấy khối START');

            // 2. Lấy cấu hình runtime từ options
            const {
                account_group_id,
                target_statuses = ['active'],
                proxy_group_id,
                new_password = '',
                limit = null,       // null = không giới hạn, số = chạy tối đa N acc
                threads = 1,
                startup_delay = 0,
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

            // ── Parallel thread pool ────────────────────────────────────────────
            // Ghi chú: mỗi account chạy độc lập trong 1 "luồng" (async task).
            // Tối đa `threads` tài khoản chạy cùng lúc.
            // Mỗi tài khoản bắt đầu sau `startup_delay` giây so với tài khoản trước.
            let activeThreads = 0;
            let aborted = false;

            const processAccount = async (account, i) => {
                const threadId = account.textnow_user;

                // Stagger: chờ i * startup_delay giây trước khi bắt đầu
                if (startup_delay > 0 && i > 0) {
                    const delay = i * startup_delay * 1000;
                    this._log(executionId, `[Luong ${i + 1}] Cho ${startup_delay}s truoc khi khoi dong...`, 'default', threadId);
                    await new Promise((resolve, reject) => {
                        const check = setInterval(() => {
                            if (this.activeExecutions.get(executionId)?.status === 'stopping') {
                                clearInterval(check);
                                reject(new Error('USER_ABORTED'));
                            }
                        }, 500);
                        setTimeout(() => { clearInterval(check); resolve(); }, delay);
                    });
                }

                if (this.activeExecutions.get(executionId)?.status === 'stopping') {
                    throw new Error('USER_ABORTED');
                }

                activeThreads++;

                // Init thread entry
                exec.threads[threadId] = {
                    user: threadId,
                    index: i + 1,
                    total: accounts.length,
                    status: 'running',
                    started_at: new Date(),
                    ended_at: null,
                    logs: [],
                };
                exec.currentThreadId = threadId;

                socketService.to(executionId).emit('workflow-thread-update', {
                    threadId,
                    thread: exec.threads[threadId]
                });

                this._log(executionId, `[${i + 1}/${accounts.length}] Bat dau xu ly: ${threadId}`, 'default', threadId);

                let context = {
                    account,
                    threadId,
                    proxy: null,
                    profileId: null,
                    browser: null,
                    context: null,
                    page: null
                };

                try {
                    // Lấy proxy
                    if (proxy_group_id) {
                        const proxy = await Proxy.findOneAndDelete({ group_id: proxy_group_id });
                        if (proxy) {
                            context.proxy = proxy;
                            this._log(executionId, `   + Da lay proxy: ${proxy.host}:${proxy.port}`, 'default', threadId);
                        } else {
                            this._log(executionId, `   Het proxy trong nhom. Tiep tuc khong dung proxy.`, 'warning', threadId);
                        }
                    }

                    // Chạy graph
                    let currentNodeId = sourceNode.id;
                    let currentResult = true;

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

                        currentResult = await this._executeNode(executionId, nextNode, context);
                        if (currentResult === undefined || currentResult === null) currentResult = true;
                        currentNodeId = nextNode.id;
                    }

                    this._log(executionId, `Hoan thanh: ${account.textnow_user}`, 'success', threadId);
                    exec.threads[threadId].status = 'success';
                    exec.threads[threadId].ended_at = new Date();
                    socketService.to(executionId).emit('workflow-thread-update', {
                        threadId,
                        thread: exec.threads[threadId]
                    });
                } catch (nodeErr) {
                    if (nodeErr.message === 'USER_ABORTED') {
                        aborted = true;
                        exec.threads[threadId].status = 'error';
                        exec.threads[threadId].ended_at = new Date();
                        exec.threads[threadId].error = 'Bi dung';
                        socketService.to(executionId).emit('workflow-thread-update', { threadId, thread: exec.threads[threadId] });
                        throw nodeErr;
                    }
                    this._log(executionId, `Loi: ${nodeErr.message}`, 'error', threadId);
                    exec.threads[threadId].status = 'error';
                    exec.threads[threadId].ended_at = new Date();
                    exec.threads[threadId].error = nodeErr.message;
                    socketService.to(executionId).emit('workflow-thread-update', {
                        threadId,
                        thread: exec.threads[threadId]
                    });
                } finally {
                    activeThreads--;
                    exec.currentThreadId = null;
                }
            };

            // Chạy với giới hạn concurrency = threads
            // Dùng sliding window: launch theo nhóm `threads`, chờ nhóm xong rồi tiếp
            const chunks = [];
            for (let i = 0; i < accounts.length; i += threads) {
                chunks.push(accounts.slice(i, i + threads));
            }

            for (const chunk of chunks) {
                if (aborted || this.activeExecutions.get(executionId)?.status === 'stopping') break;
                const startIndex = accounts.indexOf(chunk[0]);
                await Promise.allSettled(
                    chunk.map((account, j) => processAccount(account, startIndex + j))
                );
            }

            this._log(executionId, `✨ TẤT CẢ HOÀN TẤT ✨`, 'success');
            exec.status = 'completed';
            exec.ended_at = new Date();
            socketService.to(executionId).emit('workflow-status', { status: 'completed' });

        } catch (err) {
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
        }
    }

    /**
     * Thực thi logic cụ thể cho từng loại khối
     */
    async _executeNode(executionId, node, context) {
        const { label, config } = node.data;
        this._log(executionId, `⚙️ Đang thực hiện: ${label}...`);

        try {
            const timeoutSec = parseInt(config?.timeout) || 60;

            // Race giữa logic node và timeout
            const result = await Promise.race([
                this._runNodeLogic(executionId, node, context),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`⏰ Khối "${label}" đã vượt quá thời gian chờ (${timeoutSec}s)`)), timeoutSec * 1000)
                )
            ]);

            // Xử lý Delay ngẫu nhiên sau khi thực hiện xong khối
            const delayMin = parseInt(config?.delay_min) || 0;
            const delayMax = parseInt(config?.delay_max) || 0;

            if (delayMax > 0 && delayMax >= delayMin) {
                const randomDelay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
                if (randomDelay > 0) {
                    this._log(executionId, `   ⏳ Nghỉ ngẫu nhiên ${randomDelay} giây trước khối tiếp theo...`);
                    await this._wait(executionId, randomDelay * 1000);
                }
            }

            return result;
        } catch (err) {
            throw err;
        }
    }

    /**
     * _runNodeLogic: Dispatcher - chuyển sang handler tương ứng theo label
     * Labels phải khớp CHÍNH XÁC với constants.js trong dashboard
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
            case 'Mở trang web': return handleMoTrangWeb(executionId, config, context, this);
            case 'Click chuột': return handleClickChuot(executionId, config, context, this);
            case 'Nhập văn bản': return handleNhapVanBan(executionId, config, context, this);
            case 'Đóng trình duyệt': return handleDongTrinhDuyet(executionId, config, context, this);
            case 'Xoá profile': return handleXoaProfile(executionId, config, context, this);
            case 'Xoá profile local': return handleXoaProfileLocal(executionId, config, context, this);
            case 'Cập nhật trạng thái': return handleCapNhatTrangThai(executionId, config, context, this);
            case 'PerimeterX': return handlePerimeterX(executionId, config, context, this);
            // ── Email ─────────────────────────────────────────────────────────
            case 'Kiểm tra Email': return handleKiemTraEmail(executionId, config, context, this);
            case 'Đọc Email': return handleDocEmail(executionId, config, context, this);
            case 'Xoá tất cả Mail': return handleXoaMail(executionId, config, context, this);

            default:
                this._log(executionId, `   ⚠️ Khối "${label}" chưa được hỗ trợ. Bỏ qua.`, 'warning');
        }
    }

    _log(executionId, message, type = 'default', threadId = null) {
        const exec = this.activeExecutions.get(executionId);
        if (!exec) return;

        const effectiveThreadId = threadId || exec.currentThreadId || null;

        const logEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            message,
            type,
            threadId: effectiveThreadId,
        };

        exec.logs.push(logEntry);

        if (effectiveThreadId && exec.threads[effectiveThreadId]) {
            exec.threads[effectiveThreadId].logs.push(logEntry);
            socketService.to(executionId).emit('workflow-thread-update', {
                threadId: effectiveThreadId,
                thread: exec.threads[effectiveThreadId]
            });
        }

        socketService.to(executionId).emit('workflow-log', logEntry);
        console.log(`[Engine][${executionId}] ${message}`);
    }

    _resolveValue(value, context) {
        if (!value || typeof value !== 'string') return value;
        return value.replace(/{{(\w+)}}/g, (_, key) => {
            if (key === 'email') return context.account?.textnow_user || '';
            if (key === 'pass') return context.account?.textnow_pass || '';
            if (key === 'hotmail') return context.account?.hotmail_user || '';
            if (key === 'hotmail_pass') return context.account?.hotmail_pass || '';
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
