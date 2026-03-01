/**
 * emailNodes.js
 * Handlers cho các khối Email: Kiểm tra Email, Đọc Email, Xoá tất cả Mail
 * Tất cả đều dùng OAuth2 (Hotmail/Outlook) + IMAP
 */
import axios from 'axios';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

// ── Shared OAuth helper ─────────────────────────────────────────────────────
async function getOAuthToken(clientId, refreshToken) {
    const data = new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });
    const res = await axios.post(
        'https://login.live.com/oauth20_token.srf',
        data.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return res.data.access_token;
}

function buildAuthString(mail, accessToken) {
    return Buffer.from(`user=${mail}\x01auth=Bearer ${accessToken}\x01\x01`).toString('base64');
}

// ── Kiểm tra Email ──────────────────────────────────────────────────────────
export async function handleKiemTraEmail(executionId, config, context, engine) {
    const { hotmail_user: mail, hotmail_client_id: clientId, hotmail_token: refreshToken } = context.account;
    const maxRetries = parseInt(config.retries) || 1;

    context.log(`   + Dang kiem tra trang thai Hotmail: ${mail} (Thu toi da ${maxRetries} lan)...`);

    if (!mail || !refreshToken || !clientId) {
        context.log(`   - Thieu cau hinh Hotmail (Email/CID/Token)`, 'error');
        return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 1) {
                context.log(`   Dang thu lai lan ${attempt}/${maxRetries}...`);
                await engine._wait(executionId, 3000);
            }

            const accessToken = await getOAuthToken(clientId, refreshToken);
            const authString = buildAuthString(mail, accessToken);

            const isLive = await new Promise((resolve) => {
                const imap = new Imap({
                    user: mail,
                    xoauth2: authString,
                    host: 'outlook.office365.com',
                    port: 993,
                    tls: true,
                    tlsOptions: { rejectUnauthorized: false },
                    connTimeout: 10000,
                    authTimeout: 10000,
                });
                imap.once('ready', () => { imap.end(); resolve(true); });
                imap.once('error', (err) => {
                    context.log(`   - Loi lan ${attempt}: ${err.message}`);
                    resolve(false);
                });
                imap.connect();
            });

            if (isLive) {
                context.log(`   + Email dang hoat dong tot (IMAP Ready).`);
                return true;
            }
        } catch (err) {
            context.log(`   - Loi xac thuc hoac ket noi lan ${attempt}: ${err.response?.data?.error_description || err.message}`);
        }
    }

    context.log(`   Da thu ${maxRetries} lan nhung khong thanh cong.`);
    return false;
}

// ── Đọc Email ───────────────────────────────────────────────────────────────
async function fetchEmailFromIMAP({ mail, authString, fromFilter, subjectFilter }) {
    // Tim trong ca INBOX va Junk
    const FOLDERS = ['INBOX', 'Junk'];
    const searchCriteria = [['SINCE', new Date(Date.now() - 30 * 60 * 1000)]];
    if (fromFilter) searchCriteria.push(['FROM', fromFilter]);
    if (subjectFilter) searchCriteria.push(['SUBJECT', subjectFilter]);

    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: mail,
            xoauth2: authString,
            host: 'outlook.office365.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            connTimeout: 15000,
            authTimeout: 15000,
        });

        imap.once('ready', async () => {
            let found = null;

            for (const folder of FOLDERS) {
                if (found) break;
                await new Promise(resFolder => {
                    imap.openBox(folder, true, (err) => {
                        if (err) return resFolder(); // bo qua folder loi

                        imap.search(searchCriteria, (err, results) => {
                            if (err || !results || results.length === 0) return resFolder();

                            const latest = [results[results.length - 1]];
                            const fetch = imap.fetch(latest, { bodies: '' });
                            const parsePromises = [];

                            fetch.on('message', (msg) => {
                                // Moi message tao 1 promise rieng de dam bao wait du
                                const p = new Promise((resMsg) => {
                                    msg.on('body', (stream) => {
                                        simpleParser(stream)
                                            .then(email => { found = email; resMsg(); })
                                            .catch(() => resMsg());
                                    });
                                    msg.once('end', () => resMsg()); // fallback
                                });
                                parsePromises.push(p);
                            });

                            // Doi tat ca message parse xong ROI moi resolve
                            fetch.once('end', async () => {
                                await Promise.all(parsePromises);
                                resFolder();
                            });
                            fetch.once('error', () => resFolder());
                        });
                    });
                });
            }

            imap.end();
            resolve(found);
        });

        imap.once('error', (err) => reject(err));
        imap.connect();
    });
}

function extractFromEmail(email, extractType, extractPattern) {
    const html = email.html || email.textAsHtml || '';
    const text = email.text || '';
    const subject = email.subject || '';

    switch (extractType) {
        case 'link': {
            // Lay link dau tien trong email
            const allLinks = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)];
            return allLinks.length > 0 ? allLinks[0][1] : null;
        }
        case 'link_pattern': {
            // Lay link theo regex pattern — extractPattern phai co capture group $1 la URL
            if (!extractPattern) return null;
            const m = html.match(new RegExp(extractPattern, 'si'));
            return m ? (m[1] || m[0]) : null;
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
            if (!extractPattern) return null;
            const m = html.match(new RegExp(extractPattern, 'si')) || text.match(new RegExp(extractPattern, 'si'));
            return m ? (m[1] || m[0]) : null;
        }
        default:
            return null;
    }
}

export async function handleDocEmail(executionId, config, context, engine) {
    const { hotmail_user: mail, hotmail_client_id: clientId, hotmail_token: refreshToken } = context.account;
    const maxRetries = parseInt(config.retries) || 3;
    const waitSeconds = parseInt(config.wait_seconds) || 30;
    const waitBefore = parseInt(config.wait_before_first) || 0;  // cho truoc lan thu dau tien
    const fromFilter = config.from || '';
    const subjectFilter = config.subject_contains || '';
    const extractType = config.extract_type || 'link';
    const extractPattern = config.extract_pattern || '';
    const outputVar = config.output_variable || 'result';

    context.log(`   + Tim email [from: ${fromFilter || 'bat ky'}] [tieu de chua: "${subjectFilter || 'bat ky'}"] [INBOX + Junk]...`);

    if (!mail || !refreshToken || !clientId) {
        context.log(`   - Thieu cau hinh Hotmail (Email/CID/Token)`, 'error');
        return false;
    }

    // Cho truoc lan thu dau tien neu can
    if (waitBefore > 0) {
        context.log(`   + Cho ${waitBefore}s truoc khi kiem tra email...`);
        await engine._wait(executionId, waitBefore * 1000);
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 1) {
                context.log(`   Cho ${waitSeconds}s truoc lan thu ${attempt}/${maxRetries}...`);
                await engine._wait(executionId, waitSeconds * 1000);
            }

            const accessToken = await getOAuthToken(clientId, refreshToken);
            const authString = buildAuthString(mail, accessToken);
            const email = await fetchEmailFromIMAP({ mail, authString, fromFilter, subjectFilter });

            if (!email) {
                context.log(`   - Chua tim thay email phu hop trong INBOX va Junk. Thu lai...`);
                continue;
            }

            context.log(`   + Tim thay email: "${email.subject}"`);
            const value = extractFromEmail(email, extractType, extractPattern);

            if (value) {
                context[outputVar] = value;
                const preview = value.length > 80 ? value.substring(0, 80) + '...' : value;
                context.log(`   + Trich xuat thanh cong [${outputVar}]: ${preview}`);
                return true;
            } else {
                context.log(`   Email tim thay nhung khong trich xuat duoc du lieu.`, 'warning');
            }
        } catch (err) {
            context.log(`   - Loi lan ${attempt}: ${err.message}`);
        }
    }

    context.log(`   Da thu ${maxRetries} lan, khong lay duoc du lieu.`);
    return false;
}

// ── Xoá tất cả Mail ─────────────────────────────────────────────────────────
export async function handleXoaMail(executionId, config, context, engine) {
    const { hotmail_user: mail, hotmail_client_id: clientId, hotmail_token: refreshToken } = context.account;
    const targetFolders = (config.folders || 'INBOX,Junk').split(',').map(f => f.trim());

    context.log(`   + Dang tien hanh xoa mail cho: ${mail}...`);

    try {
        const accessToken = await getOAuthToken(clientId, refreshToken);
        const authString = buildAuthString(mail, accessToken);

        return new Promise((resolve) => {
            const imap = new Imap({
                user: mail,
                xoauth2: authString,
                host: 'outlook.office365.com',
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false },
            });

            imap.once('ready', async () => {
                for (const folder of targetFolders) {
                    try {
                        await new Promise((resFolder, rejFolder) => {
                            imap.openBox(folder, false, (err) => {
                                if (err) return resFolder();
                                imap.search(['ALL'], (err, results) => {
                                    if (err || !results || results.length === 0) return resFolder();
                                    context.log(`   + Tim thay ${results.length} mail trong ${folder}. Dang xoa...`);
                                    imap.addFlags(results, '\\Deleted', (err) => {
                                        if (err) return rejFolder(err);
                                        imap.expunge((err) => { if (err) return rejFolder(err); resFolder(); });
                                    });
                                });
                            });
                        });
                    } catch (err) {
                        context.log(`   Loi xoa mail trong ${folder}: ${err.message}`, 'warning');
                    }
                }
                context.log(`   + Da xoa sach mail trong cac thu muc: ${targetFolders.join(', ')}`);
                imap.end();
                resolve(true);
            });

            imap.once('error', (err) => {
                context.log(`   - Loi IMAP: ${err.message}`);
                resolve(false);
            });
            imap.connect();
        });
    } catch (err) {
        context.log(`   - Loi thuc thi xoa mail: ${err.message}`);
        return false;
    }
}
