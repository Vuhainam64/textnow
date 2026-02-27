import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { MousePointer2 } from 'lucide-react';

const TaskNode = ({ data, selected }) => {
    const Icon = data.icon || MousePointer2;
    return (
        <div className={`px-4 py-3 rounded-xl glass border-2 transition-all min-w-[150px]
            ${selected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-white/5 hover:border-white/20'}`}>
            <Handle type="target" position={Position.Top} className="!bg-blue-500 !border-2 !border-[#161b27]" />
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.color || 'bg-blue-500/20 text-blue-400'}`}>
                    <Icon size={16} />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-1">{data.category}</p>
                    <p className="text-sm font-semibold text-slate-200">{data.label}</p>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !border-2 !border-[#161b27]" />
        </div>
    );
};

export default React.memo(TaskNode);
