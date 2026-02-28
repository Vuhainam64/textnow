import React from 'react';
import { Handle, Position } from '@xyflow/react';
import * as Icons from 'lucide-react';

// Cac block luon thanh cong — chi co 1 dau ra (khong can TRUE/FALSE)
const SINGLE_OUTPUT_BLOCKS = [
    'Ch\u1edd \u0111\u1ee3i',
    'Khai b\u00e1o bi\u1ebfn',
    'C\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i',
    'Xo\u00e1 profile',
    'Xo\u00e1 profile local',
    '\u0110\u00f3ng tr\u00ecnh duy\u1ec7t',
    'Xo\u00e1 t\u1ea5t c\u1ea3 Mail',
];

const TaskNode = ({ id, data, selected }) => {
    const IconComponent = typeof data.icon === 'string' ? Icons[data.icon] : data.icon;
    const Icon = IconComponent || Icons.MousePointer2;
    const hasBranch = !SINGLE_OUTPUT_BLOCKS.includes(data.label);
    const isActive = !!data._active;
    const hasPort = !!data._browserPort;
    const onResume = data._onResume;

    return (
        <div
            className={`px-4 py-3 rounded-xl glass border-2 transition-all min-w-[160px] relative group/node
                ${isActive
                    ? 'border-amber-400 shadow-[0_0_24px_4px_rgba(251,191,36,0.35)]'
                    : selected
                        ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                        : 'border-white/5 hover:border-white/20'
                }`}
        >
            {/* Input handle (top) */}
            <Handle type="target" position={Position.Top} className="!bg-blue-500 !border-2 !border-[#161b27]" />

            {/* Active spinner */}
            {isActive && (
                <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/50">
                    <Icons.Loader2 size={10} className="text-black animate-spin" />
                </div>
            )}

            {/* Resume button — hien khi hover, an khi dang chay */}
            {!isActive && onResume && (
                <div className="absolute -top-2 -right-2 opacity-0 group-hover/node:opacity-100 transition-all duration-150 pointer-events-none group-hover/node:pointer-events-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); onResume(id); }}
                        title={hasPort
                            ? `Chay tiep tu day (CDP :${data._browserPort})`
                            : 'Chay tiep quy trinh tu khoi nay'
                        }
                        className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold shadow-lg transition-all
                            ${hasPort
                                ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/40'
                                : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/30'
                            }`}
                    >
                        <Icons.Play size={7} fill="currentColor" />
                        {hasPort ? 'Tiep' : 'Tu day'}
                    </button>
                </div>
            )}

            {/* Node content */}
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${data.color || 'bg-blue-500/20 text-blue-400'} ${isActive ? 'animate-pulse' : ''}`}>
                    <Icon size={16} />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-1 truncate">{data.category}</p>
                    <p className={`text-sm font-semibold truncate ${isActive ? 'text-amber-300' : 'text-slate-200'}`}>{data.label}</p>
                </div>
            </div>

            {/* Output handles */}
            {hasBranch ? (
                <div className="flex justify-between items-end w-full mt-2 pt-2 border-t border-white/5">
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
