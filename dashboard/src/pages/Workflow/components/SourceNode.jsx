import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Zap } from 'lucide-react';

const SourceNode = ({ selected }) => {
    return (
        <div className={`px-5 py-4 rounded-2xl glass border-2 transition-all min-w-[160px]
            ${selected ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-emerald-500/30 hover:border-emerald-500/60'}`}>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
                    <Zap size={20} className="fill-emerald-400" />
                </div>
                <div>
                    <p className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-widest leading-none mb-1">Điểm bắt đầu</p>
                    <p className="text-sm font-bold text-slate-100">START</p>
                </div>
            </div>
            <p className="text-[9px] text-slate-500 mt-2 italic">Chọn nguồn dữ liệu khi chạy</p>
            <Handle type="source" position={Position.Bottom} id="true" className="!bg-emerald-500 !p-1 !border-2 !border-[#161b27]" />
        </div>
    );
};

export default React.memo(SourceNode);
