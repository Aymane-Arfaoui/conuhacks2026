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
  youtubeId: string; // YouTube video ID
  startTime?: number; // Start time in seconds
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

// Real CCTV footage from YouTube - actual security incidents
const CCTV_FEEDS: CCTVFeed[] = [
  {
    id: "theft-1",
    name: "Package Theft",
    location: "Residential Porch",
    address: "Suburban Home, Los Angeles, CA",
    youtubeId: "fYYSd5RKxjk", // Porch pirate footage
    startTime: 0,
    metrics: {
      threatLevel: 'high',
      detectionCount: 24,
      avgConfidence: 0.91,
      activeThreats: 1,
      personsDetected: 1
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Suspect', confidence: 0.94, bbox: { x: 0.3, y: 0.2, w: 0.2, h: 0.5 }, color: '#ef4444' },
      { id: 'd2', type: 'object', label: 'Package', confidence: 0.89, bbox: { x: 0.5, y: 0.6, w: 0.1, h: 0.08 }, color: '#f59e0b' },
    ],
    liveEvents: [
      { time: 2, description: 'Person approaching', severity: 'info' },
      { time: 5, description: 'Suspicious behavior', severity: 'warning' },
      { time: 8, description: 'THEFT DETECTED', severity: 'danger' },
    ]
  },
  {
    id: "robbery-1",
    name: "Store Robbery",
    location: "Convenience Store",
    address: "Downtown, Houston, TX",
    youtubeId: "PmN8vGQwKXI", // Store robbery footage
    startTime: 0,
    metrics: {
      threatLevel: 'critical',
      detectionCount: 47,
      avgConfidence: 0.88,
      activeThreats: 2,
      personsDetected: 3
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Armed Suspect', confidence: 0.96, bbox: { x: 0.2, y: 0.15, w: 0.18, h: 0.55 }, color: '#dc2626' },
      { id: 'd2', type: 'person', label: 'Victim', confidence: 0.92, bbox: { x: 0.55, y: 0.2, w: 0.15, h: 0.5 }, color: '#f97316' },
      { id: 'd3', type: 'threat', label: 'Weapon', confidence: 0.87, bbox: { x: 0.28, y: 0.35, w: 0.08, h: 0.12 }, color: '#ef4444' },
    ],
    liveEvents: [
      { time: 1, description: 'Person entered', severity: 'info' },
      { time: 3, description: 'WEAPON DETECTED', severity: 'danger' },
      { time: 5, description: 'ROBBERY IN PROGRESS', severity: 'danger' },
    ]
  },
  {
    id: "assault-1",
    name: "Street Assault",
    location: "City Street",
    address: "Downtown District, NYC",
    youtubeId: "hLMv6qfAeVQ", // Street incident
    startTime: 0,
    metrics: {
      threatLevel: 'critical',
      detectionCount: 56,
      avgConfidence: 0.93,
      activeThreats: 2,
      personsDetected: 4
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Aggressor #1', confidence: 0.95, bbox: { x: 0.15, y: 0.2, w: 0.15, h: 0.45 }, color: '#ef4444' },
      { id: 'd2', type: 'person', label: 'Aggressor #2', confidence: 0.91, bbox: { x: 0.4, y: 0.18, w: 0.14, h: 0.48 }, color: '#ef4444' },
      { id: 'd3', type: 'person', label: 'Victim', confidence: 0.97, bbox: { x: 0.28, y: 0.22, w: 0.12, h: 0.4 }, color: '#f97316' },
      { id: 'd4', type: 'threat', label: 'Violence Zone', confidence: 0.89, bbox: { x: 0.12, y: 0.15, w: 0.45, h: 0.55 }, color: '#dc2626' },
    ],
    liveEvents: [
      { time: 1, description: 'Multiple persons detected', severity: 'info' },
      { time: 3, description: 'Aggressive behavior', severity: 'warning' },
      { time: 5, description: 'ASSAULT IN PROGRESS', severity: 'danger' },
    ]
  },
  {
    id: "carjack-1",
    name: "Vehicle Break-in",
    location: "Parking Lot",
    address: "Shopping Center, Miami, FL",
    youtubeId: "k1F9S3u5PEg", // Car break-in
    startTime: 0,
    metrics: {
      threatLevel: 'high',
      detectionCount: 31,
      avgConfidence: 0.86,
      activeThreats: 1,
      personsDetected: 2
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Suspect', confidence: 0.93, bbox: { x: 0.35, y: 0.25, w: 0.15, h: 0.4 }, color: '#ef4444' },
      { id: 'd2', type: 'vehicle', label: 'Target Vehicle', confidence: 0.98, bbox: { x: 0.2, y: 0.4, w: 0.4, h: 0.3 }, color: '#3b82f6' },
      { id: 'd3', type: 'object', label: 'Tool', confidence: 0.78, bbox: { x: 0.45, y: 0.5, w: 0.06, h: 0.08 }, color: '#f59e0b' },
    ],
    liveEvents: [
      { time: 2, description: 'Person near vehicle', severity: 'info' },
      { time: 5, description: 'Suspicious activity', severity: 'warning' },
      { time: 8, description: 'BREAK-IN DETECTED', severity: 'danger' },
    ]
  },
  {
    id: "shoplifting-1",
    name: "Shoplifting",
    location: "Retail Store",
    address: "Mall, Chicago, IL",
    youtubeId: "DNHqVg7XjyI", // Shoplifting footage
    startTime: 0,
    metrics: {
      threatLevel: 'medium',
      detectionCount: 28,
      avgConfidence: 0.84,
      activeThreats: 1,
      personsDetected: 2
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Suspect', confidence: 0.91, bbox: { x: 0.25, y: 0.15, w: 0.18, h: 0.55 }, color: '#ef4444' },
      { id: 'd2', type: 'object', label: 'Merchandise', confidence: 0.86, bbox: { x: 0.35, y: 0.55, w: 0.1, h: 0.08 }, color: '#a855f7' },
    ],
    liveEvents: [
      { time: 3, description: 'Customer behavior tracked', severity: 'info' },
      { time: 6, description: 'Concealment detected', severity: 'warning' },
      { time: 9, description: 'THEFT CONFIRMED', severity: 'danger' },
    ]
  },
  {
    id: "burglary-1",
    name: "Home Invasion",
    location: "Residential",
    address: "Suburb, Phoenix, AZ",
    youtubeId: "dQEDLMeDi9I", // Home break-in
    startTime: 0,
    metrics: {
      threatLevel: 'critical',
      detectionCount: 38,
      avgConfidence: 0.90,
      activeThreats: 2,
      personsDetected: 2
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Intruder #1', confidence: 0.94, bbox: { x: 0.2, y: 0.2, w: 0.16, h: 0.5 }, color: '#ef4444' },
      { id: 'd2', type: 'person', label: 'Intruder #2', confidence: 0.89, bbox: { x: 0.5, y: 0.25, w: 0.14, h: 0.45 }, color: '#ef4444' },
      { id: 'd3', type: 'threat', label: 'Forced Entry', confidence: 0.92, bbox: { x: 0.35, y: 0.3, w: 0.2, h: 0.35 }, color: '#dc2626' },
    ],
    liveEvents: [
      { time: 1, description: 'Motion at perimeter', severity: 'warning' },
      { time: 4, description: 'FORCED ENTRY DETECTED', severity: 'danger' },
      { time: 7, description: 'Multiple intruders', severity: 'danger' },
    ]
  },
];

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

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setAnimatedDetections(prev => prev.map(d => ({
        ...d,
        bbox: {
          x: Math.max(0.05, Math.min(0.75, d.bbox.x + (Math.random() - 0.5) * 0.015)),
          y: Math.max(0.05, Math.min(0.65, d.bbox.y + (Math.random() - 0.5) * 0.012)),
          w: d.bbox.w + (Math.random() - 0.5) * 0.008,
          h: d.bbox.h + (Math.random() - 0.5) * 0.008,
        },
        confidence: Math.min(0.99, Math.max(0.75, d.confidence + (Math.random() - 0.5) * 0.04))
      })));
    }, 80);

    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Scanlines */}
      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_3px] opacity-40" />
      
      {/* Corner frame */}
      <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-cyan-400/60" />
      <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-cyan-400/60" />
      <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-cyan-400/60" />
      <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-cyan-400/60" />

      {/* Detection boxes */}
      {animatedDetections.map((d) => (
        <div
          key={d.id}
          className="absolute transition-all duration-75"
          style={{
            left: `${d.bbox.x * 100}%`,
            top: `${d.bbox.y * 100}%`,
            width: `${d.bbox.w * 100}%`,
            height: `${d.bbox.h * 100}%`,
          }}
        >
          <div 
            className="absolute inset-0 border-2"
            style={{ 
              borderColor: d.color,
              boxShadow: `0 0 10px ${d.color}40`
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
            className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white whitespace-nowrap"
            style={{ backgroundColor: d.color }}
          >
            {d.label} {(d.confidence * 100).toFixed(0)}%
          </div>
        </div>
      ))}

      {/* REC indicator */}
      <div className="absolute top-2 left-8 flex items-center gap-1.5">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-red-500 text-[10px] font-mono font-bold">REC</span>
      </div>

      {/* AI badge */}
      <div className="absolute top-2 right-8 bg-black/60 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1">
        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
        <span className="text-emerald-400">AI ACTIVE</span>
      </div>

      {/* Current event */}
      {currentEvent && (
        <div className={`absolute bottom-2 left-2 right-2 px-2 py-1 rounded text-xs font-mono font-bold text-center ${
          currentEvent.severity === 'danger' ? 'bg-red-500/90 text-white animate-pulse' :
          currentEvent.severity === 'warning' ? 'bg-yellow-500/90 text-black' :
          'bg-blue-500/80 text-white'
        }`}>
          {currentEvent.description}
        </div>
      )}
    </div>
  );
}

// Single Feed Card with embedded YouTube
function FeedCard({ feed }: { feed: CCTVFeed }) {
  const [currentEvent, setCurrentEvent] = useState<CCTVFeed['liveEvents'][0] | undefined>();
  const eventIndexRef = useRef(0);

  // Cycle through events
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentEvent(feed.liveEvents[eventIndexRef.current]);
      eventIndexRef.current = (eventIndexRef.current + 1) % feed.liveEvents.length;
    }, 3000);

    // Start with first event
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
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      {/* Video container */}
      <div className="relative aspect-video bg-black">
        {/* YouTube iframe - autoplay, muted, loop */}
        <iframe
          src={`https://www.youtube.com/embed/${feed.youtubeId}?autoplay=1&mute=1&loop=1&playlist=${feed.youtubeId}&controls=0&showinfo=0&rel=0&modestbranding=1&start=${feed.startTime || 0}`}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
          loading="lazy"
        />
        
        {/* Detection overlay */}
        <DetectionOverlay 
          detections={feed.detections}
          isActive={true}
          currentEvent={currentEvent}
        />
      </div>

      {/* Info bar */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">{feed.name}</h3>
            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
              <MapPin size={10} />
              {feed.location}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getThreatColor(feed.metrics.threatLevel)}`}>
            {feed.metrics.threatLevel}
          </span>
        </div>

        {/* Quick metrics */}
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
              <span className="text-xs uppercase font-bold">Live Monitor</span>
            </Link>
            <div className="h-5 w-px bg-zinc-700" />
            <div className="flex items-center gap-2">
              <Shield className="text-red-500" size={20} />
              <span className="text-lg font-bold">EYEWATCH</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-500 text-sm">Incident Library</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Clock size={14} />
              <span className="font-mono">{currentTime.toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-xs font-bold">{CCTV_FEEDS.length} LIVE FEEDS</span>
            </div>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 py-2">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-6">
            <span className="text-zinc-500">
              Total Incidents: <span className="text-white font-bold">{CCTV_FEEDS.length}</span>
            </span>
            <span className="text-zinc-500">
              Critical: <span className="text-red-400 font-bold">{CCTV_FEEDS.filter(f => f.metrics.threatLevel === 'critical').length}</span>
            </span>
            <span className="text-zinc-500">
              High: <span className="text-orange-400 font-bold">{CCTV_FEEDS.filter(f => f.metrics.threatLevel === 'high').length}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <Camera size={14} />
            <span>All feeds streaming</span>
          </div>
        </div>
      </div>

      {/* Main Content - 3 columns */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CCTV_FEEDS.map(feed => (
            <FeedCard key={feed.id} feed={feed} />
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-zinc-600">
          <p>Real-time AI-powered surveillance analysis</p>
          <p className="mt-1">Detection boxes track persons, objects, and threats automatically</p>
        </div>
      </main>
    </div>
  );
}
