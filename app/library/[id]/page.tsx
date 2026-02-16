"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import VideoCanvas, { VideoCanvasHandle } from "@/components/VideoCanvas";
import LogsPanel from "@/components/LogsPanel";
import GestureDisplay from "@/components/GestureDisplay";
import Navbar from "@/components/Navbar";
import {
  GestureDetection,
  LogEntry,
  AIEvent,
  EmergencySettings,
  DEFAULT_EMERGENCY_SETTINGS,
  GESTURE_INFO
} from "@/types";
import { Shield, Lock, Volume2, AlertTriangle, X, AlertCircle, Pause, Play } from "lucide-react";

// CCTV Feed data (same as library page)
interface CCTVFeed {
  id: string;
  name: string;
  description: string;
  location: string;
  address: string;
  videoUrl: string;
}

const CCTV_FEEDS: CCTVFeed[] = [
  {
    id: "cam-1",
    name: "4 Suspects",
    description: "Multiple suspects detected in coordinated activity",
    location: "Parking Structure",
    address: "Downtown Montreal, QC",
    videoUrl: "/videos/4suspects.mp4",
  },
  {
    id: "cam-2",
    name: "Car Robbery",
    description: "Vehicle break-in captured on CCTV",
    location: "Street Parking",
    address: "Rue Saint-Denis, Montreal",
    videoUrl: "/videos/cctv1carrobbery.mp4",
  },
  {
    id: "cam-3",
    name: "Garage CCTV 2",
    description: "Underground parking surveillance footage",
    location: "Parking Garage B2",
    address: "Place Ville Marie, Montreal",
    videoUrl: "/videos/cctv2garage.mp4",
  },
  {
    id: "cam-4",
    name: "Garage Surveillance",
    description: "Main garage camera footage",
    location: "Underground Parking",
    address: "Metro Center, Montreal",
    videoUrl: "/videos/cctvgarage.MP4",
  },
  {
    id: "cam-5",
    name: "Garage Entrance - Two Robbers",
    description: "Two suspects entering through garage entrance",
    location: "Building Entrance",
    address: "Residential Complex, Laval",
    videoUrl: "/videos/garageentrancetworobbers.mp4",
  },
  {
    id: "cam-6",
    name: "Robber Going Up Staircase",
    description: "Suspect fleeing up stairwell",
    location: "Stairwell Camera",
    address: "Commercial Building, Montreal",
    videoUrl: "/videos/robbergoingupstaircase.mp4",
  },
];

type Status = "offline" | "loading" | "ready" | "running";

export default function LibraryVideoPage() {
  const params = useParams();
  const feedId = params.id as string;
  
  const feed = CCTV_FEEDS.find(f => f.id === feedId);
  
  const videoCanvasRef = useRef<VideoCanvasHandle>(null);
  const hasAutoStarted = useRef(false);
  
  const [status, setStatus] = useState<Status>("offline");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);
  const [alertEvent, setAlertEvent] = useState<AIEvent | null>(null);
  const [currentGesture, setCurrentGesture] = useState<GestureDetection | null>(null);
  const [emergencyTriggered, setEmergencyTriggered] = useState(false);
  const [emergencyAction, setEmergencyAction] = useState<string | null>(null);
  const [emergencySettings, setEmergencySettings] = useState<EmergencySettings>(DEFAULT_EMERGENCY_SETTINGS);
  const [currentTime, setCurrentTime] = useState("");
  const [gestureHoldProgress, setGestureHoldProgress] = useState(0);

  // Load emergency settings
  useEffect(() => {
    const stored = localStorage.getItem("eyewatch-emergency-settings");
    if (stored) {
      try {
        setEmergencySettings(JSON.parse(stored));
      } catch {
        setEmergencySettings(DEFAULT_EMERGENCY_SETTINGS);
      }
    }
  }, []);

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Dismiss alert
  useEffect(() => {
    if (alertEvent && !emergencyTriggered) {
      const timer = setTimeout(() => setAlertEvent(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alertEvent, emergencyTriggered]);

  // Auto-start analysis when ready
  useEffect(() => {
    if (status === "ready" && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      // Small delay to ensure everything is initialized
      setTimeout(() => {
        videoCanvasRef.current?.toggle();
      }, 300);
    }
  }, [status]);

  // Handlers
  const handleLogEntry = useCallback((log: LogEntry) => {
    setLogs(prev => [log, ...prev].slice(0, 150));
  }, []);

  const handleAIEvent = useCallback((event: AIEvent) => {
    setAiEvents(prev => [event, ...prev].slice(0, 50));
  }, []);

  const handleEmergencyTriggered = useCallback(() => {
    setEmergencyTriggered(true);
    setEmergencyAction("ALARM ACTIVE");
  }, []);

  const handleEmergencyCanceled = useCallback(() => {
    setEmergencyTriggered(false);
    setEmergencyAction(null);
  }, []);

  const toggle = useCallback(() => {
    videoCanvasRef.current?.toggle();
  }, []);

  const cancelEmergency = useCallback(() => {
    videoCanvasRef.current?.cancelEmergency();
  }, []);

  const isEmergencyGesture = emergencySettings.enabled && currentGesture && currentGesture.type === emergencySettings.emergencyGesture && currentGesture.confidence > 0.5;

  if (!feed) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white font-mono flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Video Not Found</h1>
          <p className="text-zinc-400 mb-6">The requested CCTV feed could not be found.</p>
          <Link 
            href="/library"
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded text-black font-bold"
          >
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-mono">
      {/* Emergency Snackbar */}
      {emergencyTriggered && (
        <div className="fixed top-4 right-4 z-[100] bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-md flex items-center gap-3 animate-pulse">
          <AlertTriangle className="flex-shrink-0 animate-bounce" size={20} />
          <div className="flex-1">
            <p className="font-bold text-sm">EMERGENCY ACTIVE</p>
            <div className="flex items-center gap-2 mt-1 text-xs">
              {emergencyAction?.includes("DOORS") && (
                <span className="flex items-center gap-1"><Lock size={12} /> Doors Locked</span>
              )}
              {emergencyAction?.includes("ALARM") && (
                <span className="flex items-center gap-1"><Volume2 size={12} /> Alarm Active</span>
              )}
            </div>
          </div>
          <button 
            onClick={cancelEmergency} 
            className="text-white/60 hover:text-white flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Alert Snackbar */}
      {alertEvent && !emergencyTriggered && (
        <div className="fixed top-4 right-4 z-[100] bg-amber-500 text-black px-4 py-3 rounded-lg shadow-lg max-w-sm flex items-center gap-3 animate-slide-up">
          <AlertCircle size={20} className="flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">{alertEvent.label}</p>
          </div>
          <button onClick={() => setAlertEvent(null)} className="text-black/60 hover:text-black">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Navbar */}
      <Navbar showSettings backLink="/library" backLabel="Library" />

      {/* Video Info Bar */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 py-2">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-6">
            <span className="text-white font-bold">{feed.name}</span>
            <span className="text-zinc-500">{feed.location}</span>
            <span className="text-zinc-600">{feed.address}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-zinc-500">{feed.description}</div>
            <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/20 rounded border border-cyan-500/30">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
              <span className="text-cyan-400 text-xs font-bold">ANALYSIS MODE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Video + Timeline */}
          <div className="lg:col-span-9 space-y-4">
            <VideoCanvas
              ref={videoCanvasRef}
              videoUrl={feed.videoUrl}
              onStatusChange={setStatus}
              onGestureDetected={setCurrentGesture}
              onLogEntry={handleLogEntry}
              onAIEvent={handleAIEvent}
              onAlertEvent={setAlertEvent}
              emergencySettings={emergencySettings}
              onEmergencyTriggered={handleEmergencyTriggered}
              onEmergencyCanceled={handleEmergencyCanceled}
            />

            {/* Controls */}
            <div className="flex items-center gap-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <button 
                onClick={toggle} 
                disabled={status === "loading" || status === "offline"}
                className={`px-6 py-2.5 rounded font-bold text-sm uppercase transition-all flex items-center gap-2 ${
                  status === "running" ? "bg-red-500 hover:bg-red-600 text-white" : 
                  status === "ready" ? "bg-emerald-500 hover:bg-emerald-600 text-black" :
                  "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                }`}
              >
                {status === "running" ? (
                  <><Pause size={16} /> Pause</>
                ) : status === "loading" ? (
                  "Loading..."
                ) : (
                  <><Play size={16} /> Resume</>
                )}
              </button>
              
              {/* Emergency gesture progress bar */}
              {isEmergencyGesture && !emergencyTriggered && (
                <div className="flex items-center gap-3 flex-1 max-w-xs">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-amber-400">
                        {GESTURE_INFO[emergencySettings.emergencyGesture].icon} HOLD
                      </span>
                      <span className="text-xs font-mono text-amber-400">{Math.round(gestureHoldProgress * 100)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 transition-all duration-100"
                        style={{ width: `${gestureHoldProgress * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Emergency config summary */}
              <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded ${
                emergencySettings.enabled ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800/50 text-zinc-500'
              }`}>
                <Shield size={14} />
                <span>
                  {emergencySettings.enabled 
                    ? <>Emergency: <span className="font-bold">{GESTURE_INFO[emergencySettings.emergencyGesture].label}</span></>
                    : 'Emergency Disabled'
                  }
                </span>
              </div>
              
              <div className="flex-1" />
              <div className="text-xs text-zinc-500 font-mono">{currentTime}</div>
              <Link 
                href="/realtime"
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-bold uppercase transition-colors"
              >
                Live Camera
              </Link>
            </div>

            {/* Activity Timeline */}
            {status === "running" && <LogsPanel logs={logs} />}
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-3 space-y-4">
            <GestureDisplay currentGesture={currentGesture} />
            
            {/* AI Events */}
            <div className="bg-zinc-900/30 rounded-xl border border-zinc-800 flex flex-col" style={{ maxHeight: "400px" }}>
              <div className="px-4 py-3 border-b border-zinc-800">
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Suspicious Behavior Detection</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {aiEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
                    <p className="text-xs uppercase">Analyzing Video...</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/50">
                    {aiEvents.slice(0, 10).map((ev, i) => (
                      <div key={`${ev.timestamp}-${i}`} className={`px-4 py-2 ${
                        ev.type === "EMERGENCY" ? 'bg-red-500/20' :
                        ev.isDangerous ? 'bg-red-500/10' : 'bg-zinc-800/20'
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            ev.type === "EMERGENCY" ? 'bg-red-500 animate-pulse' :
                            ev.isDangerous ? 'bg-red-500' : 'bg-emerald-500'
                          }`} />
                          <span className="text-[10px] text-zinc-600">{ev.time}</span>
                        </div>
                        <p className={`text-xs mt-1 ${ev.type === "EMERGENCY" ? 'text-red-400 font-bold' : 'text-zinc-300'}`}>
                          {ev.label}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
