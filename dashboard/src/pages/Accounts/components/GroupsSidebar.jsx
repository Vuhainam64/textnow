import { Plus, Users, FolderOpen, Pencil, Trash2, X } from 'lucide-react'

export default function GroupsSidebar({
    groups, ungroupedCount, selectedGroup, totalAccounts,
    onSelectGroup, onNewGroup, onEdit, onClearMembers, onDeleteGroup, onAssign
}) {
    return (
        <aside className="w-56 flex-shrink-0 flex flex-col gap-2 sticky top-6 h-fit">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nhóm</span>
                <button onClick={onNewGroup}
                    className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-all"
                    title="Tạo nhóm mới">
                    <Plus size={14} />
                </button>
            </div>

            {/* All */}
            <button onClick={() => onSelectGroup('__all__')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${selectedGroup === '__all__' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                <Users size={15} className="flex-shrink-0" />
                <span className="flex-1 truncate">Tất cả</span>
                <span className="text-xs text-slate-500 font-medium">{totalAccounts}</span>
            </button>

            {/* Ungrouped */}
            <div className={`group/ug relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer
                ${selectedGroup === '__ungrouped__' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                onClick={() => onSelectGroup('__ungrouped__')}>
                <FolderOpen size={15} className="flex-shrink-0 text-slate-500" />
                <span className="flex-1 truncate">Chưa có nhóm</span>
                <span className="text-xs text-slate-500 font-medium group-hover/ug:hidden">{ungroupedCount}</span>
                {ungroupedCount > 0 && (
                    <button onClick={e => { e.stopPropagation(); onAssign() }}
                        className="hidden group-hover/ug:flex w-6 h-6 rounded-md hover:bg-blue-500/20 hover:text-blue-400 items-center justify-center transition-all absolute right-2"
                        title="Phân nhóm">
                        <Plus size={11} />
                    </button>
                )}
            </div>

            {groups.length > 0 && <div className="border-t border-white/5 my-1" />}

            {groups.map(g => (
                <div key={g._id}
                    className={`group/item relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer
                    ${selectedGroup === g._id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                    onClick={() => onSelectGroup(g._id)}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                    <span className="flex-1 truncate text-sm">{g.name}</span>
                    <span className="text-xs text-slate-500 font-medium group-hover/item:hidden">{g.account_count}</span>
                    <div className="hidden group-hover/item:flex items-center gap-0.5 absolute right-2">
                        <button onClick={e => { e.stopPropagation(); onEdit(g) }}
                            className="w-6 h-6 rounded-md hover:bg-blue-500/20 hover:text-blue-400 flex items-center justify-center transition-all" title="Sửa nhóm">
                            <Pencil size={11} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); onClearMembers(g) }}
                            className="w-6 h-6 rounded-md hover:bg-orange-500/20 hover:text-orange-400 flex items-center justify-center transition-all" title="Xóa tài khoản trong nhóm">
                            <Trash2 size={11} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); onDeleteGroup(g) }}
                            className="w-6 h-6 rounded-md hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-all" title="Xóa nhóm">
                            <X size={11} />
                        </button>
                    </div>
                </div>
            ))}
        </aside>
    )
}
