"use client";

import React, { useMemo } from 'react';
import { LogEntry, GestureType } from '../types';

interface LogsPanelProps {
  logs: LogEntry[];
}

const THEME_MAP: Record<GestureType, { color: string; label: string | null }> = {
  [GestureType.NONE]: { color: '#3b82f6', label: null },
  [GestureType.OPEN_PALM]: { color: '#22c55e', label: 'Palm' },
  [GestureType.FIST]: { color: '#ef4444', label: 'Fist' },
  [GestureType.THUMBS_UP]: { color: '#f59e0b', label: 'Thumb' },
  [GestureType.POINTING]: { color: '#3b82f6', label: 'Point' },
  [GestureType.PEACE]: { color: '#a855f7', label: 'Peace' },
  [GestureType.TOUCHING_HEAD]: { color: '#f97316', label: 'Head' },
  [GestureType.ARMS_UP]: { color: '#f43f5e', label: 'Arms' },
  [GestureType.DISTRESS]: { color: '#dc2626', label: 'DISTRESS' }
};

const LogsPanel: React.FC<LogsPanelProps> = ({ logs }) => {
  const graphData = useMemo(() => {
    return logs.slice(0, 60).reverse();
  }, [logs]);

  return (
    <div className="w-full bg-zinc-900/60 rounded-xl border border-zinc-800 p-4 flex flex-col space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Activity Timeline</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(THEME_MAP).map(([type, theme]) => theme.label && (
            <div key={type} className="flex items-center space-x-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.color }} />
              <span className="text-[10px] text-zinc-500 font-bold uppercase">{theme.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative h-32 bg-zinc-950/50 rounded-lg border border-zinc-800/50 overflow-hidden flex flex-col">
        <div className="flex-1 flex items-end px-1 pb-1 space-x-[2px] overflow-hidden">
          {graphData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-zinc-700 text-xs font-mono uppercase tracking-tighter animate-pulse">
                Waiting for data...
              </span>
            </div>
          ) : (
            graphData.map((log) => {
              const isActive = log.type !== GestureType.NONE;
              const isDistress = log.type === GestureType.DISTRESS || log.type === GestureType.TOUCHING_HEAD || log.type === GestureType.ARMS_UP;
              return (
                <div 
                  key={log.id} 
                  className={`flex-1 min-w-[3px] rounded-t-sm transition-all duration-200 ${isDistress ? 'animate-pulse' : ''}`}
                  style={{ 
                    backgroundColor: THEME_MAP[log.type]?.color || '#3b82f6',
                    height: isDistress ? '90%' : isActive ? '50%' : '15%',
                    opacity: isActive ? 1 : 0.5
                  }}
                  title={`${log.message} - ${log.timestamp.toLocaleTimeString()}`}
                />
              );
            })
          )}
        </div>
        
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 opacity-20">
          <div className="w-full h-px bg-zinc-500/30" />
          <div className="w-full h-px bg-zinc-500/30" />
          <div className="w-full h-px bg-zinc-500/30" />
        </div>
      </div>

      {logs.length > 0 && (
        <div className="max-h-24 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <tbody className="text-xs font-mono text-zinc-400">
              {logs.slice(0, 5).map(log => (
                <tr key={log.id} className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors">
                  <td className="py-1.5 text-zinc-600 w-20">{log.timestamp.toLocaleTimeString()}</td>
                  <td className="py-1.5 font-bold" style={{ color: THEME_MAP[log.type]?.color || '#fff' }}>{log.message}</td>
                  <td className="py-1.5 text-right text-zinc-700 w-16">{log.id.slice(0, 6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LogsPanel;

