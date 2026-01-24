
import React from 'react';
import { Hand } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="max-w-7xl mx-auto w-full flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
          <Hand className="text-white" size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white leading-tight">
            Gesture<span className="text-indigo-500">Flow</span> AI
          </h1>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
            Real-time Motion Intelligence
          </p>
        </div>
      </div>
      <div className="hidden md:flex items-center space-x-6">
        <div className="flex flex-col items-end">
          <span className="text-xs font-semibold text-slate-500 uppercase">Version</span>
          <span className="text-sm font-mono text-indigo-400">v2.5.0-edge</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
