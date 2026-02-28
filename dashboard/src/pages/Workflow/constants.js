export const NODE_TEMPLATES = [
    {
        type: 'sourceNode',
        label: 'START',
        category: 'Hệ thống',
        icon: 'Zap',
        color: 'bg-emerald-500/20 text-emerald-400',
        config: {}
    },
    // Category: Profile
    { type: 'taskNode', label: 'Tạo profile mới', category: 'Profile', icon: 'UserPlus', color: 'bg-indigo-500/20 text-indigo-400', config: { initial_url: 'https://google.com', proxy_mode: 'auto', timeout: 60 } },
    { type: 'taskNode', label: 'Mở trình duyệt', category: 'Profile', icon: 'MonitorPlay', color: 'bg-blue-500/20 text-blue-400', config: { timeout: 60 } },
    { type: 'taskNode', label: 'Kết nối Browser', category: 'Profile', icon: 'Plug', color: 'bg-cyan-500/20 text-cyan-400', config: { ws_endpoint: 'ws://127.0.0.1:PORT', timeout: 15 } },
    { type: 'taskNode', label: 'Đóng trình duyệt', category: 'Profile', icon: 'MonitorOff', color: 'bg-rose-500/20 text-rose-400', config: { timeout: 30 } },
    { type: 'taskNode', label: 'Xoá profile', category: 'Profile', icon: 'Trash2', color: 'bg-red-500/20 text-red-400', config: { timeout: 30 } },
    { type: 'taskNode', label: 'Xoá profile local', category: 'Profile', icon: 'FolderX', color: 'bg-orange-600/20 text-orange-400', config: { timeout: 30 } },

    // Category: Thao tác
    { type: 'taskNode', label: 'Mở trang web', category: 'Thao tác', icon: 'Globe', color: 'bg-sky-500/20 text-sky-400', config: { url: 'https://google.com', timeout: 30 } },
    { type: 'taskNode', label: 'Click chuột', category: 'Thao tác', icon: 'MousePointer2', color: 'bg-purple-500/20 text-purple-400', config: { selector: '', timeout: 30 } },
    { type: 'taskNode', label: 'Nhập văn bản', category: 'Thao tác', icon: 'Keyboard', color: 'bg-amber-500/20 text-amber-400', config: { selector: '', value: '', timeout: 30 } },
    { type: 'taskNode', label: 'Chờ đợi', category: 'Thao tác', icon: 'Clock', color: 'bg-slate-500/20 text-slate-400', config: { seconds: 5, timeout: 60 } },

    // Category: Captcha
    {
        type: 'taskNode', label: 'PerimeterX', category: 'Captcha', icon: 'ShieldBan', color: 'bg-rose-500/20 text-rose-400',
        config: {
            selector: 'button[type="submit"]',
            api_url: 'https://www.textnow.com/api/emails/auth/{{email}}',
            wait_ms: 1500,   // ms cho sau khi click truoc khi check API
            poll_ms: 1000,   // ms giua moi lan poll API trong khi giu
            modal_wait: 10,     // giay cho captcha modal hien ra
            timeout: 300,    // giay timeout tong the
        }
    },

    // Category: Email
    { type: 'taskNode', label: 'Kiểm tra Email', category: 'Email', icon: 'Mail', color: 'bg-pink-500/20 text-pink-400', config: { folder: 'INBOX', timeout: 60, search_query: '', retries: 3 } },
    { type: 'taskNode', label: 'Đọc Email', category: 'Email', icon: 'MailOpen', color: 'bg-violet-500/20 text-violet-400', config: { from: 'noreply@notifications.textnow.com', subject_contains: '', extract_type: 'link', extract_pattern: '', output_variable: 'result', retries: 3, wait_seconds: 30, timeout: 120 } },
    { type: 'taskNode', label: 'Xoá tất cả Mail', category: 'Email', icon: 'MailX', color: 'bg-red-500/20 text-red-400', config: { folders: 'INBOX,Junk', timeout: 60 } },

    // Category: Logic
    { type: 'taskNode', label: 'Khai báo biến', category: 'Logic', icon: 'Braces', color: 'bg-teal-500/20 text-teal-400', config: { variables: 'reset_link=\notp=\nverify_link=', timeout: 5 } },
    { type: 'taskNode', label: 'Lặp lại', category: 'Logic', icon: 'RefreshCw', color: 'bg-yellow-500/20 text-yellow-400', config: { max_retries: 3, timeout: 5 } },
    { type: 'taskNode', label: 'Điều kiện', category: 'Logic', icon: 'GitBranch', color: 'bg-cyan-500/20 text-cyan-400', config: { type: 'element_exists', selector: '', timeout: 10 } },

    // Category: Hệ thống (Advanced)
    { type: 'taskNode', label: 'Cập nhật trạng thái', category: 'Hệ thống', icon: 'UserCog', color: 'bg-orange-500/20 text-orange-400', config: { status: 'active', timeout: 10 } },
];
