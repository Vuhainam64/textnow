/**
 * browserService.js - Kết nối Playwright vào browser MLX qua CDP
 * ---------------------------------------------------------------
 * Cung cấp các hàm tiện ích để:
 * 1. Kết nối vào trình duyệt MLX đang chạy thông qua CDP WebSocket
 * 2. Lấy/điều hướng page trong context
 *
 * Luồng sử dụng kết hợp với mlxService:
 *
 *   import mlx from './mlxService.js';
 *   import { connectBrowser, getPage, ensurePage } from './browserService.js';
 *
 *   const { wsEndpoint } = await mlx.startProfile(profileId);
 *   const { browser, context } = await connectBrowser(wsEndpoint);
 *   const page = await getPage(context);
 *   // ... tự động hoá ...
 *   await browser.close();
 *   await mlx.stopProfile(profileId);
 */

import { chromium } from 'playwright';
import axios from 'axios';

// ─── Connect ──────────────────────────────────────────────────────────────────

/**
 * Kết nối vào trình duyệt MLX đang chạy qua CDP.
 *
 * Chiến lược kết nối:
 * 1. Thử lấy wsDebuggerUrl thực từ endpoint /json/version (chính xác hơn)
 * 2. Nếu thất bại sau maxRetries lần, fallback kết nối thẳng bằng wsEndpoint gốc
 *
 * @param {string} wsEndpoint   - WebSocket endpoint từ mlx.startProfile() (vd: "ws://127.0.0.1:35000")
 * @param {number} maxRetries   - Số lần retry chờ browser sẵn sàng (mặc định: 10)
 * @param {number} retryDelayMs - Thời gian chờ giữa mỗi lần retry ms (mặc định: 3000)
 * @returns {Promise<{ browser: Browser, context: BrowserContext }>}
 */
export async function connectBrowser(wsEndpoint, maxRetries = 10, retryDelayMs = 3000) {
    // Tách port từ wsEndpoint để gọi /json/version
    const port = wsEndpoint.split(':')[2];
    const versionUrl = `http://127.0.0.1:${port}/json/version`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Lấy WebSocket URL thực từ browser DevTools Protocol
            const { data } = await axios.get(versionUrl, { timeout: 2000 });
            const realWsUrl = data?.webSocketDebuggerUrl;

            if (realWsUrl) {
                const browser = await chromium.connectOverCDP(realWsUrl);
                const context = browser.contexts()[0] || await browser.newContext();
                console.log(`[Browser] ✅ Kết nối CDP thành công (lần ${attempt})`);
                return { browser, context };
            }
        } catch {
            // Browser chưa sẵn sàng, thử lại
        }

        // Lần thử cuối: fallback kết nối trực tiếp bằng wsEndpoint gốc
        if (attempt === maxRetries) {
            try {
                console.warn('[Browser] ⚠️ Fallback: kết nối trực tiếp bằng wsEndpoint gốc');
                const browser = await chromium.connectOverCDP(wsEndpoint);
                const context = browser.contexts()[0] || await browser.newContext();
                return { browser, context };
            } catch (err) {
                throw new Error(`[Browser] ❌ Không thể kết nối vào browser tại ${wsEndpoint}: ${err.message}`);
            }
        }

        console.log(`[Browser] ⏳ Chờ browser sẵn sàng... (${attempt}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, retryDelayMs));
    }
}

// ─── Page Helpers ─────────────────────────────────────────────────────────────

/**
 * Lấy một page từ context.
 *
 * Logic ưu tiên:
 * 1. Tìm page có URL chứa urlInclude (nếu truyền vào)
 * 2. Lấy page có URL thực (không phải about:blank) và chưa đóng
 * 3. Lấy bất kỳ page đầu tiên
 * 4. Tạo page mới nếu không có page nào
 *
 * @param {BrowserContext} context
 * @param {string|null} urlInclude - Chuỗi để tìm page theo URL (tuỳ chọn)
 * @returns {Promise<Page>}
 */
export async function getPage(context, urlInclude = null) {
    const pages = context.pages();

    // Tìm theo URL nếu có yêu cầu
    if (urlInclude) {
        const matched = pages.find((p) => p.url().includes(urlInclude) && !p.isClosed());
        if (matched) return matched;
    }

    // Lấy page có nội dung thực
    const validPage = pages.find((p) => p.url() !== 'about:blank' && !p.isClosed());
    if (validPage) return validPage;

    // Lấy page đầu tiên bất kỳ hoặc tạo mới
    return pages[0] || context.newPage();
}

/**
 * Đảm bảo page đang ở đúng URL cần thiết.
 * Nếu page hiện tại không có URL đó → điều hướng tới navigateUrl.
 *
 * @param {BrowserContext} context
 * @param {string} urlInclude   - Chuỗi kiểm tra URL hiện tại
 * @param {string} navigateUrl  - URL đầy đủ để điều hướng nếu cần
 * @returns {Promise<Page>}
 */
export async function ensurePage(context, urlInclude, navigateUrl) {
    let page = await getPage(context, urlInclude);

    // Nếu page đã đóng, lấy/tạo page khác
    if (page.isClosed()) {
        page = await context.newPage();
    }

    if (!page.url().includes(urlInclude)) {
        try {
            await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        } catch (err) {
            console.warn(`[Browser] ⚠️ Không thể điều hướng đến ${navigateUrl}: ${err.message}`);
        }
    }

    return page;
}
