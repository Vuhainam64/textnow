import Imap from 'imap';
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

        try {
            const res = await axios.post(
                'https://login.live.com/oauth20_token.srf',
                data.toString(),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );

            this.accessToken = res.data.access_token;
            console.log('Access token retrieved successfully.');
        } catch (error) {
            console.error('Error getting access token:', error.response?.data || error.message);
            throw error;
        }
    }

    generateAuthString() {
        return Buffer.from(
            `user=${this.mail}\u0001auth=Bearer ${this.accessToken}\u0001\u0001`
        ).toString('base64');
    }

    async deleteAllMessages() {
        const imap = new Imap({
            user: this.mail,
            xoauth2: this.generateAuthString(),
            host: IMAP_HOST,
            port: IMAP_PORT,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });

        return new Promise((resolve, reject) => {
            imap.once('ready', async () => {
                // Liệt kê các thư mục thường có
                const folders = ['INBOX', 'Junk', 'Sent', 'Drafts', 'Trash'];

                for (const folder of folders) {
                    try {
                        await this.clearFolder(imap, folder);
                    } catch (err) {
                        console.error(`Lỗi khi xử lý thư mục ${folder}:`, err.message);
                    }
                }

                console.log('Hoàn tất quá trình xoá mail.');
                imap.end();
            });

            imap.once('error', err => {
                console.error('Lỗi IMAP:', err);
                reject(err);
            });

            imap.once('end', () => {
                console.log('Kết nối IMAP đã đóng.');
                resolve();
            });

            imap.connect();
        });
    }

    clearFolder(imap, boxName) {
        return new Promise((resolve, reject) => {
            // Mở thư mục với chế độ ghi (readonly = false)
            imap.openBox(boxName, false, (err, box) => {
                if (err) {
                    // Nếu thư mục không tồn tại, bỏ qua
                    return resolve();
                }

                console.log(`Đang xử lý thư mục: ${boxName}`);

                imap.search(['ALL'], (err, results) => {
                    if (err) return reject(err);

                    if (!results || results.length === 0) {
                        console.log(`Thư mục ${boxName} đã trống.`);
                        return resolve();
                    }

                    console.log(`Tìm thấy ${results.length} email trong ${boxName}. Đang tiến hành xoá...`);

                    // Thêm flag \Deleted cho tất cả mail tìm được
                    imap.addFlags(results, '\\Deleted', err => {
                        if (err) return reject(err);

                        // Thực hiện expunge để xoá vĩnh viễn các mail đã đánh dấu \Deleted
                        imap.expunge(err => {
                            if (err) return reject(err);
                            console.log(`Đã xoá sạch mail trong ${boxName}.`);
                            resolve();
                        });
                    });
                });
            });
        });
    }
}

/* ====== CHẠY ====== */

// Thay thế thông tin của bạn vào đây hoặc lấy từ biến môi trường
const hotmailStr = 'MarthaDiaz1014@outlook.com|vhatvd551517|M.C533_BAY.0.U.-CizWsL7WwoWruKY0dVTs34KcTz2*DOD*P0SrogfB42TrEA4GlCYnbXU2fyIVFSiJDv*GeTiZdk2tigwHlzzPurkkENItP*5mIsEVUndXFy0sUSkAgmbTPfm9dKNbuY8!mQczR60rbuNo8NpBraNTZbcPMQuQQimnD7wgjO*JzpZLa29pT8Ij7VlpR1j5MIzW2nUAN6Kwq4ZaXx6g7es8J4FyWXIYy!OKIvgpqak5pGOuZwHqkeXthcpKapyhEhyWDh8KGotzvvp4rXQrUpaKj6mREUpbxPExsoKcR9pgqweoCbhxA2qLjGxVS5afvnK6MfGpByPqoxrNtTybedVpoWdcUY!dFkCNWVXrVY5TEult3113oDfr4OW0rdgNty3WVrQ2TqTmUkxeHVE1sI!hIGU$|dbc8e03a-b00c-46bd-ae65-b683e7707cb0';
const [mail, password, refreshToken, clientId] = hotmailStr.split('|');

(async () => {
    try {
        const hotmail = new Hotmail(mail, password, clientId, refreshToken);
        await hotmail.getAccessToken();
        await hotmail.deleteAllMessages();
    } catch (error) {
        console.error('Lỗi thực thi:', error);
    }
})();
