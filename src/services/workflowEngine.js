import Account from '../models/Account.js';
import Proxy from '../models/Proxy.js';
import mlx from './mlxService.js';
import { connectBrowser, getPage } from './browserService.js';

class WorkflowEngine {
    constructor() {
        this.activeExecutions = new Map();
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

            const { account_group_id, target_statuses } = sourceNode.data.config;

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
                return;
            }

            this._log(executionId, `✅ Tìm thấy ${accounts.length} tài khoản. Bắt đầu xử lý tuần tự...`, 'success');

            // 2. Duyệt qua từng tài khoản
            for (let i = 0; i < accounts.length; i++) {
                const account = accounts[i];
                this._log(executionId, `----------------------------------------`);
                this._log(executionId, `👤 [${i + 1}/${accounts.length}] Đang xử lý: ${account.textnow_user}`);

                let context = {
                    account,
                    profileId: null,
                    browser: null,
                    context: null,
                    page: null
                };

                try {
                    // 3. Tìm các khối tiếp theo từ Source dựa trên Edges
                    let currentNodeId = sourceNode.id;

                    while (true) {
                        const edge = edges.find(e => e.source === currentNodeId);
                        if (!edge) break; // Hết quy trình cho tài khoản này

                        const nextNode = nodes.find(n => n.id === edge.target);
                        if (!nextNode) break;

                        await this._executeNode(executionId, nextNode, context);
                        currentNodeId = nextNode.id;
                    }

                    this._log(executionId, `✅ Hoàn thành quy trình cho ${account.textnow_user}`, 'success');
                } catch (nodeErr) {
                    this._log(executionId, `❌ Lỗi tại tài khoản ${account.textnow_user}: ${nodeErr.message}`, 'error');
                } finally {
                    // Cleanup: Đóng trình duyệt sau khi xong
                    if (context.browser) {
                        await context.browser.close().catch(() => { });
                        await mlx.stopProfile(context.profileId).catch(() => { });
                        this._log(executionId, `🔌 Đã đóng trình duyệt & profile.`);
                    }
                }
            }

            this._log(executionId, `✨ TẤT CẢ HOÀN TẤT ✨`, 'success');
            exec.status = 'completed';

        } catch (err) {
            this._log(executionId, `🚨 Lỗi hệ thống: ${err.message}`, 'error');
            exec.status = 'failed';
        }
    }

    /**
     * Thực thi logic cụ thể cho từng loại khối
     */
    async _executeNode(executionId, node, context) {
        const { label, config } = node.data;
        this._log(executionId, `⚙️ Đang thực hiện: ${label}...`);

        switch (label) {
            case 'Tạo profile mới': {
                // Giả định tạo trên MLX
                const profileName = `${context.account.textnow_user}_${Date.now()}`;
                context.profileId = await mlx.createProfile(profileName);
                this._log(executionId, `   + Đã tạo MLX Profile: ${context.profileId}`);
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
                await context.page.goto(config.url, { waitUntil: 'domcontentloaded' });
                this._log(executionId, `   + Đã truy cập: ${config.url}`);
                break;
            }

            case 'Click chuột': {
                if (!context.page) throw new Error('Trình duyệt chưa được mở');
                await context.page.click(config.selector);
                this._log(executionId, `   + Đã click: ${config.selector}`);
                break;
            }

            case 'Nhập văn bản': {
                if (!context.page) throw new Error('Trình duyệt chưa được mở');
                await context.page.fill(config.selector, config.value);
                this._log(executionId, `   + Đã nhập văn bản vào: ${config.selector}`);
                break;
            }

            case 'Chờ đợi': {
                const ms = (parseInt(config.seconds) || 5) * 1000;
                this._log(executionId, `   + Chờ ${config.seconds} giây...`);
                await new Promise(r => setTimeout(r, ms));
                break;
            }

            default:
                this._log(executionId, `   ⚠️ Khối "${label}" chưa được hỗ trợ logic thực thi. Bỏ qua.`, 'warning');
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
        console.log(`[Engine][${executionId}] ${message}`);
    }
}

export default new WorkflowEngine();
