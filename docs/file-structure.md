# Cấu trúc Files & Quy tắc Phân chia

## Nguyên tắc tổng quát

> **1 file < 400 dòng**. Nếu file vượt 400 dòng, xem xét tách thành module nhỏ hơn.

---

## Backend (`src/`)

### `services/workflowEngine.js` (~380 dòng)
**Chỉ chứa:**
- Quản lý `activeExecutions` (Map)
- `execute()` → khởi chạy async
- `_run()` → parallel thread pool + graph traversal
- `_executeNode()` → timeout wrapper
- `_runNodeLogic()` → **dispatcher thuần túy** (chỉ import + switch-case)
- `_log()`, `_resolveValue()`, `_wait()` → helpers

**Không chứa:**
- Logic cụ thể của bất kỳ block nào → nằm trong `nodeHandlers/`

---

### `services/nodeHandlers/`

| File | Chứa |
|---|---|
| `logicNodes.js` | Khai báo biến, Lặp lại, Điều kiện, Chờ đợi |
| `browserNodes.js` | Tạo profile, Mở trình duyệt, Click, Nhập text, Đóng, Xoá profile, Cập nhật trạng thái |
| `emailNodes.js` | Kiểm tra Email, Đọc Email, Xoá Mail — + OAuth helper nội bộ |

**Quy tắc viết handler:**
```js
// Signature chuẩn
export async function handleTenBlock(executionId, config, context, engine) {
    // engine._log(), engine._wait(), engine._resolveValue() — từ WorkflowEngine instance
    // config — node.data.config (do người dùng điền)
    // context — shared state của thread hiện tại
    return true; // hoặc false
}
```

---

### `routes/`

Mỗi file route chỉ map URL → gọi service. **Không** chứa business logic.

```
accountRoutes.js   → AccountService (trong service hoặc inline)
proxyRoutes.js     → ProxyService
workflowRoutes.js  → workflowEngine.execute() / workflowEngine.stop()
mlxRoutes.js       → mlxService
groupRoutes.js     → Group model
```

---

## Frontend (`dashboard/src/`)

### `pages/`
Mỗi page là 1 màn hình → map với 1 route trong `App.jsx`.

File page nên < 400 dòng. Nếu dài hơn, tách ra:
- Sub-components vào `pages/ComponentName/`
- Custom hook vào `hooks/use[Name].js`

### `components/`
UI **tái sử dụng** được, không phụ thuộc vào business logic cụ thể.

| File | Mô tả |
|---|---|
| `Toast.jsx` | Singleton notification system |
| `Modal.jsx` | Dialog wrapper |
| `Select.jsx` | Custom dropdown |
| `Layout.jsx` | Nav + Sidebar wrapper |
| `SettingsModal.jsx` | .env editor |

### `hooks/`
Custom React hooks, mỗi hook xử lý 1 concern:

| File | Mô tả |
|---|---|
| `useExecutionSocket.js` | Socket.IO listener → trả về `{ logs, threads, status }` |

### `services/`
Tất cả HTTP calls tập trung tại `apiService.js`.
**Không** gọi `axios` trực tiếp trong components.

```js
// Đúng
import { WorkflowsService } from '../services/apiService'
const data = await WorkflowsService.getAll()

// Sai
import axios from 'axios'
const data = await axios.get('/api/workflows')
```

---

## Workflow Editor

### `pages/Workflow/`

```
constants.js              ← NODE_TEMPLATES (danh sách tất cả blocks)
components/
├── WorkflowEditor.jsx    ← Canvas + state chính (~400 dòng)
├── TaskNode.jsx          ← Hiển thị 1 node
└── SourceNode.jsx        ← Node START
```

### `WorkflowEditor.jsx` — logic quan trọng

**`normalizeEdges(rawEdges, nodes)`**
Chuẩn hóa `sourceHandle` khi load từ DB hoặc lưu vào DB:
- `sourceNode` → handle `'true'`
- `taskNode` trong `SINGLE_OUTPUT_LABELS` → handle `'default'`
- `taskNode` branch không có handle → `'true'`
- Lọc duplicate IDs

Hàm này được gọi tại:
1. Load: `useEdgesState(normalizeEdges(workflow.edges, workflow.nodes))`
2. Save: `normalizeEdges(edges, nodes)` trước khi PUT
3. Import: `normalizeEdges(data.edges, data.nodes)`

---

## Quy ước đặt tên

| Loại | Convention | Ví dụ |
|---|---|---|
| Component React | PascalCase | `WorkflowEditor`, `TaskNode` |
| Hook | camelCase + prefix `use` | `useExecutionSocket` |
| Handler | camelCase + prefix `handle` | `handleKhaiBaoBien` |
| Service | PascalCase + suffix `Service` | `WorkflowsService` |
| Route file | camelCase + suffix `Routes` | `workflowRoutes.js` |
| Model | PascalCase | `Account`, `Proxy` |
| Constant | UPPER_SNAKE_CASE | `SINGLE_OUTPUT_LABELS`, `NODE_TEMPLATES` |
