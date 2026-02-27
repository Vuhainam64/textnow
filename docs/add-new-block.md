# Hướng dẫn thêm Block Workflow Mới

> Dành cho developer muốn mở rộng hệ thống với block mới.

---

## Bước 1: Định nghĩa template trong `constants.js`

File: `dashboard/src/pages/Workflow/constants.js`

```js
export const NODE_TEMPLATES = [
  // ...
  {
    category: 'Email',          // Nhóm hiển thị trong sidebar
    label: 'Gửi Email',         // Tên block (PHẢI UNIQUE — là key toàn hệ thống)
    icon: 'Mail',               // Tên icon từ lucide-react
    description: 'Gửi email qua SMTP',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    config: {                   // Cấu hình mặc định (hiển thị trong panel phải)
      to: '',
      subject: '',
      body: '',
    },
    fields: [                   // Định nghĩa UI để người dùng điền cấu hình
      { key: 'to', label: 'Gửi tới', type: 'text', placeholder: '{{email}}' },
      { key: 'subject', label: 'Tiêu đề', type: 'text' },
      { key: 'body', label: 'Nội dung', type: 'textarea' },
    ]
  }
]
```

---

## Bước 2: Viết handler logic

Tạo hoặc thêm vào file phù hợp trong `src/services/nodeHandlers/`:

- `logicNodes.js` → Biến, vòng lặp, điều kiện, chờ đợi
- `browserNodes.js` → Profile, trình duyệt, click, nhập text
- `emailNodes.js` → Email IMAP/SMTP, OAuth
- Tạo file mới nếu thuộc domain khác

```js
// src/services/nodeHandlers/emailNodes.js
export async function handleGuiEmail(executionId, config, context, engine) {
    const { to, subject, body } = config;
    const resolvedTo = engine._resolveValue(to, context);
    const resolvedBody = engine._resolveValue(body, context);

    // ... logic gửi email

    engine._log(executionId, `   + Da gui email den: ${resolvedTo}`);
    return true;   // true = thành công, false = thất bại
}
```

### Giá trị trả về
| Return | Ý nghĩa |
|---|---|
| `true` | Thành công → đi theo nhánh TRUE |
| `false` | Thất bại → đi theo nhánh FALSE |
| `undefined` | Tương đương `true` |
| `throw Error` | Lỗi nghiêm trọng → dừng thread này |

---

## Bước 3: Đăng ký trong dispatcher

File: `src/services/workflowEngine.js`

```js
// Import
import { handleGuiEmail } from './nodeHandlers/emailNodes.js';

// Trong _runNodeLogic:
case 'Gửi Email': return handleGuiEmail(executionId, config, context, this);
```

---

## Bước 4: Khai báo single-output (nếu cần)

Nếu block của bạn **chỉ có 1 đầu ra** (không phân nhánh true/false),
thêm label vào `SINGLE_OUTPUT_LABELS` trong `WorkflowEditor.jsx`:

```js
const SINGLE_OUTPUT_LABELS = [
    'Chờ đợi', 'Khai báo biến', /* ... */,
    'Gửi Email',   // ← thêm ở đây nếu single-output
];
```

Nếu block có 2 đầu ra (true/false) → **không cần** làm bước này.

---

## Sử dụng Template Context

Trong handler, bạn có thể dùng `engine._resolveValue(str, context)` để
thay thế `{{variable}}` bằng giá trị thực:

```js
// Template: "Chào {{email}}, mật khẩu mới là {{new_password}}"
const resolved = engine._resolveValue(config.message, context);
// → "Chào user@gmail.com, mật khẩu mới là Abc123!"
```

### Biến mặc định
| Template | Giá trị |
|---|---|
| `{{email}}` | `context.account.textnow_user` |
| `{{pass}}` | `context.account.textnow_pass` |
| `{{hotmail}}` | `context.account.hotmail_user` |
| `{{hotmail_pass}}` | `context.account.hotmail_pass` |
| `{{tên_biến}}` | `context[tên_biến]` (từ Khai báo biến / Đọc Email) |
