import { chromium } from 'playwright-core';
import axios from 'axios';

/**
 * Service to manage browser connections and specialized page interactions
 */
export class BrowserService {
    constructor() {
        this.browser = null;
    }

    /**
     * Connect to a browser via CDP with retries
     * @param {string} wsEndpoint 
     * @param {number} retries 
     */
    async connect(wsEndpoint, retries = 10) {
        const port = wsEndpoint.split(':')[2];
        const versionUrl = `http://127.0.0.1:${port}/json/version`;

        for (let i = 0; i < retries; i++) {
            try {
                const res = await axios.get(versionUrl, { timeout: 1000 });
                const wsUrl = res.data.webSocketDebuggerUrl;
                if (wsUrl) {
                    this.browser = await chromium.connectOverCDP(wsUrl);
                    return this.browser;
                }
            } catch (e) { }

            if (i === retries - 1) {
                try {
                    this.browser = await chromium.connectOverCDP(wsEndpoint);
                    return this.browser;
                } catch (finalErr) {
                    throw new Error(`Failed to connect to browser on ${wsEndpoint}`);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    /**
     * Find a page by URL or get a valid default page
     * @param {BrowserContext} context 
     * @param {string} urlInclude 
     */
    async getPage(context, urlInclude = null) {
        const pages = context.pages();

        if (urlInclude) {
            for (const p of pages) {
                if (p.url().includes(urlInclude)) {
                    return p;
                }
            }
        }

        const validPage = pages.find(p => p.url() !== 'about:blank' && !p.isClosed());
        return validPage || pages[0] || await context.newPage();
    }

    /**
     * Ensure a page is on the correct URL, navigating if necessary
     */
    async ensurePage(context, urlInclude, navigateUrl) {
        const page = await this.getPage(context, urlInclude);

        if (page.isClosed()) {
            return await this.ensurePage(context, urlInclude, navigateUrl);
        }

        if (!page.url().includes(urlInclude)) {
            try {
                await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            } catch (e) { }
        }
        return page;
    }
}
