import Account from '../models/Account.js';
import Proxy from '../models/Proxy.js';
import mlx from './mlxService.js';
import { connectBrowser, getPage } from './browserService.js';
import socketService from './socketService.js';

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
            // 1. Tìm khối nguồn dữ liệu
            const sourceNode = nodes.find(n => n.type === 'sourceNode');
            if (!sourceNode) throw new Error('Không tìm thấy khối Nguồn dữ liệu');

            const { account_group_id, target_statuses, proxy_group_id } = sourceNode.data.config;

            this._log(executionId, `🔍 Đang lấy danh sách tài khoản từ nhóm...`);
            let query = Account.find({
                group_id: account_group_id,
                status: { $in: target_statuses }
            });

            if (options.testMode) {
                query = query.limit(1);
            }

            const accounts = await query;

            if (accounts.length === 0) {
                this._log(executionId, `⚠️ Không tìm thấy tài khoản nào phù hợp. Kết thúc.`, 'warning');
                exec.status = 'completed';
                socketService.to(executionId).emit('workflow-status', { status: 'completed' });
                return;
            }

            this._log(executionId, `✅ Tìm thấy ${accounts.length} tài khoản. Bắt đầu xử lý tuần tự...`, 'success');

            // 2. Duyệt qua từng tài khoản
            for (let i = 0; i < accounts.length; i++) {
                // Kiểm tra xem user có bấm dừng không
                if (this.activeExecutions.get(executionId)?.status === 'stopping') {
                    throw new Error('USER_ABORTED');
                }

                const account = accounts[i];
                this._log(executionId, `----------------------------------------`);
                this._log(executionId, `👤 [${i + 1}/${accounts.length}] Đang xử lý: ${account.textnow_user}`);

                let context = {
                    account,
                    proxy: null,
                    profileId: null,
                    browser: null,
                    context: null,
                    page: null
                };

                try {
                    // 2.1. Lấy và xoá proxy ngay lập tức nếu có yêu cầu
                    if (proxy_group_id) {
                        const proxy = await Proxy.findOneAndDelete({ group_id: proxy_group_id });
                        if (proxy) {
                            context.proxy = proxy;
                            this._log(executionId, `   + Đã lấy và xoá proxy: ${proxy.host}:${proxy.port}`);
                        } else {
                            this._log(executionId, `   ⚠️ Hết proxy trong nhóm. Tiếp tục không dùng proxy.`, 'warning');
                        }
                    }

                    // 3. Tìm các khối tiếp theo từ Source dựa trên Edges
                    let currentNodeId = sourceNode.id;

                    while (true) {
                        // Kiểm tra dừng giữa các khối
                        if (this.activeExecutions.get(executionId)?.status === 'stopping') {
                            throw new Error('USER_ABORTED');
                        }

                        const edge = edges.find(e => e.source === currentNodeId);
                        if (!edge) break; // Hết quy trình cho tài khoản này

                        const nextNode = nodes.find(n => n.id === edge.target);
                        if (!nextNode) break;

                        await this._executeNode(executionId, nextNode, context);
                        currentNodeId = nextNode.id;
                    }

                    this._log(executionId, `✅ Hoàn thành quy trình cho ${account.textnow_user}`, 'success');
                } catch (nodeErr) {
                    if (nodeErr.message === 'USER_ABORTED') throw nodeErr;
                    this._log(executionId, `❌ Lỗi tại tài khoản ${account.textnow_user}: ${nodeErr.message}`, 'error');
                } finally {
                    this._log(executionId, `ℹ️ Quy trình tài khoản kết thúc. Trình duyệt được giữ nguyên.`);
                }
            }

            this._log(executionId, `✨ TẤT CẢ HOÀN TẤT ✨`, 'success');
            exec.status = 'completed';
            socketService.to(executionId).emit('workflow-status', { status: 'completed' });

        } catch (err) {
            if (err.message === 'USER_ABORTED') {
                this._log(executionId, `🛑 Đã dừng quy trình thành công.`, 'warning');
                exec.status = 'stopped';
                socketService.to(executionId).emit('workflow-status', { status: 'stopped' });
            } else {
                this._log(executionId, `🚨 Lỗi hệ thống: ${err.message}`, 'error');
                exec.status = 'failed';
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
            await this._runNodeLogic(executionId, node, context);

            // Xử lý Delay sau khi thực hiện xong khối
            const delayMin = parseInt(config.delay_min) || 0;
            const delayMax = parseInt(config.delay_max) || 0;

            if (delayMax > 0 && delayMax >= delayMin) {
                const randomDelay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
                if (randomDelay > 0) {
                    this._log(executionId, `   ⏳ Nghỉ ngẫu nhiên ${randomDelay} giây trước khối tiếp theo...`);
                    await this._wait(executionId, randomDelay * 1000);
                }
            }
        } catch (err) {
            throw err;
        }
    }

    async _runNodeLogic(executionId, node, context) {
        const { label, config } = node.data;
        switch (label) {
            case 'Tạo profile mới': {
                // Giả định tạo trên MLX
                const profileName = `${context.account.textnow_user}_${Date.now()}`;
                context.profileId = await mlx.createProfile(profileName, context.proxy, config);
                this._log(executionId, `   + Đã tạo MLX Profile: ${context.profileId}`);
                if (config.url) {
                    this._log(executionId, `   + Landing Page: ${config.url}`);
                }
                if (context.proxy) {
                    this._log(executionId, `   + Đã gán Proxy: ${context.proxy.host}:${context.proxy.port}`);
                }
                break;
            }

            case 'Mở trình duyệt': {
                if (!context.profileId) throw new Error('Cần "Tạo profile" trước khi Mở trình duyệt');

                const { wsEndpoint } = await mlx.startProfile(context.profileId).catch(err => {
                    if (err.message.includes('ECONNREFUSED')) {
                        throw new Error('Không thể kết nối tới MLX Launcher. Hãy đảm bảo ứng dụng Multilogin X đang chạy trên máy tính của bạn.');
                    }
                    throw err;
                });
                const { browser, context: browserContext } = await connectBrowser(wsEndpoint);

                context.browser = browser;
                context.context = browserContext;
                context.page = await getPage(browserContext);

                this._log(executionId, `   + Trình duyệt đã sẵn sàng.`);
                break;
            }

            case 'Mở trang web': {
                if (!context.page) throw new Error('Trình duyệt chưa được mở');
                const resolvedUrl = this._resolveValue(config.url, context);
                await context.page.goto(resolvedUrl, { waitUntil: 'domcontentloaded' });
                this._log(executionId, `   + Đã truy cập: ${resolvedUrl}`);
                break;
            }

            case 'Click chuột': {
                if (!context.page) throw new Error('Trình duyệt chưa được mở');
                await context.page.waitForSelector(config.selector, { timeout: 30000 });
                await context.page.click(config.selector);
                this._log(executionId, `   + Đã click: ${config.selector}`);
                break;
            }

            case 'Nhập văn bản': {
                if (!context.page) throw new Error('Trình duyệt chưa được mở');
                const resolvedValue = this._resolveValue(config.value, context);
                await context.page.waitForSelector(config.selector, { timeout: 30000 });
                await context.page.fill(config.selector, resolvedValue);
                this._log(executionId, `   + Đã nhập vào ${config.selector}: ${resolvedValue.includes('@') ? '***' : resolvedValue}`);
                break;
            }

            case 'Chờ đợi': {
                const ms = (parseInt(config.seconds) || 5) * 1000;
                this._log(executionId, `   + Chờ ${config.seconds} giây...`);
                await this._wait(executionId, ms);
                break;
            }

            case 'Đóng trình duyệt': {
                if (context.browser) {
                    await context.browser.close().catch(() => { });
                    context.browser = null;
                }
                if (context.profileId) {
                    await mlx.stopProfile(context.profileId).catch(() => { });
                    this._log(executionId, `   + Đã đóng trình duyệt & dừng profile: ${context.profileId}`);
                }
                break;
            }

            case 'Xoá profile': {
                if (!context.profileId) throw new Error('Cần profileId để xoá profile');
                await mlx.removeProfile(context.profileId);
                this._log(executionId, `   + Đã xoá profile vĩnh viễn trên cloud.`);
                break;
            }

            case 'Xoá profile local': {
                if (!context.profileId) throw new Error('Cần profileId để xoá folder local');
                await mlx.deleteLocalProfile(context.profileId);
                this._log(executionId, `   + Đã xoá folder profile tại đường dẫn local.`);
                break;
            }

            default:
                this._log(executionId, `   ⚠️ Khối "${label} " chưa được hỗ trợ logic thực thi. Bỏ qua.`, 'warning');
        }
    }

    _log(executionId, message, type = 'info') {
        const exec = this.activeExecutions.get(executionId);
        if (!exec) return;

        const logEntry = {
            time: new Date().toLocaleTimeString(),
            message,
            type
        };

        exec.logs.push(logEntry);

        // Emit via socket
        socketService.to(executionId).emit('workflow-log', logEntry);

        console.log(`[Engine][${executionId}] ${message}`);
    }

    _resolveValue(value, context) {
        if (!value || typeof value !== 'string') return value;

        return value
            .replace(/{{email}}/g, context.account.textnow_user || '')
            .replace(/{{pass}}/g, context.account.textnow_pass || '')
            .replace(/{{hotmail}}/g, context.account.hotmail_user || '')
            .replace(/{{hotmail_pass}}/g, context.account.hotmail_pass || '');
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
