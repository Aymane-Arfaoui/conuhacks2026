"use client";

import React from 'react';
import { GestureDetection, GestureType } from '../types';
import { Hand, Circle, ThumbsUp, Pointer, User, ArrowUp, AlertTriangle } from 'lucide-react';

interface GestureDisplayProps {
  currentGesture: GestureDetection | null;
}

const GestureDisplay: React.FC<GestureDisplayProps> = ({ currentGesture }) => {
  const getIcon = () => {
    if (!currentGesture || currentGesture.type === GestureType.NONE) {
      return <Circle className="animate-pulse text-zinc-600" size={32} />;
    }
    
    switch (currentGesture.type) {
      case GestureType.OPEN_PALM: return <Hand size={32} />;
      case GestureType.FIST: return <div className="w-8 h-8 rounded-lg bg-current" />;
      case GestureType.THUMBS_UP: return <ThumbsUp size={32} />;
      case GestureType.POINTING: return <Pointer size={32} />;
      case GestureType.PEACE: return <div className="text-2xl">✌️</div>;
      case GestureType.TOUCHING_HEAD: return <User size={32} />;
      case GestureType.ARMS_UP: return <ArrowUp size={32} />;
      case GestureType.DISTRESS: return <AlertTriangle size={32} />;
      default: return <Hand size={32} />;
    }
  };

  const getColor = () => {
    if (!currentGesture) return 'bg-zinc-700';
    switch (currentGesture.type) {
      case GestureType.NONE: return 'bg-zinc-700';
      case GestureType.OPEN_PALM: return 'bg-emerald-600';
      case GestureType.FIST: return 'bg-red-600';
      case GestureType.THUMBS_UP: return 'bg-amber-500';
      case GestureType.POINTING: return 'bg-blue-600';
      case GestureType.PEACE: return 'bg-purple-600';
      case GestureType.TOUCHING_HEAD: return 'bg-orange-500';
      case GestureType.ARMS_UP: return 'bg-rose-500';
      case GestureType.DISTRESS: return 'bg-red-600 animate-pulse';
      default: return 'bg-zinc-700';
    }
  };

  const isDetected = currentGesture && currentGesture.type !== GestureType.NONE;
  const isDistress = currentGesture && (
    currentGesture.type === GestureType.DISTRESS ||
    currentGesture.type === GestureType.TOUCHING_HEAD ||
    currentGesture.type === GestureType.ARMS_UP
  );

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isDistress 
        ? 'bg-red-900/20 border-red-500/50 shadow-lg shadow-red-500/10' 
        : 'bg-zinc-800/40 border-zinc-700/50'
    }`}>
      <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Current Gesture</h2>
      
      <div className="flex items-center space-x-4">
        <div className={`p-4 rounded-xl transition-all ${getColor()} ${
          isDetected ? 'text-white scale-100' : 'text-zinc-500 scale-90'
        }`}>
          {getIcon()}
        </div>
        
        <div className="flex-1">
          <p className={`text-lg font-bold uppercase tracking-tight transition-colors ${
            isDistress ? 'text-red-400' : isDetected ? 'text-white' : 'text-zinc-600'
          }`}>
            {isDetected ? currentGesture.label : 'Scanning...'}
          </p>
          {isDetected && (
            <div className="mt-1 flex items-center space-x-2">
              <div className="w-20 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${isDistress ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${currentGesture.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono text-zinc-400">{(currentGesture.confidence * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GestureDisplay;

