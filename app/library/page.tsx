"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, AlertTriangle, MapPin, Camera, 
  Shield, Eye, Activity, Users, Clock, Play, Pause
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
  description: string;
  location: string;
  address: string;
  videoUrl: string;
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

// Real CCTV feeds with your videos
const CCTV_FEEDS: CCTVFeed[] = [
  {
    id: "cam-1",
    name: "4 Suspects",
    description: "Multiple suspects detected in coordinated activity",
    location: "Parking Structure",
    address: "Downtown Montreal, QC",
    videoUrl: "/videos/4suspects.mp4",
    metrics: {
      threatLevel: 'critical',
      detectionCount: 47,
      avgConfidence: 0.91,
      activeThreats: 4,
      personsDetected: 4
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Suspect #1', confidence: 0.94, bbox: { x: 0.1, y: 0.2, w: 0.12, h: 0.45 }, color: '#ef4444' },
      { id: 'd2', type: 'person', label: 'Suspect #2', confidence: 0.91, bbox: { x: 0.3, y: 0.25, w: 0.1, h: 0.4 }, color: '#ef4444' },
      { id: 'd3', type: 'person', label: 'Suspect #3', confidence: 0.89, bbox: { x: 0.5, y: 0.22, w: 0.11, h: 0.42 }, color: '#ef4444' },
      { id: 'd4', type: 'person', label: 'Suspect #4', confidence: 0.87, bbox: { x: 0.7, y: 0.28, w: 0.1, h: 0.38 }, color: '#ef4444' },
    ],
    liveEvents: [
      { time: 1, description: 'Multiple persons detected', severity: 'warning' },
      { time: 3, description: 'Coordinated movement pattern', severity: 'warning' },
      { time: 5, description: 'SUSPICIOUS GROUP ACTIVITY', severity: 'danger' },
    ]
  },
  {
    id: "cam-2",
    name: "Car Robbery",
    description: "Vehicle break-in captured on CCTV",
    location: "Street Parking",
    address: "Rue Saint-Denis, Montreal",
    videoUrl: "/videos/cctv1carrobbery.mp4",
    metrics: {
      threatLevel: 'critical',
      detectionCount: 38,
      avgConfidence: 0.89,
      activeThreats: 2,
      personsDetected: 2
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Thief', confidence: 0.96, bbox: { x: 0.25, y: 0.2, w: 0.14, h: 0.5 }, color: '#dc2626' },
      { id: 'd2', type: 'vehicle', label: 'Target Vehicle', confidence: 0.98, bbox: { x: 0.4, y: 0.35, w: 0.35, h: 0.3 }, color: '#3b82f6' },
      { id: 'd3', type: 'threat', label: 'Break-in Tool', confidence: 0.82, bbox: { x: 0.32, y: 0.45, w: 0.06, h: 0.08 }, color: '#f97316' },
    ],
    liveEvents: [
      { time: 1, description: 'Person approaching vehicle', severity: 'info' },
      { time: 3, description: 'UNAUTHORIZED ACCESS ATTEMPT', severity: 'danger' },
      { time: 5, description: 'VEHICLE BREAK-IN IN PROGRESS', severity: 'danger' },
    ]
  },
  {
    id: "cam-3",
    name: "Garage CCTV 2",
    description: "Underground parking surveillance footage",
    location: "Parking Garage B2",
    address: "Place Ville Marie, Montreal",
    videoUrl: "/videos/cctv2garage.mp4",
    metrics: {
      threatLevel: 'high',
      detectionCount: 32,
      avgConfidence: 0.88,
      activeThreats: 1,
      personsDetected: 2
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Suspect', confidence: 0.93, bbox: { x: 0.2, y: 0.15, w: 0.12, h: 0.5 }, color: '#ef4444' },
      { id: 'd2', type: 'vehicle', label: 'Parked Car', confidence: 0.95, bbox: { x: 0.5, y: 0.4, w: 0.3, h: 0.25 }, color: '#22c55e' },
    ],
    liveEvents: [
      { time: 2, description: 'Motion in parking zone', severity: 'info' },
      { time: 4, description: 'Loitering behavior detected', severity: 'warning' },
      { time: 6, description: 'SUSPICIOUS ACTIVITY', severity: 'danger' },
    ]
  },
  {
    id: "cam-4",
    name: "Garage Surveillance",
    description: "Main garage camera footage",
    location: "Underground Parking",
    address: "Metro Center, Montreal",
    videoUrl: "/videos/cctvgarage.MP4",
    metrics: {
      threatLevel: 'high',
      detectionCount: 28,
      avgConfidence: 0.86,
      activeThreats: 1,
      personsDetected: 1
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Unknown Person', confidence: 0.91, bbox: { x: 0.35, y: 0.2, w: 0.13, h: 0.48 }, color: '#f97316' },
      { id: 'd2', type: 'vehicle', label: 'Vehicle', confidence: 0.97, bbox: { x: 0.1, y: 0.45, w: 0.25, h: 0.2 }, color: '#3b82f6' },
    ],
    liveEvents: [
      { time: 1, description: 'Person detected in garage', severity: 'info' },
      { time: 3, description: 'Unusual movement pattern', severity: 'warning' },
      { time: 5, description: 'POTENTIAL THREAT DETECTED', severity: 'danger' },
    ]
  },
  {
    id: "cam-5",
    name: "Garage Entrance - Two Robbers",
    description: "Two suspects entering through garage entrance",
    location: "Building Entrance",
    address: "Residential Complex, Laval",
    videoUrl: "/videos/garageentrancetworobbers.mp4",
    metrics: {
      threatLevel: 'critical',
      detectionCount: 41,
      avgConfidence: 0.92,
      activeThreats: 2,
      personsDetected: 2
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Intruder #1', confidence: 0.94, bbox: { x: 0.2, y: 0.18, w: 0.14, h: 0.52 }, color: '#ef4444' },
      { id: 'd2', type: 'person', label: 'Intruder #2', confidence: 0.91, bbox: { x: 0.45, y: 0.2, w: 0.13, h: 0.48 }, color: '#ef4444' },
      { id: 'd3', type: 'threat', label: 'Forced Entry', confidence: 0.88, bbox: { x: 0.6, y: 0.4, w: 0.15, h: 0.2 }, color: '#dc2626' },
    ],
    liveEvents: [
      { time: 1, description: 'Multiple persons at entrance', severity: 'warning' },
      { time: 3, description: 'UNAUTHORIZED ENTRY ATTEMPT', severity: 'danger' },
      { time: 5, description: 'BREAK-IN IN PROGRESS', severity: 'danger' },
    ]
  },
  {
    id: "cam-6",
    name: "Robber Going Up Staircase",
    description: "Suspect fleeing up stairwell",
    location: "Stairwell Camera",
    address: "Commercial Building, Montreal",
    videoUrl: "/videos/robbergoingupstaircase.mp4",
    metrics: {
      threatLevel: 'high',
      detectionCount: 24,
      avgConfidence: 0.90,
      activeThreats: 1,
      personsDetected: 1
    },
    detections: [
      { id: 'd1', type: 'person', label: 'Fleeing Suspect', confidence: 0.95, bbox: { x: 0.3, y: 0.15, w: 0.15, h: 0.55 }, color: '#ef4444' },
      { id: 'd2', type: 'object', label: 'Stolen Bag', confidence: 0.84, bbox: { x: 0.38, y: 0.4, w: 0.08, h: 0.12 }, color: '#a855f7' },
    ],
    liveEvents: [
      { time: 1, description: 'Motion in stairwell', severity: 'info' },
      { time: 3, description: 'Person running detected', severity: 'warning' },
      { time: 5, description: 'SUSPECT FLEEING SCENE', severity: 'danger' },
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
  const [scanlinePos, setScanlinePos] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setAnimatedDetections(prev => prev.map(d => ({
        ...d,
        bbox: {
          x: Math.max(0.05, Math.min(0.75, d.bbox.x + (Math.random() - 0.5) * 0.008)),
          y: Math.max(0.05, Math.min(0.55, d.bbox.y + (Math.random() - 0.5) * 0.006)),
          w: d.bbox.w + (Math.random() - 0.5) * 0.004,
          h: d.bbox.h + (Math.random() - 0.5) * 0.004,
        },
        confidence: Math.min(0.99, Math.max(0.78, d.confidence + (Math.random() - 0.5) * 0.02))
      })));
    }, 120);

    const scanInterval = setInterval(() => {
      setScanlinePos(p => (p + 1.5) % 100);
    }, 40);

    return () => {
      clearInterval(interval);
      clearInterval(scanInterval);
    };
  }, [isActive]);

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Scanlines effect */}
      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-30" />
      
      {/* Moving scan line */}
      <div 
        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent"
        style={{ top: `${scanlinePos}%` }}
      />
      
      {/* Corner frame */}
      <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-cyan-500/70" />
      <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-cyan-500/70" />
      <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-cyan-500/70" />
      <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-cyan-500/70" />

      {/* Detection boxes */}
      {animatedDetections.map((d) => (
        <div
          key={d.id}
          className="absolute transition-all duration-150"
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
              boxShadow: `0 0 12px ${d.color}60, inset 0 0 12px ${d.color}15`
            }}
          >
            {/* Corners */}
            <div className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: d.color }} />
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: d.color }} />
            <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: d.color }} />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: d.color }} />
          </div>
          
          {/* Label */}
          <div 
            className="absolute -top-6 left-0 px-2 py-0.5 text-[10px] font-mono font-bold text-white whitespace-nowrap rounded-sm"
            style={{ backgroundColor: d.color }}
          >
            {d.label} {(d.confidence * 100).toFixed(0)}%
          </div>
        </div>
      ))}

      {/* REC indicator */}
      <div className="absolute top-2 left-9 flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        <span className="text-red-500 text-[11px] font-mono font-bold tracking-wider">REC</span>
      </div>

      {/* AI ANALYSIS badge */}
      <div className="absolute top-2 right-9 bg-black/70 px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1.5">
        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        <span className="text-emerald-400 font-bold">AI ACTIVE</span>
      </div>

      {/* Current event alert */}
      {currentEvent && (
        <div className={`absolute bottom-2 left-2 right-2 px-3 py-2 rounded text-[11px] font-mono font-bold text-center ${
          currentEvent.severity === 'danger' ? 'bg-red-600/95 text-white animate-pulse' :
          currentEvent.severity === 'warning' ? 'bg-amber-500/95 text-black' :
          'bg-blue-600/90 text-white'
        }`}>
          {currentEvent.description}
        </div>
      )}
    </div>
  );
}

// Single Feed Card with Real Video
function FeedCard({ feed }: { feed: CCTVFeed }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentEvent, setCurrentEvent] = useState<CCTVFeed['liveEvents'][0] | undefined>();
  const eventIndexRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentEvent(feed.liveEvents[eventIndexRef.current]);
      eventIndexRef.current = (eventIndexRef.current + 1) % feed.liveEvents.length;
    }, 3000);

    setCurrentEvent(feed.liveEvents[0]);

    return () => clearInterval(interval);
  }, [feed.liveEvents]);

  // Auto-play video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    e.preventDefault();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      default: return 'bg-green-500 text-white';
    }
  };

  return (
    <Link href={`/library/${feed.id}`} className="block">
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all group cursor-pointer">
        {/* Video feed */}
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            src={feed.videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            loop
            muted
            playsInline
            autoPlay
          />
          
          {/* Detection overlay on top of video */}
          <DetectionOverlay 
            detections={feed.detections}
            isActive={isPlaying}
            currentEvent={currentEvent}
          />

          {/* Play/Pause button */}
          <button
            onClick={togglePlay}
            className="absolute bottom-14 right-3 z-20 p-2 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          {/* Analyze overlay on hover */}
          <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-black/80 px-4 py-2 rounded-lg flex items-center gap-2">
              <Eye size={16} className="text-cyan-400" />
              <span className="text-cyan-400 text-sm font-bold uppercase">Analyze Video</span>
            </div>
          </div>
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

        <p className="text-[10px] text-zinc-400 line-clamp-1">{feed.description}</p>
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
    </Link>
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
              <Shield className="text-cyan-500" size={20} />
              <span className="text-lg font-bold">MY HERO</span>
              <span className="text-zinc-600 text-sm">Community Library</span>
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
            <span>AI Analysis Active</span>
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
          <p>Community-submitted CCTV footage with real-time AI analysis</p>
          <p className="mt-1">Detection boxes track identified threats and persons of interest</p>
        </div>
      </main>
    </div>
  );
}
