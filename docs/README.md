# TextNow Automation — Tài liệu Kỹ thuật

## Mục lục
1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Backend (Node.js + Express)](#2-backend)
3. [Frontend (React + Vite)](#3-frontend)
4. [Workflow Engine](#4-workflow-engine)
5. [Real-time với Socket.IO](#5-real-time-với-socketio)
6. [API Reference](#6-api-reference)
7. [Luồng dữ liệu đầy đủ](#7-luồng-dữ-liệu)

---

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND (React)               │
│   dashboard/src/                                │
│   ├── pages/        ← Trang chính               │
│   ├── components/   ← UI dùng lại              │
│   ├── hooks/        ← Custom React hooks        │
│   ├── services/     ← API calls (axios)         │
│   └── lib/          ← Tiện ích / hằng số UI    │
└──────────────────┬──────────────────────────────┘
                   │ HTTP (REST) + WebSocket (Socket.IO)
┌──────────────────▼──────────────────────────────┐
│                  BACKEND (Express)              │
│   src/                                          │
│   ├── routes/       ← API endpoints             │
│   ├── services/     ← Business logic            │
│   │   ├── workflowEngine.js   ← Điều phối      │
│   │   ├── nodeHandlers/       ← Xử lý từng     │
│   │   │   ├── logicNodes.js       block        │
│   │   │   ├── browserNodes.js                  │
│   │   │   └── emailNodes.js                    │
│   │   ├── mlxService.js       ← Multilogin API │
│   │   ├── browserService.js   ← Playwright      │
│   │   └── socketService.js   ← Socket.IO ref   │
│   └── models/      ← Mongoose schemas           │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │   MongoDB (Atlas)   │
        └─────────────────────┘
```

---

## 2. Backend

### Cấu trúc thư mục `src/`

| Thư mục/File | Vai trò |
|---|---|
| `index.js` | Entry point, khởi động Express + Socket.IO |
| `routes/` | REST API routers, mỗi file = 1 domain |
| `models/` | Mongoose schemas (Account, Proxy, Workflow, Execution) |
| `services/workflowEngine.js` | Điều phối thực thi workflow |
| `services/nodeHandlers/` | Logic từng loại block workflow |
| `services/mlxService.js` | Gọi API Multilogin X |
| `services/browserService.js` | Kết nối Playwright |
| `services/socketService.js` | Singleton Socket.IO instance |

### Môi trường (.env)
```env
MONGO_URI=mongodb+srv://...
PORT=3001
MLX_TOKEN=...
```

---

## 3. Frontend

### Cấu trúc `dashboard/src/`

```
pages/
├── Dashboard.jsx         ← Tổng quan thống kê
├── Accounts.jsx          ← Quản lý tài khoản
├── Proxies.jsx           ← Quản lý proxy
├── Tasks.jsx             ← Chạy & tạo kịch bản
├── History.jsx           ← Lịch sử chạy (2 chế độ: Log / Luồng)
├── MLXControl.jsx        ← Quản lý profile MLX
└── Workflow/
    ├── constants.js              ← NODE_TEMPLATES định nghĩa block
    └── components/
        ├── WorkflowEditor.jsx    ← React Flow editor chính
        ├── TaskNode.jsx          ← Hiển thị 1 node trên canvas
        └── SourceNode.jsx        ← Node START (điểm vào)

components/
├── Layout.jsx            ← Sidebar + Navigation
├── Toast.jsx             ← Thông báo (singleton)
├── Modal.jsx             ← Modal wrapper
├── Select.jsx            ← Custom select dropdown
└── SettingsModal.jsx     ← Cấu hình .env

hooks/
└── useExecutionSocket.js ← Hook lắng nghe real-time từ server

services/
└── apiService.js         ← Tất cả axios calls → backend
```

### Routing
```
/dashboard     → Dashboard
/accounts      → Accounts
/proxies       → Proxies
/tasks         → Tasks (Workflow Editor + Chạy kịch bản)
/history       → History
/mlx           → MLXControl
```

---

## 4. Workflow Engine

> File: `src/services/workflowEngine.js` (~380 dòng)

### Kiến trúc

```
WorkflowEngine (singleton)
│
├── execute(workflow, options)
│       └── _run(executionId, workflow, options)
│               ├── Lấy accounts từ DB
│               ├── Chạy parallel thread pool
│               └── processAccount(account, i)
│                       ├── Init context
│                       ├── Traverse graph (while loop)
│                       └── _executeNode(node, context)
│                               └── _runNodeLogic → dispatcher
│
├── _runNodeLogic (dispatcher)
│       ├── Logic:   handleKhaiBaoBien, handleLapLai, ...
│       ├── Browser: handleTaoProfile, handleMoTrinhDuyet, ...
│       └── Email:   handleKiemTraEmail, handleDocEmail, ...
│
└── Helpers: _log, _resolveValue, _wait
```

### Parallel Thread Pool

```js
// Chia accounts thành chunks kích thước = threads
// Mỗi chunk chạy song song, có startup_delay giữa mỗi luồng
const chunks = [];
for (let i = 0; i < accounts.length; i += threads) {
    chunks.push(accounts.slice(i, i + threads));
}
for (const chunk of chunks) {
    await Promise.allSettled(chunk.map(...))
}
```

### Graph Traversal
- Workflow là **DAG (Directed Acyclic Graph)** lưu dạng `{ nodes, edges }`
- Engine bắt đầu từ `sourceNode` (type = `'sourceNode'`)
- Với mỗi node: thực thi → nhận kết quả `true/false` → chọn edge tương ứng
- **Branch nodes** có 2 handle: `'true'` và `'false'`
- **Single-output nodes** có 1 handle: `'default'`

### Context Object
```js
{
  account,    // Mongoose document
  threadId,   // textnow_user
  proxy,      // Proxy document hoặc null
  profileId,  // MLX profile UUID
  browser,    // Playwright Browser
  context,    // Playwright BrowserContext
  page,       // Playwright Page
  // + biến động từ "Khai báo biến" hoặc "Đọc Email"
}
```

### Thêm Node Mới
1. Thêm template vào `dashboard/src/pages/Workflow/constants.js`
2. Thêm handler vào `src/services/nodeHandlers/` (file phù hợp)
3. Export handler, import trong `workflowEngine.js`
4. Thêm `case 'Tên block':` vào dispatcher `_runNodeLogic`
5. Nếu block single-output: thêm label vào `SINGLE_OUTPUT_LABELS` trong `WorkflowEditor.jsx`

---

## 5. Real-time với Socket.IO

### Luồng sự kiện

```
Backend (socketService)           Frontend
─────────────────────────         ─────────────────────────
                                  socket.emit('join-execution', id)
socket.on('join-execution')       →
socket.join(room)                 ←

socket.emit('workflow-log', log)  →  socket.on('workflow-log')
socket.emit('workflow-thread-update', data) → socket.on('workflow-thread-update')
socket.emit('workflow-status', { status })  → socket.on('workflow-status')
```

### Log Entry Structure
```js
{
  id: string,           // UUID unique
  timestamp: ISO string,
  message: string,
  type: 'default' | 'success' | 'error' | 'warning',
  threadId: string | null  // null = log chung, string = log của thread cụ thể
}
```

### Thread Entry Structure
```js
{
  user: string,          // textnow_user
  index: number,         // Vị trí trong danh sách
  total: number,
  status: 'running' | 'success' | 'error',
  started_at: Date,
  ended_at: Date | null,
  logs: LogEntry[],
  error?: string
}
```

### Hook `useExecutionSocket`
```js
const { logs, threads, status } = useExecutionSocket(executionId);
```
- Tự động join/leave room khi executionId thay đổi
- Realtime update `logs` và `threads`

---

## 6. API Reference

### Workflows
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/workflows` | Lấy danh sách |
| POST | `/api/workflows` | Tạo mới |
| PUT | `/api/workflows/:id` | Cập nhật nodes/edges |
| DELETE | `/api/workflows/:id` | Xoá |
| POST | `/api/workflows/:id/run` | Chạy workflow |
| POST | `/api/workflows/stop/:execId` | Dừng execution |
| GET | `/api/workflows/executions` | Lịch sử chạy |
| GET | `/api/workflows/executions/:id` | Chi tiết 1 execution |

### Accounts
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/accounts` | Lấy danh sách (+ filter) |
| POST | `/api/accounts/import` | Import CSV/JSON |
| PUT | `/api/accounts/:id` | Cập nhật |
| DELETE | `/api/accounts/:id` | Xoá |
| GET | `/api/accounts/groups` | Danh sách nhóm |
| POST | `/api/accounts/groups` | Tạo nhóm |

### Proxies
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/proxies` | Lấy danh sách |
| POST | `/api/proxies/import` | Import |
| DELETE | `/api/proxies/:id` | Xoá |
| GET | `/api/proxies/groups` | Danh sách nhóm |

---

## 7. Luồng dữ liệu

### Khi người dùng nhấn "Chạy kịch bản"

```
1. Frontend: Tasks.jsx → POST /api/workflows/:id/run
   { account_group_id, proxy_group_id, threads, startup_delay, ... }

2. Backend: workflowRoutes.js → workflowEngine.execute(workflow, options)
   → trả về executionId ngay lập tức (async)

3. Frontend nhận executionId → socket.emit('join-execution', executionId)

4. Backend: workflowEngine._run() chạy trong background
   → với mỗi log: socketService.emit('workflow-log', entry)
   → với mỗi thread update: socketService.emit('workflow-thread-update', data)
   → khi xong: socketService.emit('workflow-status', { status })

5. Frontend cập nhật UI realtime qua useExecutionSocket hook
```

### Khi người dùng lưu Workflow

```
1. WorkflowEditor: handleSave()
   → normalizeEdges(edges, nodes)   ← đảm bảo sourceHandle đúng
   → PUT /api/workflows/:id { nodes, edges }

2. Backend lưu vào MongoDB

3. Khi mở lại: GET /api/workflows/:id
   → normalizeEdges() được gọi lại để fix bất kỳ sai lệch nào
```
