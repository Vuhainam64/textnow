import React from 'react';
import { Handle, Position } from '@xyflow/react';
import * as Icons from 'lucide-react';

// Các block luôn thành công — chỉ có 1 đầu ra (không cần TRUE/FALSE)
const SINGLE_OUTPUT_BLOCKS = [
    'Chờ đợi',
    'Khai báo biến',
    'Cập nhật trạng thái',
    'Xoá profile',
    'Xoá profile local',
    'Đóng trình duyệt',
    'Xoá tất cả Mail',
];

const TaskNode = ({ data, selected }) => {
    const IconComponent = typeof data.icon === 'string' ? Icons[data.icon] : data.icon;
    const Icon = IconComponent || Icons.MousePointer2;
    const hasBranch = !SINGLE_OUTPUT_BLOCKS.includes(data.label);

    return (
        <div className={`px-4 py-3 rounded-xl glass border-2 transition-all min-w-[160px]
            ${selected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-white/5 hover:border-white/20'}`}>

            {/* Input handle (top) */}
            <Handle type="target" position={Position.Top} className="!bg-blue-500 !border-2 !border-[#161b27]" />

            {/* Node content */}
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.color || 'bg-blue-500/20 text-blue-400'}`}>
                    <Icon size={16} />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-1">{data.category}</p>
                    <p className="text-sm font-semibold text-slate-200">{data.label}</p>
                </div>
            </div>

            {/* Output handles */}
            {hasBranch ? (
                <div className="flex justify-between items-end w-full mt-2 pt-2 border-t border-white/5">
                    {/* TRUE handle - left */}
                    <div className="flex flex-col items-center gap-1 relative">
                        <span className="text-[8px] font-bold text-emerald-500">TRUE</span>
                        <Handle
                            type="source"
                            position={Position.Bottom}
                            id="true"
                            style={{ position: 'relative', transform: 'none', left: 'auto', bottom: 'auto' }}
                            className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-[#161b27]"
                        />
                    </div>
                    {/* FALSE handle - right */}
                    <div className="flex flex-col items-center gap-1 relative">
                        <span className="text-[8px] font-bold text-rose-500">FALSE</span>
                        <Handle
                            type="source"
                            position={Position.Bottom}
                            id="false"
                            style={{ position: 'relative', transform: 'none', left: 'auto', bottom: 'auto' }}
                            className="!bg-rose-500 !w-3 !h-3 !border-2 !border-[#161b27]"
                        />
                    </div>
                </div>
            ) : (
                /* Single output */
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="default"
                    className="!bg-blue-500 !border-2 !border-[#161b27]"
                />
            )}
        </div>
    );
};

export default React.memo(TaskNode);
