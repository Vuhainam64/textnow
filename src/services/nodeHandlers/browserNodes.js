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
    context.log(`   + Da tao MLX Profile: ${context.profileId}`);
    if (config.url) context.log(`   + Landing Page: ${config.url}`);
    if (context.proxy) context.log(`   + Da gan Proxy: ${context.proxy.host}:${context.proxy.port}`);
}

export async function handleMoTrinhDuyet(executionId, config, context, engine) {
    if (!context.profileId) {
        context.log(`   Can "Tao profile" truoc khi Mo trinh duyet`, 'error');
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
        context.wsEndpoint = wsEndpoint;

        const portMatch = wsEndpoint.match(/(\d{4,5})/);
        const port = portMatch ? portMatch[1] : '?';
        context.log(`   + Trinh duyet da san sang.`);
        context.log(`   🔌 CDP Port: ${port}  |  Profile ID: ${context.profileId}  |  ws: ${wsEndpoint.split('/')[2]}`, 'info');
        return true;
    } catch (err) {
        if (err.message.includes('MLX Launcher')) throw err;
        context.log(`   Khong mo duoc trinh duyet: ${err.message}`, 'error');
        return false;
    }
}

export async function handleKetNoiBrowser(executionId, config, context, engine) {
    const wsEndpoint = engine._resolveValue(config.ws_endpoint || '', context);
    if (!wsEndpoint) {
        context.log(`   - Ket noi browser: ws_endpoint bi trong`, 'error');
        return false;
    }
    try {
        const { browser, context: browserContext } = await connectBrowser(wsEndpoint);
        context.browser = browser;
        context.context = browserContext;
        context.page = await getPage(browserContext);
        context.wsEndpoint = wsEndpoint;
        context.log(`   + Da ket noi toi browser: ${wsEndpoint.split('/')[2]}`);
        return true;
    } catch (err) {
        context.log(`   - Khong ket noi duoc: ${err.message}`, 'error');
        return false;
    }
}

export async function handleMoTrangWeb(executionId, config, context, engine) {
    if (!context.page) {
        context.log(`   Trinh duyet chua duoc mo`, 'error');
        return false;
    }
    try {
        const resolvedUrl = engine._resolveValue(config.url, context);
        if (!resolvedUrl) {
            context.log(`   URL rong (bien chua duoc dien?)`, 'error');
            return false;
        }
        await context.page.goto(resolvedUrl, { waitUntil: 'domcontentloaded', timeout: (parseInt(config.timeout) || 30) * 1000 });
        context.log(`   + Da truy cap: ${resolvedUrl}`);
        return true;
    } catch (err) {
        context.log(`   Khong mo duoc trang: ${err.message}`, 'error');
        return false;
    }
}

export async function handleClickChuot(executionId, config, context, engine) {
    if (!context.page) {
        context.log(`   Trinh duyet chua duoc mo`, 'error');
        return false;
    }
    try {
        const resolvedSelector = engine._resolveValue(config.selector, context);
        await context.page.waitForSelector(resolvedSelector, { timeout: (parseInt(config.timeout) || 30) * 1000 });
        await context.page.click(resolvedSelector);
        context.log(`   + Da click: ${resolvedSelector}`);
        return true;
    } catch (err) {
        context.log(`   Khong click duoc "${config.selector}": ${err.message}`, 'error');
        return false;
    }
}

export async function handleNhapVanBan(executionId, config, context, engine) {
    if (!context.page) {
        context.log(`   Trinh duyet chua duoc mo`, 'error');
        return false;
    }
    try {
        const resolvedSelector = engine._resolveValue(config.selector, context);
        const resolvedValue = engine._resolveValue(config.value, context);
        await context.page.waitForSelector(resolvedSelector, { timeout: (parseInt(config.timeout) || 30) * 1000 });
        await context.page.fill(resolvedSelector, resolvedValue);
        const displayVal = resolvedValue.includes('@') ? '***' : resolvedValue;
        context.log(`   + Da nhap vao ${resolvedSelector}: ${displayVal}`);
        return true;
    } catch (err) {
        context.log(`   Khong nhap duoc vao "${config.selector}": ${err.message}`, 'error');
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
        context.log(`   + Da dung profile MLX.`);
    }
}

export async function handleXoaProfile(executionId, config, context, engine) {
    if (!context.profileId) {
        context.log(`   ~ Khong co profileId, bo qua xoa profile.`, 'warning');
        return true;
    }
    await mlx.removeProfile(context.profileId);
    context.log(`   + Da xoa profile vinh vien tren cloud.`);
}

export async function handleXoaProfileLocal(executionId, config, context, engine) {
    if (!context.profileId) {
        context.log(`   ~ Khong co profileId, bo qua xoa folder local.`, 'warning');
        return true;
    }
    await mlx.deleteLocalProfile(context.profileId);
    context.log(`   + Da xoa folder profile tai duong dan local.`);
}

export async function handleCapNhatTrangThai(executionId, config, context, engine) {
    const newStatus = config.status || 'die_mail';
    context.log(`   + Dang cap nhat trang thai tai khoan thanh: ${newStatus}`);
    await Account.findByIdAndUpdate(context.account._id, { status: newStatus });
    context.account.status = newStatus;
    context.log(`   + Da cap nhat trang thai thanh cong.`, 'success');
    return true;
}

export async function handleCapNhatMatKhau(executionId, config, context, engine) {
    const newPass = engine._resolveValue(config.password || '', context);
    if (!newPass) {
        context.log(`   - Chua nhap mat khau moi`, 'error');
        return false;
    }
    context.log(`   + Dang cap nhat mat khau tai khoan...`);
    await Account.findByIdAndUpdate(context.account._id, { textnow_pass: newPass });
    context.account.textnow_pass = newPass;
    context.log(`   + Da cap nhat mat khau thanh cong.`);
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
 */
export async function handlePerimeterX(executionId, config, context, engine) {
    const page = context.page;
    if (!page) {
        context.log(`   Trinh duyet chua mo`, 'error');
        return false;
    }

    const selector = engine._resolveValue(config.selector || 'button[type="submit"]', context);
    const apiUrl = engine._resolveValue(config.api_url || '', context);
    const waitMs = parseInt(config.wait_ms) || 1500;
    const timeoutMs = (parseInt(config.timeout) || 300) * 1000;
    const pollMs = parseInt(config.poll_ms) || 1000;
    const modalWaitS = parseInt(config.modal_wait) || 10;
    const holdTimeoutMs = (parseInt(config.hold_timeout) || 60) * 1000;

    if (!apiUrl) {
        context.log(`   - PerimeterX: api_url bi trong`, 'error');
        return false;
    }

    // 1. Setup request listener TRUOC khi click
    let _auditorFiredEarly = false;
    const onReq = req => {
        if (req.url().includes('crcldu.com/bd/auditor.js')) _auditorFiredEarly = true;
    };
    page.on('request', onReq);

    // 2. Click submit
    try {
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.click(selector);
        context.log(`   + Da click: ${selector}`);
    } catch (err) {
        page.off('request', onReq);
        context.log(`   - Khong click duoc "${selector}": ${err.message}`, 'error');
        return false;
    }

    // 3. Cho roi check API
    context.log(`   + Cho ${waitMs}ms...`);
    await engine._wait(executionId, waitMs);

    let apiStatus;
    try {
        const res = await page.request.get(apiUrl, { timeout: timeoutMs });
        apiStatus = res.status();
    } catch (err) {
        page.off('request', onReq);
        context.log(`   - Loi check API: ${err.message}`, 'error');
        return false;
    }

    if (apiStatus === 200) {
        page.off('request', onReq);
        context.log(`   + Khong bi chan (${apiStatus}) → TRUE`);
        return true;
    }
    context.log(`   - PerimeterX (403). Cho captcha widget...`, 'warning');

    // 4. Cho auditor.js load HOAC API tra 200
    const widgetWaitMs = modalWaitS * 1000;
    const waitStart = Date.now();
    let apiPassedEarly = false;

    while (Date.now() - waitStart < widgetWaitMs) {
        if (engine.activeExecutions.get(executionId)?.status === 'stopping') {
            page.off('request', onReq);
            return false;
        }
        await new Promise(r => setTimeout(r, 1000));

        if (_auditorFiredEarly) {
            context.log(`   + Widget san sang (auditor.js detected)`);
            break;
        }

        try {
            const res = await page.request.get(apiUrl, { timeout: 5000 });
            if (res.status() === 200) {
                context.log(`   + API tra ${res.status()} trong luc cho → PASS (khong can giai)`, 'info');
                apiPassedEarly = true;
                break;
            }
        } catch { /* giu cho */ }
    }

    page.off('request', onReq);

    if (apiPassedEarly) return true;

    if (!_auditorFiredEarly) {
        context.log(`   - Timeout ${modalWaitS}s: captcha widget khong xuat hien`, 'error');
        return false;
    }

    // 5. Giai captcha
    const solved = await _solvePerimeterX(page, context, engine, executionId, apiUrl, timeoutMs, pollMs, modalWaitS * 1000, holdTimeoutMs);
    if (!solved) {
        context.log(`   - Khong giai duoc captcha → FALSE`, 'warning');
        return false;
    }
    context.log(`   + Giai thanh cong → TRUE`);
    return true;
}

/**
 * _solvePerimeterX - them context param de dung context.log()
 */
async function _solvePerimeterX(page, context, engine, executionId, apiUrl, timeoutMs = 300000, pollMs = 1000, modalWaitMs = 10000, holdTimeoutMs = 60000) {
    const MAX_TOTAL_MS = timeoutMs;
    const MODAL_WAIT_MS = modalWaitMs;
    const API_POLL_MS = pollMs;
    const MAX_HOLD_MS = holdTimeoutMs;
    const globalStart = Date.now();

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
        context.log(`   + Cho PerimeterX modal san sang...`);
        let target = await getTarget();

        let captchaRefreshed = false;
        let pageNavigated = false;

        const onReq = req => {
            if (req.url().includes('crcldu.com/bd/auditor.js')) captchaRefreshed = true;
        };
        page.on('request', onReq);

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

            try {
                target = await getTarget();
            } catch (e) {
                context.log(`   - Khong tim thay modal: ${e.message}`, 'error');
                break;
            }

            context.log(`   + [${attempt}] Press-and-Hold tai (${Math.round(target.x)}, ${Math.round(target.y)})...`);
            await page.mouse.move(target.x, target.y, { steps: Math.floor(Math.random() * 10) + 15 });
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 300) + 200));
            await page.mouse.down();

            const holdStart = Date.now();

            while (Date.now() - globalStart < MAX_TOTAL_MS) {
                await new Promise(r => setTimeout(r, API_POLL_MS));

                if (engine.activeExecutions.get(executionId)?.status === 'stopping') {
                    await page.mouse.up().catch(() => { });
                    throw new Error('USER_ABORTED');
                }

                if (pageNavigated) {
                    context.log(`   + Trang chuyen huong → PASS (${Date.now() - holdStart}ms)`);
                    solved = true;
                    break;
                }

                try {
                    const res = await page.request.get(apiUrl, { timeout: 5000 });
                    const status = res.status();
                    if (status === 200) {
                        context.log(`   + API tra ${status} sau ${Date.now() - holdStart}ms giu → PASS`);
                        solved = true;
                        break;
                    }
                } catch { /* tiep tuc giu */ }

                if (captchaRefreshed) {
                    context.log(`   ! Captcha refresh — tim lai toa do va giu lai...`, 'warning');
                    break;
                }

                const heldMs = Date.now() - holdStart;
                if (heldMs >= MAX_HOLD_MS) {
                    context.log(`   ~ Hold timeout (${Math.round(heldMs / 1000)}s) — tha va thu lai...`, 'warning');
                    break;
                }

                context.log(`   ~ Dang giu... (${Math.round(heldMs / 1000)}s/${Math.round(MAX_HOLD_MS / 1000)}s)`);
            }

            await page.mouse.up().catch(() => { });
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 400) + 300));

            if (solved) break;

            if (captchaRefreshed && Date.now() - globalStart < MAX_TOTAL_MS) {
                await new Promise(r => setTimeout(r, 1000));
                try {
                    target = await getTarget();
                } catch (e) {
                    context.log(`   - Khong tim thay modal sau refresh: ${e.message}`, 'error');
                    break;
                }
            }
        }

        page.off('request', onReq);
        page.off('framenavigated', onNav);

        if (!solved) {
            context.log(`   - Timeout (${Math.round((Date.now() - globalStart) / 1000)}s) khong giai duoc`, 'warning');
        }
        return solved;

    } catch (err) {
        await page.mouse.up().catch(() => { });
        context.log(`   - Loi giai captcha: ${err.message}`, 'error');
        return false;
    }
}
