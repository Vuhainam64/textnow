import Imap from 'imap';
import { simpleParser } from 'mailparser';
import axios from 'axios';

const IMAP_HOST = 'outlook.office365.com';
const IMAP_PORT = 993;

class Hotmail {
    constructor(mail, password, clientId, refreshToken) {
        this.mail = mail;
        this.password = password;
        this.clientId = clientId;
        this.refreshToken = refreshToken;
        this.accessToken = null;
    }

    async getAccessToken() {
        const data = new URLSearchParams({
            client_id: this.clientId,
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken
        });

        const res = await axios.post(
            'https://login.live.com/oauth20_token.srf',
            data.toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        this.accessToken = res.data.access_token;
        console.log('Access token:', this.accessToken);
    }

    generateAuthString() {
        return Buffer.from(
            `user=${this.mail}\u0001auth=Bearer ${this.accessToken}\u0001\u0001`
        ).toString('base64');
    }

    async getMessages() {
        const imap = new Imap({
            user: this.mail,
            xoauth2: this.generateAuthString(),
            host: IMAP_HOST,
            port: IMAP_PORT,
            tls: true
        });

        imap.once('ready', async () => {
            const folders = ['INBOX', 'Junk'];

            for (const folder of folders) {
                await this.openBox(imap, folder);
                await this.fetchEmails(imap);
            }

            imap.end();
        });

        imap.once('error', err => {
            console.error('IMAP error:', err);
        });

        imap.connect();
    }

    openBox(imap, box) {
        return new Promise((resolve, reject) => {
            imap.openBox(box, true, err => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    fetchEmails(imap) {
        return new Promise((resolve, reject) => {
            imap.search(['ALL'], (err, results) => {
                if (err || !results.length) return resolve();

                const fetch = imap.fetch(results, { bodies: '' });

                fetch.on('message', msg => {
                    msg.on('body', async stream => {
                        const parsed = await simpleParser(stream);

                        console.log('Tiêu đề:', parsed.subject);
                        console.log('Người gửi:', parsed.from?.text);
                        console.log('Ngày gửi:', parsed.date);
                        console.log('Nội dung text:', parsed.text || '');
                        console.log('Nội dung html:', parsed.html || '');
                        console.log('='.repeat(100));
                    });
                });

                fetch.once('end', resolve);
            });
        });
    }
}

/* ====== CHẠY ====== */

const hotmailStr = 'MarthaDiaz1014@outlook.com|vhatvd551517|M.C533_BAY.0.U.-CizWsL7WwoWruKY0dVTs34KcTz2*DOD*P0SrogfB42TrEA4GlCYnbXU2fyIVFSiJDv*GeTiZdk2tigwHlzzPurkkENItP*5mIsEVUndXFy0sUSkAgmbTPfm9dKNbuY8!mQczR60rbuNo8NpBraNTZbcPMQuQQimnD7wgjO*JzpZLa29pT8Ij7VlpR1j5MIzW2nUAN6Kwq4ZaXx6g7es8J4FyWXIYy!OKIvgpqak5pGOuZwHqkeXthcpKapyhEhyWDh8KGotzvvp4rXQrUpaKj6mREUpbxPExsoKcR9pgqweoCbhxA2qLjGxVS5afvnK6MfGpByPqoxrNtTybedVpoWdcUY!dFkCNWVXrVY5TEult3113oDfr4OW0rdgNty3WVrQ2TqTmUkxeHVE1sI!hIGU$|dbc8e03a-b00c-46bd-ae65-b683e7707cb0';
const [mail, password, refreshToken, clientId] = hotmailStr.split('|');

(async () => {
    const hotmail = new Hotmail(mail, password, clientId, refreshToken);
    await hotmail.getAccessToken();
    await hotmail.getMessages();
})();
