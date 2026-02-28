/**
 * browserNodes.js
 * Handlers cho các khối Browser/Profile: Tạo profile, Mở trình duyệt,
 * Mở trang web, Click chuột, Nhập văn bản, Đóng trình duyệt,
 * Xoá profile, Xoá profile local, Cập nhật trạng thái
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
        engine._log(executionId, `   + Trinh duyet da san sang.`);
        return true;
    } catch (err) {
        if (err.message.includes('MLX Launcher')) throw err;
        engine._log(executionId, `   Khong mo duoc trinh duyet: ${err.message}`, 'error');
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

/**
 * PerimeterX — Click submit và kiểm tra challenge qua API
 *
 * Luồng:
 *   1. Click vào `selector` (nút submit)
 *   2. Chờ `wait_ms` để request xử lý (mặc định 1500ms)
 *   3. Gọi `api_url` qua page.request (cùng session/cookie browser)
 *      → 403  = PerimeterX chặn (return FALSE)
 *      → khác = không bị chặn   (return TRUE)
 *
 * Config:
 *   selector  — CSS selector nút cần click     (vd: button[type="submit"])
 *   api_url   — URL để check challenge         (vd: https://...auth/{{email}})
 *   wait_ms   — ms chờ sau click               (default: 1500)
 *   timeout   — timeout gọi API (giây)         (default: 20)
 */
export async function handlePerimeterX(executionId, config, context, engine) {
    if (!context.page) {
        engine._log(executionId, `   Trình duyệt chưa mở`, 'error');
        return false;
    }

    const selector = engine._resolveValue(config.selector || 'button[type="submit"]', context);
    const apiUrl = engine._resolveValue(config.api_url || '', context);
    const waitMs = parseInt(config.wait_ms) || 1500;
    const timeoutMs = (parseInt(config.timeout) || 20) * 1000;

    if (!apiUrl) {
        engine._log(executionId, `   - PerimeterX: api_url bị trống`, 'error');
        return false;
    }

    // 1. Click submit
    try {
        await context.page.waitForSelector(selector, { timeout: 10000 });
        await context.page.click(selector);
        engine._log(executionId, `   + Đã click: ${selector}`);
    } catch (err) {
        engine._log(executionId, `   - Không click được "${selector}": ${err.message}`, 'error');
        return false;
    }

    // 2. Chờ request xử lý
    engine._log(executionId, `   + Chờ ${waitMs}ms...`);
    await engine._wait(executionId, waitMs);

    // 3. Check PerimeterX qua page.request (có session/cookie)
    try {
        const res = await context.page.request.get(apiUrl, { timeout: timeoutMs });
        const status = res.status();
        if (status === 403) {
            engine._log(executionId, `   - PerimeterX phát hiện (403) → nhánh FALSE`, 'warning');
            return false;
        }
        engine._log(executionId, `   + Không bị chặn (${status}) → nhánh TRUE`);
        return true;
    } catch (err) {
        engine._log(executionId, `   - Lỗi kiểm tra PerimeterX: ${err.message}`, 'error');
        return false;
    }
}
