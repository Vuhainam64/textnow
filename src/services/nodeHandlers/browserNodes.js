/**
 * browserNodes.js
 * Handlers cho cac khoi Browser/Profile + PerimeterX captcha solver
 */
import Account from '../../models/Account.js';
import mlx from '../mlxService.js';
import { connectBrowser, getPage } from '../browserService.js';

export async function handleTaoProfile(executionId, config, context, engine) {
    const profileName = `${context.account.textnow_user}_${Date.now()}`;
    context.profileId = await mlx.createProfile(profileName, context.proxy, config);
    engine._log(executionId, `   + Da tao MLX Profile: ${context.profileId}`);
    if (config.url) engine._log(executionId, `   + Landing Page: ${config.url}`);
    if (context.proxy) engine._log(executionId, `   + Da gan Proxy: ${context.proxy.host}:${context.proxy.port}`);
}

export async function handleMoTrinhDuyet(executionId, config, context, engine) {
    if (!context.profileId) {
        engine._log(executionId, `   Can "Tao profile" truoc khi Mo trinh duyet`, 'error');
        return false;
    }
    try {
        const { wsEndpoint } = await mlx.startProfile(context.profileId).catch(err => {
            if (err.message.includes('ECONNREFUSED')) {
                throw new Error('Khong the ket noi MLX Launcher. Hay dam bao Multilogin X dang chay.');
            }
            throw err;
        });
        const { browser, context: browserContext } = await connectBrowser(wsEndpoint);
        context.browser = browser;
        context.context = browserContext;
        context.page = await getPage(browserContext);
        context.wsEndpoint = wsEndpoint;   // Luu de dung lai

        // Lay port tu wsEndpoint (vd: ws://127.0.0.1:PORT/...)
        const portMatch = wsEndpoint.match(/(\d{4,5})/);
        const port = portMatch ? portMatch[1] : '?';
        engine._log(executionId, `   + Trinh duyet da san sang.`);
        engine._log(executionId, `   🔌 CDP Port: ${port}  |  ws: ${wsEndpoint.split('/')[2]}`, 'info');
        return true;
    } catch (err) {
        if (err.message.includes('MLX Launcher')) throw err;
        engine._log(executionId, `   Khong mo duoc trinh duyet: ${err.message}`, 'error');
        return false;
    }
}

export async function handleKetNoiBrowser(executionId, config, context, engine) {
    const wsEndpoint = engine._resolveValue(config.ws_endpoint || '', context);
    if (!wsEndpoint) {
        engine._log(executionId, `   - Ket noi browser: ws_endpoint bi trong`, 'error');
        return false;
    }
    try {
        const { browser, context: browserContext } = await connectBrowser(wsEndpoint);
        context.browser = browser;
        context.context = browserContext;
        context.page = await getPage(browserContext);
        context.wsEndpoint = wsEndpoint;
        engine._log(executionId, `   + Da ket noi toi browser: ${wsEndpoint.split('/')[2]}`);
        return true;
    } catch (err) {
        engine._log(executionId, `   - Khong ket noi duoc: ${err.message}`, 'error');
        return false;
    }
}

export async function handleMoTrangWeb(executionId, config, context, engine) {
    if (!context.page) {
        engine._log(executionId, `   Trinh duyet chua duoc mo`, 'error');
        return false;
    }
    try {
        const resolvedUrl = engine._resolveValue(config.url, context);
        if (!resolvedUrl) {
            engine._log(executionId, `   URL rong (bien chua duoc dien?)`, 'error');
            return false;
        }
        await context.page.goto(resolvedUrl, { waitUntil: 'domcontentloaded', timeout: (parseInt(config.timeout) || 30) * 1000 });
        engine._log(executionId, `   + Da truy cap: ${resolvedUrl}`);
        return true;
    } catch (err) {
        engine._log(executionId, `   Khong mo duoc trang: ${err.message}`, 'error');
        return false;
    }
}

export async function handleClickChuot(executionId, config, context, engine) {
    if (!context.page) {
        engine._log(executionId, `   Trinh duyet chua duoc mo`, 'error');
        return false;
    }
    try {
        const resolvedSelector = engine._resolveValue(config.selector, context);
        await context.page.waitForSelector(resolvedSelector, { timeout: (parseInt(config.timeout) || 30) * 1000 });
        await context.page.click(resolvedSelector);
        engine._log(executionId, `   + Da click: ${resolvedSelector}`);
        return true;
    } catch (err) {
        engine._log(executionId, `   Khong click duoc "${config.selector}": ${err.message}`, 'error');
        return false;
    }
}

export async function handleNhapVanBan(executionId, config, context, engine) {
    if (!context.page) {
        engine._log(executionId, `   Trinh duyet chua duoc mo`, 'error');
        return false;
    }
    try {
        const resolvedSelector = engine._resolveValue(config.selector, context);
        const resolvedValue = engine._resolveValue(config.value, context);
        await context.page.waitForSelector(resolvedSelector, { timeout: (parseInt(config.timeout) || 30) * 1000 });
        await context.page.fill(resolvedSelector, resolvedValue);
        const displayVal = resolvedValue.includes('@') ? '***' : resolvedValue;
        engine._log(executionId, `   + Da nhap vao ${resolvedSelector}: ${displayVal}`);
        return true;
    } catch (err) {
        engine._log(executionId, `   Khong nhap duoc vao "${config.selector}": ${err.message}`, 'error');
        return false;
    }
}

export async function handleDongTrinhDuyet(executionId, config, context, engine) {
    if (context.browser) {
        await context.browser.close().catch(() => { });
        context.browser = null;
        context.page = null;
    }
    if (context.profileId) {
        await mlx.stopProfile(context.profileId).catch(() => { });
        engine._log(executionId, `   + Da dung profile MLX.`);
    }
}

export async function handleXoaProfile(executionId, config, context, engine) {
    if (!context.profileId) throw new Error('Can profileId de xoa profile');
    await mlx.removeProfile(context.profileId);
    engine._log(executionId, `   + Da xoa profile vinh vien tren cloud.`);
}

export async function handleXoaProfileLocal(executionId, config, context, engine) {
    if (!context.profileId) throw new Error('Can profileId de xoa folder local');
    await mlx.deleteLocalProfile(context.profileId);
    engine._log(executionId, `   + Da xoa folder profile tai duong dan local.`);
}

export async function handleCapNhatTrangThai(executionId, config, context, engine) {
    const newStatus = config.status || 'die_mail';
    engine._log(executionId, `   + Dang cap nhat trang thai tai khoan thanh: ${newStatus}`);
    await Account.findByIdAndUpdate(context.account._id, { status: newStatus });
    context.account.status = newStatus;
    engine._log(executionId, `   + Da cap nhat trang thai thanh cong.`);
    return true;
}

// ─── PerimeterX Press-and-Hold Solver ─────────────────────────────────────────

/**
 * handlePerimeterX
 *
 * Flow:
 *  1. Setup listener cho auditor.js TRUOC khi click (khong miss event)
 *  2. Click selector (nut submit)
 *  3. Cho waitMs → check API
 *     → khong 403: TRUE thang (khong co captcha)
 *     → 403: captcha phat hien, tiep tuc
 *  4. Cho auditor.js load → widget san sang
 *  5. _solvePerimeterX: tim iframe display:block → press-and-hold button
 *  6. Verify lai API → return ket qua
 *
 * Config:
 *   selector  — CSS selector nut can click     (vd: button[type="submit"])
 *   api_url   — URL de check 403              (vd: https://...auth/{{email}})
 *   wait_ms   — ms cho sau click              (default: 1500)
 *   timeout   — timeout goi API (giay)        (default: 20)
 */
export async function handlePerimeterX(executionId, config, context, engine) {
    const page = context.page;
    if (!page) {
        engine._log(executionId, `   Trinh duyet chua mo`, 'error');
        return false;
    }

    const selector = engine._resolveValue(config.selector || 'button[type="submit"]', context);
    const apiUrl = engine._resolveValue(config.api_url || '', context);
    const waitMs = parseInt(config.wait_ms) || 1500;
    const timeoutMs = (parseInt(config.timeout) || 300) * 1000;
    const pollMs = parseInt(config.poll_ms) || 1000;
    const modalWaitS = parseInt(config.modal_wait) || 10;

    if (!apiUrl) {
        engine._log(executionId, `   - PerimeterX: api_url bi trong`, 'error');
        return false;
    }

    // 1. Setup request listener TRUOC khi click
    let auditorResolve;
    const auditorPromise = new Promise(r => { auditorResolve = r; });
    const onReq = req => {
        if (req.url().includes('crcldu.com/bd/auditor.js')) auditorResolve();
    };
    page.on('request', onReq);

    // 2. Click submit
    try {
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.click(selector);
        engine._log(executionId, `   + Da click: ${selector}`);
    } catch (err) {
        page.off('request', onReq);
        engine._log(executionId, `   - Khong click duoc "${selector}": ${err.message}`, 'error');
        return false;
    }

    // 3. Cho roi check API
    engine._log(executionId, `   + Cho ${waitMs}ms...`);
    await engine._wait(executionId, waitMs);

    let apiStatus;
    try {
        const res = await page.request.get(apiUrl, { timeout: timeoutMs });
        apiStatus = res.status();
    } catch (err) {
        page.off('request', onReq);
        engine._log(executionId, `   - Loi check API: ${err.message}`, 'error');
        return false;
    }

    if (apiStatus !== 403) {
        page.off('request', onReq);
        engine._log(executionId, `   + Khong bi chan (${apiStatus}) → TRUE`);
        return true;
    }
    engine._log(executionId, `   - PerimeterX (403). Cho captcha widget...`, 'warning');

    // 4. Cho auditor.js load (captcha san sang)
    try {
        await Promise.race([
            auditorPromise,
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
        ]);
        engine._log(executionId, `   + Widget san sang (auditor.js detected)`);
    } catch {
        page.off('request', onReq);
        engine._log(executionId, `   - Timeout cho captcha widget (20s)`, 'error');
        return false;
    } finally {
        page.off('request', onReq);
    }

    // 5. Giai captcha
    const solved = await _solvePerimeterX(page, engine, executionId, apiUrl, timeoutMs, pollMs, modalWaitS * 1000);
    if (!solved) {
        engine._log(executionId, `   - Khong giai duoc captcha → FALSE`, 'warning');
        return false;
    }
    engine._log(executionId, `   + Giai thanh cong → TRUE`);
    return true;
}

/**
 * _solvePerimeterX
 *
 * Detect thanh cong bang 2 tin hieu:
 *  1. API apiUrl tra ve 200 → pass → release va return true
 *  2. auditor.js moi fire trong khi dang giu → captcha refresh → tinh lai toa do va giu lai
 *
 * Tranh false positive cua `offsetParent` (modal la position:fixed nen luon null).
 */
async function _solvePerimeterX(page, engine, executionId, apiUrl, timeoutMs = 300000, pollMs = 1000, modalWaitMs = 10000) {
    const MAX_TOTAL_MS = timeoutMs;
    const MODAL_WAIT_MS = modalWaitMs;
    const API_POLL_MS = pollMs;
    const globalStart = Date.now();


    // Ham tinh toa do target tu DOM
    async function getTarget() {
        await page.waitForSelector('.px-modal-title-content', { timeout: MODAL_WAIT_MS });

        const headerSelectors = ['.px-modal-title-content p', '.px-modal-title-content'];
        const footerSelectors = ['.px-captcha-footer', '.px-help', '.px-modal a[href*="help"]'];

        let headerBox = null, footerBox = null;

        for (const sel of headerSelectors) {
            try {
                const loc = page.locator(sel).first();
                if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
                    headerBox = await loc.boundingBox();
                    if (headerBox) break;
                }
            } catch { /* next */ }
        }
        for (const sel of footerSelectors) {
            try {
                const loc = page.locator(sel).first();
                if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
                    footerBox = await loc.boundingBox();
                    if (footerBox) break;
                }
            } catch { /* next */ }
        }

        if (!headerBox || !footerBox) {
            // Fallback: 55% chieu cao modal
            const modalBox = await page.locator('.px-modal').first().boundingBox().catch(() => null);
            if (!modalBox) throw new Error('Khong tim thay modal element');
            headerBox = { x: modalBox.x, y: modalBox.y + modalBox.height * 0.35, width: modalBox.width, height: 0 };
            footerBox = { x: modalBox.x, y: modalBox.y + modalBox.height * 0.75 };
        }

        return {
            x: (headerBox.x + headerBox.width / 2) + (Math.random() * 10 - 5),
            y: ((headerBox.y + headerBox.height + footerBox.y) / 2) + (Math.random() * 8 - 4),
        };
    }

    try {
        engine._log(executionId, `   + Cho PerimeterX modal san sang...`);
        let target = await getTarget();

        // Signal flags
        let captchaRefreshed = false;
        let pageNavigated = false;   // Trang chuyen trang = captcha pass

        // Listener: auditor.js moi = captcha refresh
        const onReq = req => {
            if (req.url().includes('crcldu.com/bd/auditor.js')) captchaRefreshed = true;
        };
        page.on('request', onReq);

        // Listener: trang navigation = tam biet captcha page = PASS
        const onNav = frame => {
            if (frame === page.mainFrame()) {
                const url = page.url();
                if (!url.includes('enter-email') && !url.includes('perimeterx')) {
                    pageNavigated = true;
                }
            }
        };
        page.on('framenavigated', onNav);

        let attempt = 0;
        let solved = false;

        while (Date.now() - globalStart < MAX_TOTAL_MS && !solved) {
            attempt++;
            captchaRefreshed = false;
            pageNavigated = false;

            // Re-tinh toa do moi lan → jitter khac nhau moi attempt
            try {
                target = await getTarget();
            } catch (e) {
                engine._log(executionId, `   - Khong tim thay modal: ${e.message}`, 'error');
                break;
            }

            engine._log(executionId, `   + [${attempt}] Press-and-Hold tai (${Math.round(target.x)}, ${Math.round(target.y)})...`);
            await page.mouse.move(target.x, target.y, { steps: Math.floor(Math.random() * 10) + 15 });
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 300) + 200));
            await page.mouse.down();


            const holdStart = Date.now();

            while (Date.now() - globalStart < MAX_TOTAL_MS) {
                await new Promise(r => setTimeout(r, API_POLL_MS));

                // Signal 1: Trang navigation → PASS ngay lap tuc
                if (pageNavigated) {
                    engine._log(executionId, `   + Trang chuyen huong → PASS (${Date.now() - holdStart}ms)`);
                    solved = true;
                    break;
                }

                // Signal 2: API tra 200
                try {
                    const res = await page.request.get(apiUrl, { timeout: 5000 });
                    const status = res.status();
                    if (status !== 403) {
                        engine._log(executionId, `   + API tra ${status} sau ${Date.now() - holdStart}ms giu → PASS`);
                        solved = true;
                        break;
                    }
                } catch { /* tiep tuc giu */ }

                // Signal 3: Captcha refresh → giu lai
                if (captchaRefreshed) {
                    engine._log(executionId, `   ! Captcha refresh — tim lai toa do va giu lai...`, 'warning');
                    break;
                }

                engine._log(executionId, `   ~ Dang giu... (${Math.round((Date.now() - holdStart) / 1000)}s)`);
            }

            // Release mouse
            await page.mouse.up().catch(() => { });
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 400) + 300));

            if (solved) break;

            if (captchaRefreshed && Date.now() - globalStart < MAX_TOTAL_MS) {
                await new Promise(r => setTimeout(r, 1000));
                try {
                    target = await getTarget();
                } catch (e) {
                    engine._log(executionId, `   - Khong tim thay modal sau refresh: ${e.message}`, 'error');
                    break;
                }
            }
        }

        page.off('request', onReq);
        page.off('framenavigated', onNav);

        if (!solved) {
            engine._log(executionId, `   - Timeout (${Math.round((Date.now() - globalStart) / 1000)}s) khong giai duoc`, 'warning');
        }
        return solved;

    } catch (err) {
        await page.mouse.up().catch(() => { });
        engine._log(executionId, `   - Loi giai captcha: ${err.message}`, 'error');
        return false;
    }
}
