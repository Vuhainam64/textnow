import Account from '../models/Account.js';
import Proxy from '../models/Proxy.js';
import mlx from './mlxService.js';
import { connectBrowser, getPage } from './browserService.js';
import socketService from './socketService.js';
import Imap from 'imap';
import axios from 'axios';
import { simpleParser } from 'mailparser';

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

    async _runNodeLogic(executionId, node, context) {
        const { label, config } = node.data;
        switch (label) {
            case 'Khai báo biến': {
                // Parse multi-line "key=value" pairs and store in context
                const lines = (config.variables || '').split('\n');
                let count = 0;
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    const eqIdx = trimmed.indexOf('=');
                    if (eqIdx === -1) continue;
                    const key = trimmed.substring(0, eqIdx).trim();
                    const val = trimmed.substring(eqIdx + 1).trim();
                    if (!key) continue;
                    // Resolve value so you can use {{email}} etc in default values too
                    context[key] = this._resolveValue(val, context);
                    count++;
                }
                this._log(executionId, `   + Đã khai báo ${count} biến vào context.`);
                return true;
            }

            case 'Lặp lại': {
                // Đếm số lần node này đã được thực thi trong lần chạy tài khoản hiện tại
                const loopKey = `_loop_${node.id}`;
                context[loopKey] = (context[loopKey] || 0) + 1;

                const maxRetries = parseInt(config.max_retries) || 3;

                if (context[loopKey] <= maxRetries) {
                    this._log(executionId, `   🔄 Lần thử ${context[loopKey]}/${maxRetries}...`);
                    return true;  // → nhánh TRUE: vào vòng lặp
                } else {
                    // Reset bộ đếm để tái sử dụng nếu cần
                    delete context[loopKey];
                    this._log(executionId, `   ❌ Đã thử ${maxRetries} lần — thoát vòng lặp.`, 'warning');
                    return false; // → nhánh FALSE: thoát vòng lặp
                }
            }

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
                if (!context.profileId) {
                    this._log(executionId, `   ❌ Cần "Tạo profile" trước khi Mở trình duyệt`, 'error');
                    return false;
                }
                try {
                    const { wsEndpoint } = await mlx.startProfile(context.profileId).catch(err => {
                        // ECONNREFUSED = MLX không chạy → throw để báo lỗi hệ thống nghiêm trọng
                        if (err.message.includes('ECONNREFUSED')) {
                            throw new Error('Không thể kết nối MLX Launcher. Hãy đảm bảo Multilogin X đang chạy.');
                        }
                        throw err;
                    });
                    const { browser, context: browserContext } = await connectBrowser(wsEndpoint);
                    context.browser = browser;
                    context.context = browserContext;
                    context.page = await getPage(browserContext);
                    this._log(executionId, `   + Trình duyệt đã sẵn sàng.`);
                    return true;
                } catch (err) {
                    if (err.message.includes('MLX Launcher')) throw err; // Re-throw critical
                    this._log(executionId, `   ❌ Không mở được trình duyệt: ${err.message}`, 'error');
                    return false;
                }
            }

            case 'Mở trang web': {
                if (!context.page) {
                    this._log(executionId, `   ❌ Trình duyệt chưa được mở`, 'error');
                    return false;
                }
                try {
                    const resolvedUrl = this._resolveValue(config.url, context);
                    if (!resolvedUrl) {
                        this._log(executionId, `   ❌ URL rỗng (biến chưa được điền?)`, 'error');
                        return false;
                    }
                    await context.page.goto(resolvedUrl, { waitUntil: 'domcontentloaded', timeout: (parseInt(config.timeout) || 30) * 1000 });
                    this._log(executionId, `   + Đã truy cập: ${resolvedUrl}`);
                    return true;
                } catch (err) {
                    this._log(executionId, `   ❌ Không mở được trang: ${err.message}`, 'error');
                    return false;
                }
            }

            case 'Click chuột': {
                if (!context.page) {
                    this._log(executionId, `   ❌ Trình duyệt chưa được mở`, 'error');
                    return false;
                }
                try {
                    const resolvedSelector = this._resolveValue(config.selector, context);
                    await context.page.waitForSelector(resolvedSelector, { timeout: (parseInt(config.timeout) || 30) * 1000 });
                    await context.page.click(resolvedSelector);
                    this._log(executionId, `   + Đã click: ${resolvedSelector}`);
                    return true;
                } catch (err) {
                    this._log(executionId, `   ❌ Không click được "${config.selector}": ${err.message}`, 'error');
                    return false;
                }
            }

            case 'Nhập văn bản': {
                if (!context.page) {
                    this._log(executionId, `   ❌ Trình duyệt chưa được mở`, 'error');
                    return false;
                }
                try {
                    const resolvedSelector = this._resolveValue(config.selector, context);
                    const resolvedValue = this._resolveValue(config.value, context);
                    await context.page.waitForSelector(resolvedSelector, { timeout: (parseInt(config.timeout) || 30) * 1000 });
                    await context.page.fill(resolvedSelector, resolvedValue);
                    const displayVal = resolvedValue.includes('@') ? '***' : resolvedValue;
                    this._log(executionId, `   + Đã nhập vào ${resolvedSelector}: ${displayVal}`);
                    return true;
                } catch (err) {
                    this._log(executionId, `   ❌ Không nhập được vào "${config.selector}": ${err.message}`, 'error');
                    return false;
                }
            }

            case 'Chờ đợi': {
                const ms = (parseInt(config.seconds) || 5) * 1000;
                this._log(executionId, `   + Chờ ${config.seconds} giây...`);
                await this._wait(executionId, ms);
                return true;
            }

            case 'Điều kiện': {
                if (!context.page) {
                    this._log(executionId, `   ❌ Trình duyệt chưa được mở`, 'error');
                    return false;
                }
                const { type, selector } = config;
                const resolvedSelector = this._resolveValue(selector, context);
                this._log(executionId, `   + Kiểm tra: ${type} với "${resolvedSelector}"`);
                if (!resolvedSelector) return false;
                const condTimeout = (parseInt(config.timeout) || 10) * 1000;
                try {
                    if (type === 'element_exists') {
                        await context.page.waitForSelector(resolvedSelector, { timeout: condTimeout });
                        this._log(executionId, `   + ✅ Phần tử tồn tại`);
                        return true;
                    } else if (type === 'element_not_exists') {
                        await context.page.waitForSelector(resolvedSelector, { state: 'hidden', timeout: condTimeout });
                        this._log(executionId, `   + ✅ Phần tử đã biến mất`);
                        return true;
                    } else if (type === 'text_exists') {
                        const content = await context.page.content();
                        const found = content.includes(resolvedSelector);
                        this._log(executionId, found ? `   + ✅ Tìm thấy text` : `   - ❌ Không tìm thấy text`);
                        return found;
                    }
                    return false;
                } catch {
                    this._log(executionId, `   - ❌ Không tìm thấy / timeout`);
                    return false;
                }
            }

            case 'Kiểm tra Email': {
                const { hotmail_user: mail, hotmail_pass: password, hotmail_client_id: clientId, hotmail_token: refreshToken } = context.account;
                const maxRetries = parseInt(config.retries) || 1;

                this._log(executionId, `   + Đang kiểm tra trạng thái Hotmail: ${mail} (Thử tối đa ${maxRetries} lần)...`);

                if (!mail || !refreshToken || !clientId) {
                    this._log(executionId, `   - Thiếu cấu hình Hotmail (Email/CID/Token)`, 'error');
                    return false;
                }

                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        if (attempt > 1) {
                            this._log(executionId, `   ⏳ Đang thử lại lần ${attempt}/${maxRetries}...`);
                            await this._wait(executionId, 3000);
                        }

                        // 1. Get Access Token via OAuth2
                        const tokenData = new URLSearchParams({
                            client_id: clientId,
                            grant_type: 'refresh_token',
                            refresh_token: refreshToken
                        });

                        const res = await axios.post(
                            'https://login.live.com/oauth20_token.srf',
                            tokenData.toString(),
                            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                        );

                        const accessToken = res.data.access_token;
                        const authString = Buffer.from(`user=${mail}\u0001auth=Bearer ${accessToken}\u0001\u0001`).toString('base64');

                        // 2. Try IMAP Connection
                        const isLive = await new Promise((resolve) => {
                            const imap = new Imap({
                                user: mail,
                                xoauth2: authString,
                                host: 'outlook.office365.com',
                                port: 993,
                                tls: true,
                                tlsOptions: { rejectUnauthorized: false },
                                connTimeout: 10000,
                                authTimeout: 10000
                            });

                            imap.once('ready', () => {
                                imap.end();
                                resolve(true);
                            });

                            imap.once('error', (err) => {
                                this._log(executionId, `   - Lỗi lần ${attempt}: ${err.message}`);
                                resolve(false);
                            });

                            imap.connect();
                        });

                        if (isLive) {
                            this._log(executionId, `   + Email đang hoạt động tốt (IMAP Ready).`);
                            return true;
                        }
                    } catch (err) {
                        this._log(executionId, `   - Lỗi xác thực hoặc kết nối lần ${attempt}: ${err.response?.data?.error_description || err.message}`);
                    }
                }

                this._log(executionId, `   ❌ Đã thử ${maxRetries} lần nhưng không thành công.`);
                return false;
            }

            case 'Đọc Email': {
                const { hotmail_user: mail, hotmail_client_id: clientId, hotmail_token: refreshToken } = context.account;
                const maxRetries = parseInt(config.retries) || 3;
                const waitSeconds = parseInt(config.wait_seconds) || 30;
                const fromFilter = config.from || '';
                const subjectFilter = config.subject_contains || '';
                const extractType = config.extract_type || 'link';
                const extractPattern = config.extract_pattern || '';
                const outputVar = config.output_variable || 'result';

                this._log(executionId, `   + Tìm email [from: ${fromFilter || 'bất kỳ'}] [tiêu đề chứa: "${subjectFilter || 'bất kỳ'}"]...`);

                if (!mail || !refreshToken || !clientId) {
                    this._log(executionId, `   - Thiếu cấu hình Hotmail (Email/CID/Token)`, 'error');
                    return false;
                }

                // Helper: Get OAuth token
                const getToken = async () => {
                    const data = new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken });
                    const res = await axios.post('https://login.live.com/oauth20_token.srf', data.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                    return res.data.access_token;
                };

                // Helper: Fetch matching email from IMAP
                const fetchEmail = (accessToken) => new Promise((resolve, reject) => {
                    const authStr = Buffer.from(`user=${mail}\u0001auth=Bearer ${accessToken}\u0001\u0001`).toString('base64');
                    const imap = new Imap({ user: mail, xoauth2: authStr, host: 'outlook.office365.com', port: 993, tls: true, tlsOptions: { rejectUnauthorized: false }, connTimeout: 15000, authTimeout: 15000 });

                    imap.once('ready', () => {
                        imap.openBox('INBOX', true, (err) => {
                            if (err) { imap.end(); return reject(err); }

                            // Build IMAP search criteria
                            const searchCriteria = [['SINCE', new Date(Date.now() - 15 * 60 * 1000)]];
                            if (fromFilter) searchCriteria.push(['FROM', fromFilter]);
                            if (subjectFilter) searchCriteria.push(['SUBJECT', subjectFilter]);

                            imap.search(searchCriteria, (err, results) => {
                                if (err) { imap.end(); return reject(err); }
                                if (!results || results.length === 0) { imap.end(); return resolve(null); }

                                const latest = [results[results.length - 1]];
                                const fetch = imap.fetch(latest, { bodies: '' });
                                let emailData = null;

                                fetch.on('message', (msg) => {
                                    msg.on('body', async (stream) => { emailData = await simpleParser(stream); });
                                });
                                fetch.once('end', () => { imap.end(); resolve(emailData); });
                                fetch.once('error', (err) => { imap.end(); reject(err); });
                            });
                        });
                    });

                    imap.once('error', (err) => reject(err));
                    imap.connect();
                });

                // Helper: Extract value from email based on extract_type
                const extract = (email) => {
                    const html = email.html || email.textAsHtml || '';
                    const text = email.text || '';
                    const subject = email.subject || '';

                    switch (extractType) {
                        case 'link': {
                            if (extractPattern) {
                                // User-defined regex — use 'si' flags (case-insensitive + dotAll for multiline HTML)
                                const m = html.match(new RegExp(extractPattern, 'si'));
                                return m ? (m[1] || m[0]) : null;
                            }
                            // Default: first https href in HTML (note: may not be the desired link!)
                            const allLinks = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)];
                            return allLinks.length > 0 ? allLinks[0][1] : null;
                        }
                        case 'otp_subject': {
                            const pattern = extractPattern || '(\\d{4,8})';
                            const m = subject.match(new RegExp(pattern, 'i'));
                            return m ? (m[1] || m[0]) : null;
                        }
                        case 'otp_body': {
                            const pattern = extractPattern || '(?:^|\\s)(\\d{4,8})(?:\\s|$)';
                            const m = text.match(new RegExp(pattern, 'im'));
                            return m ? (m[1] || m[0]).trim() : null;
                        }
                        case 'regex': {
                            // Custom regex — applied to HTML first then plain text, with 'si' flags
                            if (!extractPattern) return null;
                            const m = html.match(new RegExp(extractPattern, 'si')) || text.match(new RegExp(extractPattern, 'si'));
                            return m ? (m[1] || m[0]) : null;
                        }
                        default:
                            return null;
                    }
                };

                // Retry loop
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        if (attempt > 1) {
                            this._log(executionId, `   ⏳ Chờ ${waitSeconds}s trước lần thử ${attempt}/${maxRetries}...`);
                            await this._wait(executionId, waitSeconds * 1000);
                        }

                        const accessToken = await getToken();
                        const email = await fetchEmail(accessToken);

                        if (!email) {
                            this._log(executionId, `   - Chưa tìm thấy email phù hợp. Thử lại...`);
                            continue;
                        }

                        this._log(executionId, `   + Tìm thấy email: "${email.subject}"`);
                        const value = extract(email);

                        if (value) {
                            context[outputVar] = value;
                            const preview = value.length > 80 ? value.substring(0, 80) + '...' : value;
                            this._log(executionId, `   + ✅ Trích xuất thành công [${outputVar}]: ${preview}`);
                            return true;
                        } else {
                            this._log(executionId, `   ⚠️ Email tìm thấy nhưng không trích xuất được dữ liệu.`, 'warning');
                        }
                    } catch (err) {
                        this._log(executionId, `   - Lỗi lần ${attempt}: ${err.message}`);
                    }
                }

                this._log(executionId, `   ❌ Đã thử ${maxRetries} lần, không lấy được dữ liệu.`);
                return false;
            }


            case 'Xoá tất cả Mail': {
                const { hotmail_user: mail, hotmail_client_id: clientId, hotmail_token: refreshToken } = context.account;
                const targetFolders = (config.folders || 'INBOX,Junk').split(',').map(f => f.trim());

                this._log(executionId, `   + Đang tiến hành xoá mail cho: ${mail}...`);

                try {
                    const tokenData = new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken });
                    const res = await axios.post('https://login.live.com/oauth20_token.srf', tokenData.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                    const accessToken = res.data.access_token;
                    const authString = Buffer.from(`user=${mail}\u0001auth=Bearer ${accessToken}\u0001\u0001`).toString('base64');

                    return new Promise((resolve) => {
                        const imap = new Imap({ user: mail, xoauth2: authString, host: 'outlook.office365.com', port: 993, tls: true, tlsOptions: { rejectUnauthorized: false } });

                        imap.once('ready', async () => {
                            for (const folder of targetFolders) {
                                try {
                                    await new Promise((resFolder, rejFolder) => {
                                        imap.openBox(folder, false, (err) => {
                                            if (err) return resFolder();
                                            imap.search(['ALL'], (err, results) => {
                                                if (err || !results || results.length === 0) return resFolder();
                                                this._log(executionId, `   + Tìm thấy ${results.length} mail trong ${folder}. Đang xoá...`);
                                                imap.addFlags(results, '\\Deleted', (err) => {
                                                    if (err) return rejFolder(err);
                                                    imap.expunge((err) => { if (err) return rejFolder(err); resFolder(); });
                                                });
                                            });
                                        });
                                    });
                                } catch (err) {
                                    this._log(executionId, `   ⚠️ Lỗi xoá mail trong ${folder}: ${err.message}`, 'warning');
                                }
                            }
                            this._log(executionId, `   + Đã xoá sạch mail trong các thư mục: ${targetFolders.join(', ')}`);
                            imap.end();
                            resolve(true);
                        });

                        imap.once('error', (err) => { this._log(executionId, `   - Lỗi IMAP: ${err.message}`); resolve(false); });
                        imap.connect();
                    });
                } catch (err) {
                    this._log(executionId, `   - Lỗi thực thi xoá mail: ${err.message}`);
                    return false;
                }
            }

            case 'Cập nhật trạng thái': {
                const newStatus = config.status || 'die_mail';
                this._log(executionId, `   + Đang cập nhật trạng thái tài khoản thành: ${newStatus}`);
                await Account.findByIdAndUpdate(context.account._id, { status: newStatus });
                context.account.status = newStatus;
                this._log(executionId, `   + Đã cập nhật trạng thái thành công.`);
                return true;
            }

            case 'Đóng trình duyệt': {
                if (context.browser) {
                    await context.browser.close().catch(() => { });
                    context.browser = null;
                    context.page = null;
                }
                if (context.profileId) {
                    await mlx.stopProfile(context.profileId).catch(() => { });
                    this._log(executionId, `   + Đã dừng profile MLX.`);
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
                this._log(executionId, `   ⚠️ Khối "${label}" chưa được hỗ trợ logic thực thi. Bỏ qua.`, 'warning');
        }
    }

    _log(executionId, message, type = 'default', threadId = null) {
        const exec = this.activeExecutions.get(executionId);
        if (!exec) return;

        // Nếu không truyền threadId, dùng thread đang xử lý hiện tại
        const effectiveThreadId = threadId || exec.currentThreadId || null;

        const logEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            message,
            type,
            threadId: effectiveThreadId,
        };

        exec.logs.push(logEntry);

        // Route vào thread-specific logs
        if (effectiveThreadId && exec.threads[effectiveThreadId]) {
            exec.threads[effectiveThreadId].logs.push(logEntry);
            // Emit thread update để frontend cập nhật real-time
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

        // Support dynamic {{variable}} from context
        return value.replace(/{{(\w+)}}/g, (_, key) => {
            if (key === 'email') return context.account?.textnow_user || '';
            if (key === 'pass') return context.account?.textnow_pass || '';
            if (key === 'hotmail') return context.account?.hotmail_user || '';
            if (key === 'hotmail_pass') return context.account?.hotmail_pass || '';
            // Dynamic context variables (e.g. reset_link, otp, verify_link, etc.)
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
