import { Settings2, Trash2, Share2, Link2Off, BoxSelect } from 'lucide-react'
import * as Icons from 'lucide-react'
import Select from '../../../components/Select'

/**
 * Right-side configuration panel for a selected node or edge
 */
export default function NodeConfigPanel({
    selectedNode,   // raw selectedNode state
    selectedEdge,
    selectedNodes,
    nodes,          // full nodes array (to get up-to-date data)
    updateNodeConfig,
    deleteNode,
    deleteEdge,
    deleteSelected,
    handleRun,
}) {
    const activeSelectedNode = selectedNode ? nodes.find(n => n.id === selectedNode.id) : null

    const isVisible = !!(activeSelectedNode || selectedEdge || selectedNodes.length > 1)

    return (
        <aside className={`w-72 glass border-l border-white/5 z-10 transition-all duration-300 flex flex-col overflow-hidden
            ${isVisible ? 'translate-x-0' : 'translate-x-full absolute right-0 scale-95 opacity-0'}`}>

            {/* Node config */}
            {activeSelectedNode && (
                <div className="flex flex-col h-full">
                    {/* Fixed header */}
                    <div className="p-4 pb-0 space-y-4 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Settings2 size={16} className="text-blue-400" />
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Cấu hình khối</span>
                            </div>
                            <button onClick={deleteNode} className="p-1.5 hover:bg-red-500/10 text-slate-600 hover:text-red-500 rounded-lg transition-all">
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">{activeSelectedNode.data.category}</p>
                            <p className="text-sm font-bold text-slate-200">{activeSelectedNode.data.label}</p>
                        </div>
                    </div>

                    {/* Scrollable content */}
                    <div className="flex-1 overflow-y-auto p-4 pt-4 space-y-5 text-slate-200 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
                        {activeSelectedNode.type === 'sourceNode' ? (
                            <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                    <Icons.Zap size={24} className="text-emerald-400 fill-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-300 mb-1">Điểm bắt đầu</p>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        Nhóm tài khoản và proxy sẽ được<br />
                                        chọn khi nhấn <span className="text-emerald-400 font-bold">▶ Chạy thử</span>
                                    </p>
                                </div>
                                <button
                                    onClick={handleRun}
                                    className="mt-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-all flex items-center gap-2"
                                >
                                    <Icons.Play size={12} fill="white" /> Cấu hình & Chạy thử
                                </button>
                            </div>
                        ) : (
                            Object.keys(activeSelectedNode.data.config || {}).filter(k => !k.startsWith('delay_')).map(key => {
                                const label = key.replace(/_/g, ' ')
                                const value = activeSelectedNode.data.config[key]

                                if (key === 'type' && activeSelectedNode.data.label === 'Điều kiện') {
                                    return (
                                        <div key={key}>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">{label}</label>
                                            <Select
                                                options={[
                                                    { value: 'element_exists', label: 'Phần tử xuất hiện' },
                                                    { value: 'element_not_exists', label: 'Phần tử biến mất' },
                                                    { value: 'text_exists', label: 'Chứa đoạn chữ' },
                                                ]}
                                                value={value}
                                                onChange={(e) => updateNodeConfig(activeSelectedNode.id, key, e.target.value)}
                                            />
                                        </div>
                                    )
                                }

                                if (key === 'status' && activeSelectedNode.data.label === 'Cập nhật trạng thái') {
                                    return (
                                        <div key={key}>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">{label}</label>
                                            <Select
                                                options={[
                                                    { value: 'active', label: 'Hoạt động' },
                                                    { value: 'verified', label: 'Đã xác thực' },
                                                    { value: 'captcha', label: 'Lỗi Captcha' },
                                                    { value: 'die_mail', label: 'Die Mail' },
                                                    { value: 'no_mail', label: 'No Mail' },
                                                    { value: 'Reset Error', label: 'Lỗi Reset' },
                                                    { value: 'banned', label: 'Bị khoá' },
                                                    { value: 'inactive', label: 'Không kích hoạt' },
                                                    { value: 'pending', label: 'Chờ xử lý' },
                                                ]}
                                                value={value}
                                                onChange={(e) => updateNodeConfig(activeSelectedNode.id, key, e.target.value)}
                                            />
                                        </div>
                                    )
                                }

                                if (key === 'extract_type' && activeSelectedNode.data.label === 'Đọc Email') {
                                    return (
                                        <div key={key}>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">Loại trích xuất</label>
                                            <Select
                                                options={[
                                                    { value: 'link', label: 'Link đầu tiên trong email' },
                                                    { value: 'link_pattern', label: 'Link theo pattern (extract_pattern)' },
                                                    { value: 'otp_subject', label: 'OTP từ tiêu đề (Subject)' },
                                                    { value: 'otp_body', label: 'OTP từ nội dung (Body)' },
                                                    { value: 'regex', label: 'Regex tuỳ chỉnh' },
                                                ]}
                                                value={value}
                                                onChange={(e) => updateNodeConfig(activeSelectedNode.id, key, e.target.value)}
                                            />
                                        </div>
                                    )
                                }

                                if (key === 'variables' && activeSelectedNode.data.label === 'Khai báo biến') {
                                    return (
                                        <div key={key}>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">Danh sách biến</label>
                                            <p className="text-[9px] text-slate-600 italic pl-1 mb-2">Mỗi dòng: <span className="text-teal-500 font-mono">tên_biến=giá_trị</span></p>
                                            <textarea
                                                rows={6}
                                                className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50 transition-all font-mono resize-none"
                                                value={value}
                                                onChange={(e) => updateNodeConfig(activeSelectedNode.id, key, e.target.value)}
                                                placeholder={"reset_link=\notp=\nverify_link="}
                                            />
                                        </div>
                                    )
                                }

                                return (
                                    <div key={key}>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 pl-1">{label}</label>
                                        <input
                                            type={['seconds', 'timeout', 'retries', 'wait_seconds'].includes(key) ? 'number' : 'text'}
                                            className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all font-medium"
                                            value={value}
                                            onChange={(e) => updateNodeConfig(activeSelectedNode.id, key, e.target.value)}
                                            placeholder={`Nhập ${label.toLowerCase()}...`}
                                        />
                                    </div>
                                )
                            })
                        )}

                        {/* Random Delay Config */}
                        {activeSelectedNode.type !== 'sourceNode' && (
                            <div className="pt-4 border-t border-white/5 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icons.Clock size={13} className="text-amber-500" />
                                    <label className="text-[10px] font-bold text-amber-500 uppercase">Nghỉ ngẫu nhiên sau khối</label>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] text-slate-500 block mb-1.5 ml-1">Giây (Ít nhất)</label>
                                        <input type="number"
                                            className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/30 transition-all font-medium"
                                            value={activeSelectedNode.data.config?.delay_min || 0}
                                            onChange={(e) => updateNodeConfig(activeSelectedNode.id, 'delay_min', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-slate-500 block mb-1.5 ml-1">Giây (Nhiều nhất)</label>
                                        <input type="number"
                                            className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/30 transition-all font-medium"
                                            value={activeSelectedNode.data.config?.delay_max || 0}
                                            onChange={(e) => updateNodeConfig(activeSelectedNode.id, 'delay_max', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Edge config */}
            {selectedEdge && (
                <div className="space-y-6 text-slate-200 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Share2 size={16} className="text-purple-400" />
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Kết nối</span>
                        </div>
                        <button onClick={deleteEdge} className="p-1.5 hover:bg-red-500/10 text-slate-600 hover:text-red-500 rounded-lg transition-all">
                            <Trash2 size={14} />
                        </button>
                    </div>
                    <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Hành động</span>
                            <button onClick={deleteEdge} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[11px] font-bold transition-all">
                                <Link2Off size={13} /> Xoá dây
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-400 italic">Dây này kết nối trình tự thực hiện giữa hai khối lệnh.</p>
                    </div>
                </div>
            )}

            {/* Multi-select */}
            {!activeSelectedNode && !selectedEdge && selectedNodes.length > 1 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6 animate-in fade-in zoom-in duration-300">
                    <div className="w-20 h-20 rounded-[2.5rem] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-2xl shadow-blue-500/10">
                        <BoxSelect size={40} />
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm font-bold text-slate-200">Đã chọn {selectedNodes.length} khối</p>
                        <p className="text-xs text-slate-500">Bạn có thể di chuyển chúng cùng lúc hoặc xoá tất cả.</p>
                    </div>
                    <button
                        onClick={deleteSelected}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 transition-all font-bold text-xs"
                    >
                        <Trash2 size={16} /> Xoá {selectedNodes.length} khối đã chọn
                    </button>
                </div>
            )}

            {/* Empty state */}
            {!activeSelectedNode && !selectedEdge && selectedNodes.length <= 1 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-700">
                        <Settings2 size={32} />
                    </div>
                    <p className="text-xs text-slate-500 font-medium">Chọn một khối hoặc dây nối trên sơ đồ để cấu hình</p>
                </div>
            )}
        </aside>
    )
}
