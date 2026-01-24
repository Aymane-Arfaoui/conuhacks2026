"use client";

import React, { useState, useCallback, useRef } from 'react';
import { CameraOff, BrainCircuit, Activity } from 'lucide-react';
import CameraContainer from '@/components/CameraContainer';
import { GestureType, GestureDetection, LogEntry } from '@/types';
import Header from '@/components/Header';
import GestureDisplay from '@/components/GestureDisplay';
import LogsPanel from '@/components/LogsPanel';

export default function Home() {
  const [isActive, setIsActive] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<GestureDetection | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const lastLogTimeRef = useRef<number>(0);

  const addLog = useCallback((gesture: GestureDetection) => {
    const now = Date.now();
    // Throttle logs for a smooth graph feel (10 samples per second)
    if (now - lastLogTimeRef.current < 100) return;
    
    lastLogTimeRef.current = now;

    setLogs((prev) => {
      const newMessage: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        message: gesture.label,
        type: gesture.type,
        timestamp: new Date(),
      };
      
      // Show last 150 samples in the timeline graph
      return [newMessage, ...prev].slice(0, 150);
    });
  }, []);

  const handleGestureDetected = useCallback((gesture: GestureDetection) => {
    setCurrentGesture(gesture);
    if (isActive) {
      addLog(gesture);
    }
  }, [addLog, isActive]);

  const toggleCamera = () => {
    setIsActive((prev) => !prev);
    if (isActive) {
      setCurrentGesture(null);
      setLogs([]); // Clear logs when stopping
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 space-y-6 bg-slate-950 text-white">
      <Header />

      <main className="flex-1 flex flex-col space-y-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col space-y-4">
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
              {isActive ? (
                <CameraContainer onGestureDetected={handleGestureDetected} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 space-y-4">
                  <div className="p-6 bg-slate-800/50 rounded-full">
                    <CameraOff size={48} className="text-slate-600" />
                  </div>
                  <p className="text-lg font-medium">Camera is currently inactive</p>
                  <button
                    onClick={toggleCamera}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-lg hover:shadow-indigo-500/20"
                  >
                    Start Recognition
                  </button>
                </div>
              )}

              {isActive && currentGesture && currentGesture.type !== GestureType.NONE && (
                <div className="absolute top-4 left-4 z-20">
                  <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-xl">
                    <Activity size={18} className="text-white animate-pulse" />
                    <span className="font-bold text-white tracking-wide uppercase text-sm">
                      {currentGesture.label}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Control Bar */}
            {isActive && (
                <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-mono text-slate-400">REC: {new Date().toLocaleTimeString()}</span>
                    </div>
                    <button 
                        onClick={toggleCamera}
                        className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider"
                    >
                        Stop Recording
                    </button>
                </div>
            )}
          </div>

          <aside className="lg:col-span-4 flex flex-col space-y-4">
            <GestureDisplay currentGesture={currentGesture} />
            
            <div className="grid grid-cols-1 gap-4">
               <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 flex items-center space-x-4">
                  <div className="bg-indigo-900/50 p-3 rounded-lg">
                    <BrainCircuit className="text-indigo-400" size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-400">System Status</h3>
                    <p className="text-white font-medium">{isActive ? 'Live Processing' : 'Standby'}</p>
                  </div>
               </div>
            </div>
          </aside>
        </div>

        {/* Real-time Activity Graph at the bottom */}
        <div className="w-full">
          <LogsPanel logs={logs} />
        </div>
      </main>
    </div>
  );
}
