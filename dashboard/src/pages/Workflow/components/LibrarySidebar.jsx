import { useState } from 'react';
import * as Icons from 'lucide-react';
import { NODE_TEMPLATES } from '../constants';

export default function LibrarySidebar({ onAddNode, onDragStart }) {
    const [search, setSearch] = useState(null); // null = hidden, '' = open empty

    const q = search ? search.toLowerCase().trim() : '';
    const filtered = NODE_TEMPLATES.filter(t =>
        t.type !== 'sourceNode' &&
        (!q || t.label?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q))
    );
    const categories = [...new Set(filtered.map(t => t.category))];

    return (
        <aside className="w-64 glass border-r border-white/5 z-10 flex flex-col overflow-hidden shrink-0 text-slate-200">
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <Icons.Binary size={14} className="text-purple-400" />
                    <p className="text-[10px] font-bold text-slate-200 uppercase tracking-widest flex-1">Thư viện khối</p>
                    <button
                        onClick={() => setSearch(s => s === null ? '' : null)}
                        className={`p-1 rounded-lg transition-all ${search !== null ? 'text-purple-400 bg-purple-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                        title="Tìm kiếm khối">
                        <Icons.Search size={13} />
                    </button>
                </div>
                {search !== null && (
                    <div className="relative mt-2.5">
                        <Icons.Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm khối..."
                            className="w-full pl-7 pr-7 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/40 transition-all"
                        />
                        {search && (
                            <button onClick={() => setSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                <Icons.X size={11} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Block list */}
            <div className="p-4 space-y-6 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-800">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-slate-600">
                        <Icons.Search size={20} />
                        <p className="text-xs">Không tìm thấy khối</p>
                    </div>
                ) : categories.map(category => {
                    const templates = filtered.filter(t => t.category === category);
                    return (
                        <div key={category} className="space-y-2.5">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] pl-1 border-l-2 border-white/5 ml-0.5">
                                {category}
                            </h3>
                            <div className="space-y-2">
                                {templates.map((tpl, i) => {
                                    const Icon = Icons[tpl.icon] || Icons.MousePointer2;
                                    return (
                                        <button key={i}
                                            onClick={() => onAddNode(tpl)}
                                            draggable
                                            onDragStart={(e) => onDragStart(e, tpl.type, tpl)}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/5 hover:border-white/10 transition-all text-left group cursor-grab active:cursor-grabbing"
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${tpl.color} group-hover:scale-110 flex-shrink-0 shadow-lg`}>
                                                <Icon size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-semibold text-slate-300 truncate">{tpl.label}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
