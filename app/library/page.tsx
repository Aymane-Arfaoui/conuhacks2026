"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, AlertTriangle, MapPin, Camera, 
  Shield, Eye, Activity, Users, Clock
} from 'lucide-react';

// Types
interface Detection {
  id: string;
  type: 'person' | 'vehicle' | 'threat' | 'object';
  label: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  color: string;
}

interface CCTVFeed {
  id: string;
  name: string;
  location: string;
  address: string;
  bgGradient: string;
  metrics: {
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    detectionCount: number;
    avgConfidence: number;
    activeThreats: number;
    personsDetected: number;
  };
  detections: Detection[];
  liveEvents: { time: number; description: string; severity: 'info' | 'warning' | 'danger' }[];
}

// Simulated CCTV feeds with animated backgrounds
const CCTV_FEEDS: CCTVFeed[] = [
  {
    id: "cam-1",
    name: "Parking Garage B1",
    location: "Underground Parking",
    address: "Metro Center, Level B2, Montreal",
    bgGradient: "from-zinc-900 via-zinc-800 to-zinc-900",
    metrics: {
      threatLevel: 'critical',
      detectionCount: 47,
      avgConfidence: 0.91,
      activeThreats: 2,
      personsDetected: 3
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Suspect #1', confidence: 0.94, bbox: { x: 0.15, y: 0.2, w: 0.12, h: 0.4 }, color: '#ef4444' },
      { id: 'd2', type: 'person', label: 'Suspect #2', confidence: 0.91, bbox: { x: 0.55, y: 0.25, w: 0.1, h: 0.35 }, color: '#ef4444' },
      { id: 'd3', type: 'vehicle', label: 'Target Vehicle', confidence: 0.97, bbox: { x: 0.3, y: 0.45, w: 0.3, h: 0.2 }, color: '#3b82f6' },
    ],
    liveEvents: [
      { time: 2, description: 'Motion detected in restricted area', severity: 'warning' },
      { time: 5, description: 'Multiple persons near vehicle', severity: 'warning' },
      { time: 8, description: 'VEHICLE THEFT IN PROGRESS', severity: 'danger' },
    ]
  },
  {
    id: "cam-2",
    name: "Store Front Cam",
    location: "Convenience Store",
    address: "456 Saint-Catherine St, Montreal",
    bgGradient: "from-amber-950 via-zinc-900 to-zinc-800",
    metrics: {
      threatLevel: 'critical',
      detectionCount: 38,
      avgConfidence: 0.89,
      activeThreats: 1,
      personsDetected: 2
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Armed Suspect', confidence: 0.96, bbox: { x: 0.2, y: 0.15, w: 0.15, h: 0.5 }, color: '#dc2626' },
      { id: 'd2', type: 'person', label: 'Cashier', confidence: 0.92, bbox: { x: 0.6, y: 0.2, w: 0.12, h: 0.45 }, color: '#f97316' },
      { id: 'd3', type: 'threat', label: 'Weapon', confidence: 0.87, bbox: { x: 0.28, y: 0.35, w: 0.06, h: 0.1 }, color: '#ef4444' },
    ],
    liveEvents: [
      { time: 1, description: 'Person entered store', severity: 'info' },
      { time: 3, description: 'WEAPON DETECTED', severity: 'danger' },
      { time: 5, description: 'ARMED ROBBERY IN PROGRESS', severity: 'danger' },
    ]
  },
  {
    id: "cam-3",
    name: "Street Corner",
    location: "Downtown",
    address: "Crescent & Maisonneuve, Montreal",
    bgGradient: "from-zinc-800 via-slate-900 to-zinc-900",
    metrics: {
      threatLevel: 'high',
      detectionCount: 56,
      avgConfidence: 0.88,
      activeThreats: 2,
      personsDetected: 4
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Aggressor', confidence: 0.93, bbox: { x: 0.25, y: 0.2, w: 0.12, h: 0.45 }, color: '#ef4444' },
      { id: 'd2', type: 'person', label: 'Victim', confidence: 0.95, bbox: { x: 0.4, y: 0.22, w: 0.1, h: 0.4 }, color: '#f97316' },
      { id: 'd3', type: 'person', label: 'Witness', confidence: 0.89, bbox: { x: 0.65, y: 0.25, w: 0.08, h: 0.35 }, color: '#22c55e' },
    ],
    liveEvents: [
      { time: 1, description: 'Multiple persons detected', severity: 'info' },
      { time: 4, description: 'Aggressive behavior detected', severity: 'warning' },
      { time: 6, description: 'PHYSICAL ASSAULT', severity: 'danger' },
    ]
  },
  {
    id: "cam-4",
    name: "Mall Entrance",
    location: "Shopping Center",
    address: "Eaton Centre, Montreal",
    bgGradient: "from-slate-900 via-zinc-800 to-slate-900",
    metrics: {
      threatLevel: 'high',
      detectionCount: 32,
      avgConfidence: 0.85,
      activeThreats: 1,
      personsDetected: 2
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Customer', confidence: 0.92, bbox: { x: 0.6, y: 0.15, w: 0.12, h: 0.45 }, color: '#22c55e' },
      { id: 'd2', type: 'person', label: 'Suspect', confidence: 0.89, bbox: { x: 0.2, y: 0.2, w: 0.1, h: 0.4 }, color: '#ef4444' },
      { id: 'd3', type: 'object', label: 'Stolen Item', confidence: 0.82, bbox: { x: 0.25, y: 0.52, w: 0.06, h: 0.05 }, color: '#a855f7' },
    ],
    liveEvents: [
      { time: 3, description: 'Customer entering', severity: 'info' },
      { time: 6, description: 'Concealment behavior', severity: 'warning' },
      { time: 9, description: 'SHOPLIFTING DETECTED', severity: 'danger' },
    ]
  },
  {
    id: "cam-5",
    name: "Residential Entry",
    location: "Apartment Complex",
    address: "789 Sherbrooke St, Montreal",
    bgGradient: "from-zinc-900 via-neutral-900 to-zinc-800",
    metrics: {
      threatLevel: 'critical',
      detectionCount: 28,
      avgConfidence: 0.90,
      activeThreats: 2,
      personsDetected: 2
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Intruder #1', confidence: 0.94, bbox: { x: 0.3, y: 0.2, w: 0.14, h: 0.5 }, color: '#ef4444' },
      { id: 'd2', type: 'person', label: 'Intruder #2', confidence: 0.88, bbox: { x: 0.55, y: 0.25, w: 0.12, h: 0.45 }, color: '#ef4444' },
      { id: 'd3', type: 'threat', label: 'Forced Entry', confidence: 0.91, bbox: { x: 0.4, y: 0.4, w: 0.15, h: 0.2 }, color: '#dc2626' },
    ],
    liveEvents: [
      { time: 1, description: 'Motion at entrance', severity: 'warning' },
      { time: 4, description: 'FORCED ENTRY DETECTED', severity: 'danger' },
      { time: 7, description: 'HOME INVASION', severity: 'danger' },
    ]
  },
  {
    id: "cam-6",
    name: "ATM Camera",
    location: "Bank Branch",
    address: "TD Bank, Peel St, Montreal",
    bgGradient: "from-emerald-950 via-zinc-900 to-zinc-800",
    metrics: {
      threatLevel: 'high',
      detectionCount: 19,
      avgConfidence: 0.93,
      activeThreats: 1,
      personsDetected: 2
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Victim', confidence: 0.95, bbox: { x: 0.35, y: 0.15, w: 0.12, h: 0.5 }, color: '#f97316' },
      { id: 'd2', type: 'person', label: 'Robber', confidence: 0.91, bbox: { x: 0.55, y: 0.2, w: 0.14, h: 0.48 }, color: '#ef4444' },
      { id: 'd3', type: 'object', label: 'ATM', confidence: 0.99, bbox: { x: 0.1, y: 0.3, w: 0.2, h: 0.4 }, color: '#3b82f6' },
    ],
    liveEvents: [
      { time: 2, description: 'Person at ATM', severity: 'info' },
      { time: 5, description: 'Second person approaching', severity: 'warning' },
      { time: 8, description: 'ATM ROBBERY', severity: 'danger' },
    ]
  },
];

// Animated noise/static effect
function NoiseOverlay() {
  return (
    <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
      <div 
        className="w-full h-full"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

// Detection Overlay Component
function DetectionOverlay({ 
  detections, 
  isActive,
  currentEvent 
}: { 
  detections: Detection[];
  isActive: boolean;
  currentEvent?: { description: string; severity: string };
}) {
  const [animatedDetections, setAnimatedDetections] = useState(detections);
  const [scanlinePos, setScanlinePos] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setAnimatedDetections(prev => prev.map(d => ({
        ...d,
        bbox: {
          x: Math.max(0.05, Math.min(0.75, d.bbox.x + (Math.random() - 0.5) * 0.012)),
          y: Math.max(0.05, Math.min(0.55, d.bbox.y + (Math.random() - 0.5) * 0.01)),
          w: d.bbox.w + (Math.random() - 0.5) * 0.006,
          h: d.bbox.h + (Math.random() - 0.5) * 0.006,
        },
        confidence: Math.min(0.99, Math.max(0.78, d.confidence + (Math.random() - 0.5) * 0.03))
      })));
    }, 100);

    const scanInterval = setInterval(() => {
      setScanlinePos(p => (p + 2) % 100);
    }, 50);

    return () => {
      clearInterval(interval);
      clearInterval(scanInterval);
    };
  }, [isActive]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Scanlines */}
      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_3px] opacity-40" />
      
      {/* Moving scan line */}
      <div 
        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
        style={{ top: `${scanlinePos}%` }}
      />
      
      {/* Corner frame */}
      <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-cyan-500/60" />
      <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-cyan-500/60" />
      <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-cyan-500/60" />
      <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-cyan-500/60" />

      {/* Detection boxes */}
      {animatedDetections.map((d) => (
        <div
          key={d.id}
          className="absolute transition-all duration-100"
          style={{
            left: `${d.bbox.x * 100}%`,
            top: `${d.bbox.y * 100}%`,
            width: `${d.bbox.w * 100}%`,
            height: `${d.bbox.h * 100}%`,
          }}
        >
          <div 
            className="absolute inset-0 border-2 animate-pulse"
            style={{ 
              borderColor: d.color,
              boxShadow: `0 0 8px ${d.color}50, inset 0 0 8px ${d.color}20`
            }}
          >
            {/* Corners */}
            <div className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2" style={{ borderColor: d.color }} />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2" style={{ borderColor: d.color }} />
            <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2" style={{ borderColor: d.color }} />
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2" style={{ borderColor: d.color }} />
          </div>
          
          {/* Label */}
          <div 
            className="absolute -top-5 left-0 px-1.5 py-0.5 text-[9px] font-mono font-bold text-white whitespace-nowrap"
            style={{ backgroundColor: d.color }}
          >
            {d.label} {(d.confidence * 100).toFixed(0)}%
          </div>
        </div>
      ))}

      {/* REC indicator */}
      <div className="absolute top-2 left-7 flex items-center gap-1.5">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-red-500 text-[10px] font-mono font-bold">REC</span>
      </div>

      {/* AI badge */}
      <div className="absolute top-2 right-7 bg-black/60 px-2 py-0.5 rounded text-[9px] font-mono flex items-center gap-1">
        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
        <span className="text-emerald-400">AI</span>
      </div>

      {/* Current event alert */}
      {currentEvent && (
        <div className={`absolute bottom-2 left-2 right-2 px-2 py-1.5 rounded text-[10px] font-mono font-bold text-center ${
          currentEvent.severity === 'danger' ? 'bg-red-600/90 text-white animate-pulse' :
          currentEvent.severity === 'warning' ? 'bg-amber-500/90 text-black' :
          'bg-blue-600/80 text-white'
        }`}>
          {currentEvent.description}
        </div>
      )}
    </div>
  );
}

// Single Feed Card
function FeedCard({ feed }: { feed: CCTVFeed }) {
  const [currentEvent, setCurrentEvent] = useState<CCTVFeed['liveEvents'][0] | undefined>();
  const eventIndexRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentEvent(feed.liveEvents[eventIndexRef.current]);
      eventIndexRef.current = (eventIndexRef.current + 1) % feed.liveEvents.length;
    }, 2500);

    setCurrentEvent(feed.liveEvents[0]);

    return () => clearInterval(interval);
  }, [feed.liveEvents]);

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      default: return 'bg-green-500 text-white';
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden hover:border-zinc-600 transition-all">
      {/* Simulated video feed */}
      <div className={`relative aspect-video bg-gradient-to-br ${feed.bgGradient}`}>
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-32 h-32 bg-zinc-700/20 rounded-full blur-3xl animate-pulse" 
            style={{ left: '20%', top: '30%' }} />
          <div className="absolute w-24 h-24 bg-zinc-600/15 rounded-full blur-2xl animate-pulse" 
            style={{ left: '60%', top: '50%', animationDelay: '1s' }} />
        </div>
        
        <NoiseOverlay />
        
        <DetectionOverlay 
          detections={feed.detections}
          isActive={true}
          currentEvent={currentEvent}
        />
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">{feed.name}</h3>
            <p className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
              <MapPin size={10} />
              {feed.location}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${getThreatColor(feed.metrics.threatLevel)}`}>
            {feed.metrics.threatLevel}
          </span>
        </div>

        <p className="text-[9px] text-zinc-600 truncate">{feed.address}</p>

        {/* Metrics */}
        <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
          <div className="flex items-center gap-1 text-[10px] text-zinc-400">
            <Eye size={10} className="text-cyan-400" />
            <span>{feed.metrics.detectionCount}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-400">
            <Users size={10} className="text-blue-400" />
            <span>{feed.metrics.personsDetected}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-400">
            <AlertTriangle size={10} className="text-red-400" />
            <span>{feed.metrics.activeThreats}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-400">
            <Activity size={10} className="text-emerald-400" />
            <span>{(feed.metrics.avgConfidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Library Page
export default function LibraryPage() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const criticalCount = CCTV_FEEDS.filter(f => f.metrics.threatLevel === 'critical').length;
  const highCount = CCTV_FEEDS.filter(f => f.metrics.threatLevel === 'high').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-mono">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/realtime"
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-xs uppercase font-bold">Live</span>
            </Link>
            <div className="h-5 w-px bg-zinc-700" />
            <div className="flex items-center gap-2">
              <Shield className="text-red-500" size={20} />
              <span className="text-lg font-bold">EYEWATCH</span>
              <span className="text-zinc-600 text-sm">Incident Library</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Clock size={14} />
              <span className="font-mono">{currentTime.toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded border border-red-500/30">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-xs font-bold">{CCTV_FEEDS.length} FEEDS</span>
            </div>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 py-2">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-6">
            <span className="text-zinc-500">
              Active Incidents: <span className="text-white font-bold">{CCTV_FEEDS.length}</span>
            </span>
            <span className="text-zinc-500">
              Critical: <span className="text-red-400 font-bold">{criticalCount}</span>
            </span>
            <span className="text-zinc-500">
              High: <span className="text-orange-400 font-bold">{highCount}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <Camera size={14} />
            <span>All cameras online</span>
          </div>
        </div>
      </div>

      {/* Main Grid - 3 columns */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CCTV_FEEDS.map(feed => (
            <FeedCard key={feed.id} feed={feed} />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-zinc-600">
          <p>Real-time AI surveillance analysis demonstration</p>
          <p className="mt-1">Detection boxes track simulated threats</p>
        </div>
      </main>
    </div>
  );
}

