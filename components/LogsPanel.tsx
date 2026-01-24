
import React, { useMemo } from 'react';
import { LogEntry, GestureType } from '../types';

interface LogsPanelProps {
  logs: LogEntry[];
}

const THEME_MAP: Record<GestureType, { color: string, label: string | null }> = {
  [GestureType.NONE]: { color: '#3b82f6', label: null }, // Blue for none, no label
  [GestureType.OPEN_PALM]: { color: '#10b981', label: 'Palm' },
  [GestureType.FIST]: { color: '#f97316', label: 'Fist' },
  [GestureType.THUMBS_UP]: { color: '#f59e0b', label: 'Thumb' },
  [GestureType.TOUCHING_HEAD]: { color: '#a855f7', label: 'Head' },
  [GestureType.ARMS_UP]: { color: '#f43f5e', label: 'Arms' }
};

const LogsPanel: React.FC<LogsPanelProps> = ({ logs }) => {
  // Sort logs to have oldest on left, newest on right for a standard graph feel
  const chronoSortedLogs = useMemo(() => [...logs].reverse(), [logs]);
  
  // Calculate bars for visualization
  // We take the last 50 logs for the graph bars
  const graphData = useMemo(() => {
     return logs.slice(0, 50).reverse();
  }, [logs]);

  return (
    <div className="w-full bg-slate-900/60 rounded-2xl border border-slate-800 p-6 flex flex-col space-y-4 shadow-2xl">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Real-time Activity Graph</h2>
        </div>
        <div className="flex space-x-4">
           {Object.entries(THEME_MAP).map(([type, theme]) => theme.label && (
             <div key={type} className="flex items-center space-x-1.5">
               <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.color }} />
               <span className="text-[10px] text-slate-500 font-bold uppercase">{theme.label}</span>
             </div>
           ))}
           <div className="flex items-center space-x-1.5">
             <div className="w-2 h-2 rounded-full bg-blue-500" />
             <span className="text-[10px] text-slate-500 font-bold uppercase">None</span>
           </div>
        </div>
      </div>

      <div className="relative h-48 bg-slate-950/50 rounded-xl border border-slate-800/50 overflow-hidden flex flex-col">
        {/* Graph Area */}
        <div className="flex-1 flex items-end px-1 pb-1 space-x-[2px] overflow-hidden">
          {graphData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-slate-700 text-xs font-mono uppercase tracking-tighter animate-pulse">
                &lt; waiting_for_data_stream /&gt;
              </span>
            </div>
          ) : (
             graphData.map((log) => (
                <div 
                    key={log.id} 
                    className="flex-1 min-w-[4px] rounded-t-sm transition-all duration-300 hover:opacity-100 opacity-80"
                    style={{ 
                        backgroundColor: THEME_MAP[log.type].color,
                        height: log.type === GestureType.NONE ? '10%' : '60%' // Simple height diff for active vs non-active
                    }}
                    title={`${log.message} - ${log.timestamp.toLocaleTimeString()}`}
                />
             ))
          )}
        </div>
        
        {/* Grid lines overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 opacity-20">
            <div className="w-full h-px bg-indigo-500/30" />
            <div className="w-full h-px bg-indigo-500/30" />
            <div className="w-full h-px bg-indigo-500/30" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                    <th className="py-2 pl-2">Time</th>
                    <th className="py-2">Event</th>
                    <th className="py-2 text-right pr-2">ID</th>
                </tr>
            </thead>
            <tbody className="text-sm font-mono text-slate-400">
                {logs.slice(0, 5).map(log => (
                    <tr key={log.id} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors">
                        <td className="py-2 pl-2 text-slate-500">{log.timestamp.toLocaleTimeString()}</td>
                        <td className="py-2 font-bold" style={{ color: THEME_MAP[log.type].color }}>{log.message}</td>
                        <td className="py-2 text-right pr-2 text-slate-600 opacity-50">{log.id}</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default LogsPanel;
