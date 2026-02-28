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
    const timeoutMs = (parseInt(config.timeout) || 20) * 1000;

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
    const solved = await _solvePerimeterX(page, engine, executionId);
    if (!solved) return false;

    // 6. Verify lai
    await engine._wait(executionId, 2000);
    try {
        const res2 = await page.request.get(apiUrl, { timeout: timeoutMs });
        const status2 = res2.status();
        if (status2 !== 403) {
            engine._log(executionId, `   + Giai thanh cong (${status2}) → TRUE`);
            return true;
        }
        engine._log(executionId, `   - Captcha van con (${status2}) → FALSE`, 'warning');
        return false;
    } catch (err) {
        engine._log(executionId, `   - Loi verify sau captcha: ${err.message}`, 'error');
        return false;
    }
}

/**
 * _solvePerimeterX: Press-and-Hold tren iframe PerimeterX
 *
 * - waitForFunction: tim iframe #px-captcha iframe co display:block
 * - contentFrame() vao iframe → locator #hiLxEKFJvexNHKt
 * - Tinh toa do page (iframe offset + button offset + jitter nho)
 * - mouse.move → mouse.down → giu → detect class JlXLQdNpYTvVrKN hoac #checkmark.draw
 * - mouse.up → return success
 */
async function _solvePerimeterX(page, engine, executionId) {
    const MAX_HOLD_MS = 30000;
    const IFRAME_WAIT_MS = 10000;

    try {
        // A. Tim iframe display:block
        engine._log(executionId, `   + Tim iframe PerimeterX...`);

        const iframeEl = await page.waitForFunction(() => {
            const frames = document.querySelectorAll(
                '#px-captcha iframe[title="Human verification challenge"]'
            );
            return Array.from(frames).find(f => f.style.display === 'block') || null;
        }, {}, { timeout: IFRAME_WAIT_MS })
            .then(h => h.asElement())
            .catch(() => null);

        if (!iframeEl) {
            engine._log(executionId, `   - Khong tim thay iframe display:block`, 'error');
            return false;
        }

        // B. Vao frame → doi button hien thi
        const frame = await iframeEl.contentFrame();
        if (!frame) {
            engine._log(executionId, `   - Khong access duoc contentFrame`, 'error');
            return false;
        }

        const btn = frame.locator('#hiLxEKFJvexNHKt');
        await btn.waitFor({ state: 'visible', timeout: 5000 });
        const btnBox = await btn.boundingBox();
        const iframeBox = await iframeEl.boundingBox();

        if (!btnBox || !iframeBox) {
            engine._log(executionId, `   - Khong lay duoc bounding box`, 'error');
            return false;
        }

        // C. Tinh toa do tren page (iframe + button + jitter nho)
        const targetX = iframeBox.x + btnBox.x + btnBox.width / 2 + (Math.random() * 6 - 3);
        const targetY = iframeBox.y + btnBox.y + btnBox.height / 2 + (Math.random() * 4 - 2);
        engine._log(executionId, `   + Press-and-Hold tai (${Math.round(targetX)}, ${Math.round(targetY)})...`);

        // D. Di chuyen → press → giu
        await page.mouse.move(targetX, targetY, { steps: Math.floor(Math.random() * 10) + 15 });
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 300) + 200));
        await page.mouse.down();

        const holdStart = Date.now();
        let success = false;

        while (Date.now() - holdStart < MAX_HOLD_MS) {
            // Phat hien thanh cong:
            //   - Class JlXLQdNpYTvVrKN xuat hien (button chuyen mau tim)
            //   - Hoac #checkmark.draw (animation hoan tat)
            const verified = await frame.evaluate(() => {
                const b = document.getElementById('hiLxEKFJvexNHKt');
                const ck = document.getElementById('checkmark');
                return (b && b.classList.contains('JlXLQdNpYTvVrKN')) ||
                    (ck && ck.classList.contains('draw')) || false;
            }).catch(() => false);

            if (verified) {
                success = true;
                engine._log(executionId, `   + Xac nhan thanh cong (${Date.now() - holdStart}ms)`);
                break;
            }
            await new Promise(r => setTimeout(r, 100));
        }

        // Human-like delay truoc khi release
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 400) + 200));
        await page.mouse.up().catch(() => { });

        if (!success) engine._log(executionId, `   - Hold timeout (${MAX_HOLD_MS}ms)`, 'warning');
        return success;

    } catch (err) {
        await page.mouse.up().catch(() => { });
        engine._log(executionId, `   - Loi giai captcha: ${err.message}`, 'error');
        return false;
    }
}
