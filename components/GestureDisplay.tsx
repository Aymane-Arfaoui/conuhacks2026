
import React from 'react';
import { GestureDetection, GestureType } from '../types';
import { Hand, CircleDashed, ThumbsUp, User, ArrowUp } from 'lucide-react';

interface GestureDisplayProps {
  currentGesture: GestureDetection | null;
}

const GestureDisplay: React.FC<GestureDisplayProps> = ({ currentGesture }) => {
  const getIcon = () => {
    if (!currentGesture || currentGesture.type === GestureType.NONE) return <CircleDashed className="animate-spin text-slate-600" size={48} />;
    
    switch (currentGesture.type) {
      case GestureType.OPEN_PALM: return <Hand size={48} />;
      case GestureType.FIST: return <div className="w-12 h-12 rounded-lg bg-slate-400" />;
      case GestureType.THUMBS_UP: return <ThumbsUp size={48} />;
      case GestureType.TOUCHING_HEAD: return <User size={48} />;
      case GestureType.ARMS_UP: return <ArrowUp size={48} />;
      default: return <Hand size={48} />;
    }
  };

  const isDetected = currentGesture && currentGesture.type !== GestureType.NONE;

  return (
    <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 shadow-inner">
      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6">Current Detection</h2>
      
      <div className="flex flex-col items-center justify-center space-y-4 py-8">
        <div className={`p-8 rounded-full transition-all duration-300 ${
          isDetected ? 'bg-indigo-600 text-white scale-110 shadow-xl shadow-indigo-600/20' : 'bg-slate-700/30 text-slate-600'
        }`}>
          {getIcon()}
        </div>
        
        <div className="text-center">
          <p className={`text-2xl font-black uppercase tracking-tight transition-colors ${
            isDetected ? 'text-white' : 'text-slate-600'
          }`}>
            {isDetected ? currentGesture.label : 'Scanning...'}
          </p>
          {isDetected && (
             <div className="mt-2 flex items-center justify-center space-x-2">
                <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-300" 
                    style={{ width: `${currentGesture.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-indigo-400">{(currentGesture.confidence * 100).toFixed(0)}%</span>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GestureDisplay;
