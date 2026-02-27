import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database } from 'lucide-react';

const SourceNode = ({ data, selected }) => {
    return (
        <div className={`px-4 py-3 rounded-2xl glass border-2 transition-all min-w-[180px]
            ${selected ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-emerald-500/20 hover:border-emerald-500/40'}`}>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
                    <Database size={20} />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest leading-none mb-1">Input</p>
                    <p className="text-sm font-bold text-slate-100">{data.label || 'Nguồn dữ liệu'}</p>
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[9px]">
                    <span className="text-slate-500 uppercase font-bold">Nhóm:</span>
                    <span className="text-emerald-400 font-bold truncate max-w-[80px]">{data.config?.account_group_name || 'Chưa chọn'}</span>
                </div>
                <div className="flex items-center justify-between text-[9px]">
                    <span className="text-slate-500 uppercase font-bold">Proxy:</span>
                    <span className="text-blue-400 font-bold truncate max-w-[80px]">{data.config?.proxy_group_name || 'Chưa chọn'}</span>
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !p-1 !border-2 !border-[#161b27]" />
        </div>
    );
};

export default React.memo(SourceNode);
