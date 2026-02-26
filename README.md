# TextNow Account Manager

Hệ thống quản lý tài khoản TextNow tự động hoá, sử dụng **Multilogin** để antidetect, **Playwright** để điều khiển trình duyệt, và **MongoDB** để lưu trữ dữ liệu.

---

## Cấu trúc dự án

```
textnow/
├── src/                        # Backend Node.js
│   ├── config/
│   │   └── database.js         # Kết nối MongoDB, tự retry khi mất kết nối
│   ├── models/
│   │   ├── Account.js          # Schema tài khoản TextNow + Hotmail
│   │   └── Proxy.js            # Schema proxy (http/socks)
│   ├── routes/
│   │   ├── accountRoutes.js    # REST API CRUD tài khoản
│   │   └── proxyRoutes.js      # REST API CRUD proxy
│   ├── services/
│   │   ├── mlxService.js       # Tích hợp MLX API (singleton, auto-auth)
│   │   └── browserService.js   # Kết nối Playwright qua CDP
│   ├── utils/
│   │   └── taskQueue.js        # Hàng đợi tác vụ đa luồng
│   └── server.js               # Entry point Express server
│
├── dashboard/                  # Frontend Vite + React + TailwindCSS
│   └── src/
│       ├── components/
│       │   └── Layout.jsx      # Layout chính: sidebar + header + content
│       ├── lib/
│       │   └── api.js          # Axios instance cấu hình sẵn
│       ├── pages/
│       │   ├── Dashboard.jsx   # Trang tổng quan thống kê
│       │   ├── Accounts.jsx    # Quản lý tài khoản
│       │   └── Proxies.jsx     # Quản lý proxy
│       └── App.jsx             # Routes
│
├── .env                        # Biến môi trường (không commit)
├── .env.example                # Template biến môi trường
└── package.json                # Backend dependencies + scripts
```

---

## Biến môi trường (`src/services/`)

Các biến môi trường được nhóm theo section trong `.env`:

| Section | Biến | Mô tả |
|---------|------|-------|
| Server | `PORT` | Cổng Express (mặc định: 3000) |
| Server | `MONGODB_URI` | URI kết nối MongoDB |
| MLX | `MLX_USER` | Email đăng nhập MLX |
| MLX | `MLX_PASSWORD` | Mật khẩu MLX (tự hash MD5 khi gửi) |
| MLX | `MLX_HOST` | Base URL MLX API |
| MLX | `MLX_LAUNCHER_V1` | Launcher V1 (stop/status) |
| MLX | `MLX_LAUNCHER_V2` | Launcher V2 (start Playwright) |
| MLX | `MLX_GROUP_ID` | ID folder/group chứa profiles |
| MLX | `MLX_TEAM_ID` | ID team |

---

## Yêu cầu hệ thống

- **Node.js** >= 18 (hỗ trợ ESM native và `--watch`)
- **MongoDB** >= 6
- **Multilogin** (cần cài đặt và chạy ở localhost:35000)

---

## Cài đặt & Chạy

### 1. Cài backend dependencies

```bash
npm install
```

### 2. Cấu hình biến môi trường

```bash
cp .env.example .env
# Chỉnh sửa .env với MONGODB_URI và MULTILOGIN_TOKEN của bạn
```

### 3. Chạy backend

```bash
npm run dev        # Chạy với --watch (tự reload khi sửa code)
# hoặc
npm start          # Production
```

### 4. Chạy dashboard

```bash
cd dashboard
npm run dev
# Truy cập http://localhost:5173
```

---

## Database Schema

### Collection `accounts`

| Trường            | Kiểu     | Mô tả                              |
|-------------------|----------|------------------------------------|
| `textnow_user`    | String   | **Bắt buộc**, unique               |
| `textnow_pass`    | String   | **Bắt buộc**                       |
| `hotmail_user`    | String   | Email Hotmail liên kết             |
| `hotmail_pass`    | String   | Mật khẩu Hotmail                   |
| `hotmail_token`   | String   | Microsoft OAuth token              |
| `hotmail_client_id` | String | Azure AD Client ID               |
| `status`          | Enum     | `active` / `inactive` / `banned` / `pending` |
| `created_at`      | Date     | Tự động                            |
| `updated_at`      | Date     | Tự động                            |

### Collection `proxies`

| Trường     | Kiểu   | Mô tả                                   |
|------------|--------|-----------------------------------------|
| `type`     | Enum   | `http` / `https` / `socks4` / `socks5` |
| `host`     | String | **Bắt buộc**                            |
| `port`     | Number | **Bắt buộc**, 1–65535                   |
| `username` | String | Tuỳ chọn                                |
| `password` | String | Tuỳ chọn                                |
| `status`   | Enum   | `active` / `inactive` / `dead`          |
| `created_at` | Date | Tự động                                 |
| `updated_at` | Date | Tự động                                 |

---

## API Endpoints

### Tài khoản

| Method | URL                      | Mô tả                          |
|--------|--------------------------|--------------------------------|
| GET    | `/api/accounts`          | Lấy danh sách (phân trang)     |
| GET    | `/api/accounts/stats`    | Thống kê theo trạng thái       |
| GET    | `/api/accounts/:id`      | Chi tiết 1 tài khoản           |
| POST   | `/api/accounts`          | Tạo mới                        |
| POST   | `/api/accounts/import`   | Nhập hàng loạt                 |
| PUT    | `/api/accounts/:id`      | Cập nhật                       |
| DELETE | `/api/accounts/:id`      | Xoá                            |

### Proxy

| Method | URL                    | Mô tả                      |
|--------|------------------------|----------------------------|
| GET    | `/api/proxies`         | Lấy danh sách              |
| GET    | `/api/proxies/stats`   | Thống kê                   |
| POST   | `/api/proxies`         | Tạo mới                    |
| POST   | `/api/proxies/import`  | Nhập hàng loạt (text/JSON) |
| PUT    | `/api/proxies/:id`     | Cập nhật                   |
| DELETE | `/api/proxies/:id`     | Xoá                        |

---

## Đa luồng (TaskQueue)

`src/utils/taskQueue.js` cung cấp cơ chế chạy nhiều tác vụ đồng thời:

```js
import { TaskQueue } from './src/utils/taskQueue.js'

const queue = new TaskQueue(5) // 5 luồng đồng thời

// Thêm 20 tác vụ - chỉ 5 cái chạy cùng lúc
for (const account of accounts) {
  queue.addTask(async () => {
    const { page, browser, profileId } = await startProfile(account.profileId)
    // ... tự động hoá với Playwright ...
    await stopProfile(profileId)
    await browser.close()
  })
}
```

---

## Tích hợp MLX

**`src/services/mlxService.js`** (singleton, tự động đăng nhập):
- `signin()` — đăng nhập, retry với exponential backoff, bảo vệ concurrent calls
- `startProfile(id)` — khởi động profile, trả về `{ port, wsEndpoint }`
- `stopProfile(id)` — dừng profile (retry 3 lần)
- `createProfile(name, proxy?)` — tạo profile mới với fingerprint đầy đủ
- `removeProfile(ids)` — xoá 1 hoặc nhiều profile
- `searchProfiles(groupId)` — tìm kiếm profiles trong group
- `getLockedProfileIds()` — lấy IDs profile đang bị khoá
- `getProfileStatuses()` — trạng thái profile đang chạy
- `cleanupGroup(groupId)` — xoá toàn bộ group (batch song song)

**`src/services/browserService.js`** (pure functions):
- `connectBrowser(wsEndpoint)` — kết nối CDP với retry, fallback
- `getPage(context, urlInclude?)` — lấy page phù hợp từ context
- `ensurePage(context, urlInclude, navigateUrl)` — đảm bảo page ở đúng URL

---

## Nhập proxy hàng loạt

Hỗ trợ định dạng text thuần, mỗi dòng:
```
host:port:username:password
# Ví dụ:
192.168.1.1:8080:user:pass
10.0.0.1:3128
```
