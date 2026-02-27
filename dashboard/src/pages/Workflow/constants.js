import {
    UserPlus,
    MonitorPlay,
    Globe,
    MousePointer2,
    Keyboard,
    Clock,
    ShieldAlert
} from 'lucide-react';

export const NODE_TEMPLATES = [
    { type: 'taskNode', label: 'Tạo profile mới', category: 'Profile', icon: UserPlus, color: 'bg-indigo-500/20 text-indigo-400', config: { initial_url: 'https://google.com', proxy_mode: 'auto' } },
    { type: 'taskNode', label: 'Mở trình duyệt', category: 'Profile', icon: MonitorPlay, color: 'bg-blue-500/20 text-blue-400', config: { profile_id: '' } },
    { type: 'taskNode', label: 'Mở trang web', category: 'Trình duyệt', icon: Globe, color: 'bg-sky-500/20 text-sky-400', config: { url: 'https://google.com' } },
    { type: 'taskNode', label: 'Click chuột', category: 'Tương tác', icon: MousePointer2, color: 'bg-purple-500/20 text-purple-400', config: { selector: '' } },
    { type: 'taskNode', label: 'Nhập văn bản', category: 'Tương tác', icon: Keyboard, color: 'bg-amber-500/20 text-amber-400', config: { selector: '', value: '' } },
    { type: 'taskNode', label: 'Chờ đợi', category: 'Hệ thống', icon: Clock, color: 'bg-slate-500/20 text-slate-400', config: { seconds: 5 } },
    { type: 'taskNode', label: 'Giải Captcha', category: 'Xác thực', icon: ShieldAlert, color: 'bg-orange-500/20 text-orange-400', config: { type: 'reCaptcha' } },
];
