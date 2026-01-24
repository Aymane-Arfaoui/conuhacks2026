"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { analyzeFrame, DetectionEvent } from "../actions/detect";

interface Detection {
  cls: string;
  conf: number;
  bbox: [number, number, number, number];
  track_id?: number;
}

interface FaceData {
  track_id: number;
  face?: { x: number; y: number; w: number; h: number };
  eyes: { x: number; y: number; w: number; h: number }[];
  eyes_open: boolean;
  eye_closed_duration: number;
  nose?: { x: number; y: number };
  mouth?: { x: number; y: number; w: number };
  keypoints?: {
    left_shoulder: { x: number; y: number };
    right_shoulder: { x: number; y: number };
    left_elbow: { x: number; y: number };
    right_elbow: { x: number; y: number };
  };
}

interface Event {
  type: string;
  severity: number;
  label: string;
  track_id?: number;
  time?: string;
  timestamp?: number;
  isDangerous?: boolean;
}

interface FrameResponse {
  frameId: number;
  detections: Detection[];
  faces: FaceData[];
  events: Event[];
  aiActive: boolean;
  debug: { fps: number; persons: number };
}

type Status = "offline" | "connecting" | "online";

export default function RealtimePage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [fps, setFps] = useState(10);
  const [status, setStatus] = useState<Status>("offline");
  const [events, setEvents] = useState<Event[]>([]);
  const [debug, setDebug] = useState({ fps: 0, persons: 0 });
  const [alertEvent, setAlertEvent] = useState<Event | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const aiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFrameDataRef = useRef<FrameResponse | null>(null);

  const WS_URL = "ws://127.0.0.1:8000/ws";

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    offscreenRef.current = document.createElement("canvas");
  }, []);

  useEffect(() => {
    if (alertEvent) {
      const timer = setTimeout(() => setAlertEvent(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alertEvent]);

  // AI Analysis using Next.js server action (every 2 seconds)
  const runAIAnalysis = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 640, 480);
    const base64 = canvas.toDataURL("image/jpeg", 0.8);

    setAiAnalyzing(true);
    try {
      const result = await analyzeFrame(base64);
      
      if (result.events && result.events.length > 0) {
        const aiEvents: Event[] = result.events.map((e: DetectionEvent) => ({
          type: e.isDangerous ? "WARNING" : "INFO",
          severity: e.isDangerous ? 3 : 1,
          label: e.description,
          time: e.timestamp,
          timestamp: Date.now(),
          isDangerous: e.isDangerous
        }));

        // Add to event log
        setEvents(prev => [...aiEvents, ...prev].slice(0, 50));

        // Show alert for dangerous events
        const dangerous = aiEvents.find(e => e.isDangerous);
        if (dangerous) {
          setAlertEvent(dangerous);
        }
      }
    } catch (err) {
      console.error("AI analysis error:", err);
    }
    setAiAnalyzing(false);
  }, []);

  const startAIAnalysis = useCallback(() => {
    // Run immediately
    runAIAnalysis();
    // Then every 2 seconds
    aiIntervalRef.current = setInterval(runAIAnalysis, 2000);
  }, [runAIAnalysis]);

  const stopAIAnalysis = useCallback(() => {
    if (aiIntervalRef.current) {
      clearInterval(aiIntervalRef.current);
      aiIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setStatus("connecting");
    
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => setStatus("online");
    ws.onclose = () => setStatus("offline");
    ws.onerror = () => setStatus("offline");

    ws.onmessage = (e) => {
      try {
        const data: FrameResponse = JSON.parse(e.data);
        setDebug(data.debug);
        lastFrameDataRef.current = data;
        draw(data);
      } catch (err) {
        console.error(err);
      }
    };

    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      streamRef.current = stream;
      return true;
    } catch {
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const sendFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = offscreenRef.current;
    const ws = wsRef.current;
    if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN || video.readyState < 2) return;

    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 640, 480);

    canvas.toBlob((blob) => {
      if (blob && ws.readyState === WebSocket.OPEN) {
        blob.arrayBuffer().then((buf) => ws.send(buf));
      }
    }, "image/jpeg", 0.85);
  }, []);

  const startLoop = useCallback(() => {
    const interval = 1000 / fps;
    let last = 0;
    const loop = (time: number) => {
      if (time - last >= interval) {
        sendFrame();
        last = time;
      }
      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
  }, [fps, sendFrame]);

  const stopLoop = useCallback(() => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  const draw = useCallback((data: FrameResponse) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    canvas.width = vw;
    canvas.height = vh;
    ctx.clearRect(0, 0, vw, vh);

    const sx = vw / 640;
    const sy = vh / 480;

    const hasDanger = alertEvent !== null;

    // Draw each detection
    for (const det of data.detections) {
      const [ox, oy, ow, oh] = det.bbox;
      const x = ox * sx;
      const y = oy * sy;
      const w = ow * sx;
      const h = oh * sy;
      
      const faceData = data.faces?.find(f => f.track_id === det.track_id);
      const eyesClosed = faceData && !faceData.eyes_open;
      
      const color = hasDanger ? "#ef4444" : eyesClosed ? "#f59e0b" : "#22c55e";

      // Bounding box with glow
      ctx.shadowColor = color;
      ctx.shadowBlur = hasDanger ? 30 : 15;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;

      // Corner brackets
      const corner = Math.min(w, h) * 0.12;
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y + corner); ctx.lineTo(x, y); ctx.lineTo(x + corner, y);
      ctx.moveTo(x + w - corner, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + corner);
      ctx.moveTo(x, y + h - corner); ctx.lineTo(x, y + h); ctx.lineTo(x + corner, y + h);
      ctx.moveTo(x + w - corner, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - corner);
      ctx.stroke();

      // ID badge
      const conf = Math.round(det.conf * 100);
      ctx.font = "bold 11px monospace";
      const label = `ID:${det.track_id || 0} ${conf}%`;
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = color;
      ctx.fillRect(x, y - 20, tw, 18);
      ctx.fillStyle = "#000";
      ctx.fillText(label, x + 6, y - 6);

      // Face landmarks
      if (faceData) {
        // Face box
        if (faceData.face) {
          const fx = faceData.face.x * sx;
          const fy = faceData.face.y * sy;
          const fw = faceData.face.w * sx;
          const fh = faceData.face.h * sy;
          
          ctx.strokeStyle = "#06b6d4";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(fx, fy, fw, fh);
          ctx.setLineDash([]);
          
          ctx.font = "9px monospace";
          ctx.fillStyle = "#06b6d4";
          ctx.fillText("FACE", fx + 2, fy - 3);
        }

        // Eyes
        for (const eye of faceData.eyes || []) {
          const ex = eye.x * sx;
          const ey = eye.y * sy;
          const ew = eye.w * sx;
          const eh = eye.h * sy;
          
          const eyeColor = faceData.eyes_open ? "#22c55e" : "#ef4444";
          ctx.fillStyle = faceData.eyes_open ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.4)";
          ctx.fillRect(ex, ey, ew, eh);
          ctx.strokeStyle = eyeColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(ex, ey, ew, eh);
          
          // Pupil dot
          ctx.fillStyle = eyeColor;
          ctx.beginPath();
          ctx.arc(ex + ew/2, ey + eh/2, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Eye status
        if (faceData.face) {
          const fx = faceData.face.x * sx;
          const fy = faceData.face.y * sy + faceData.face.h * sy;
          ctx.font = "bold 10px monospace";
          ctx.fillStyle = faceData.eyes_open ? "#22c55e" : "#ef4444";
          ctx.fillText(faceData.eyes_open ? "EYES OPEN" : "EYES CLOSED", fx, fy + 14);
          
          if (faceData.eye_closed_duration > 0.3) {
            ctx.fillStyle = "#ef4444";
            ctx.fillText(`${faceData.eye_closed_duration.toFixed(1)}s`, fx + 80, fy + 14);
          }
        }

        // Nose
        if (faceData.nose) {
          ctx.fillStyle = "#a855f7";
          ctx.beginPath();
          ctx.arc(faceData.nose.x * sx, faceData.nose.y * sy, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Mouth
        if (faceData.mouth) {
          ctx.strokeStyle = "#ec4899";
          ctx.lineWidth = 2;
          const mx = faceData.mouth.x * sx;
          const my = faceData.mouth.y * sy;
          const mw = (faceData.mouth.w || 20) * sx;
          ctx.beginPath();
          ctx.moveTo(mx - mw/2, my);
          ctx.lineTo(mx + mw/2, my);
          ctx.stroke();
        }

        // Shoulders
        if (faceData.keypoints) {
          const kp = faceData.keypoints;
          
          // Shoulder line
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(kp.left_shoulder.x * sx, kp.left_shoulder.y * sy);
          ctx.lineTo(kp.right_shoulder.x * sx, kp.right_shoulder.y * sy);
          ctx.stroke();

          // Shoulder dots
          [kp.left_shoulder, kp.right_shoulder].forEach((pt, i) => {
            ctx.fillStyle = "#3b82f6";
            ctx.beginPath();
            ctx.arc(pt.x * sx, pt.y * sy, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = "8px monospace";
            ctx.fillStyle = "#93c5fd";
            ctx.fillText(i === 0 ? "LS" : "RS", pt.x * sx + 7, pt.y * sy + 3);
          });

          // Arms
          ctx.strokeStyle = "#3b82f680";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(kp.left_shoulder.x * sx, kp.left_shoulder.y * sy);
          ctx.lineTo(kp.left_elbow.x * sx, kp.left_elbow.y * sy);
          ctx.moveTo(kp.right_shoulder.x * sx, kp.right_shoulder.y * sy);
          ctx.lineTo(kp.right_elbow.x * sx, kp.right_elbow.y * sy);
          ctx.stroke();

          // Elbow dots
          [kp.left_elbow, kp.right_elbow].forEach((pt) => {
            ctx.fillStyle = "#3b82f6";
            ctx.beginPath();
            ctx.arc(pt.x * sx, pt.y * sy, 4, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }

      // Scan line
      const scanY = y + (Date.now() % 1200) / 1200 * h;
      ctx.strokeStyle = color + "25";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, scanY);
      ctx.lineTo(x + w, scanY);
      ctx.stroke();
    }

    // Danger border
    if (hasDanger) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 6]);
      ctx.strokeRect(6, 6, vw - 12, vh - 12);
      ctx.setLineDash([]);
    }

    // HUD - Top left
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "#22c55e";
    ctx.fillText("LIVE", 14, 24);
    ctx.font = "10px monospace";
    ctx.fillStyle = "#71717a";
    ctx.fillText(`${vw}x${vh} @ ${data.debug.fps.toFixed(0)} FPS`, 14, 38);

    // HUD - Top right
    ctx.textAlign = "right";
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#fff";
    ctx.fillText(new Date().toLocaleTimeString("en-US", { hour12: false }), vw - 14, 24);
    ctx.font = "10px monospace";
    ctx.fillStyle = "#71717a";
    ctx.fillText(new Date().toLocaleDateString(), vw - 14, 38);
    ctx.textAlign = "left";

    // REC indicator
    if (Date.now() % 1000 < 600) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(vw - 14, 56, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = "9px monospace";
    ctx.fillStyle = "#ef4444";
    ctx.textAlign = "right";
    ctx.fillText("REC", vw - 26, 60);
    ctx.textAlign = "left";

    // AI status
    ctx.font = "9px monospace";
    ctx.fillStyle = aiAnalyzing ? "#06b6d4" : "#71717a";
    ctx.fillText(aiAnalyzing ? "AI ANALYZING..." : "AI READY", 14, vh - 10);

  }, [alertEvent, aiAnalyzing]);

  const toggle = useCallback(async () => {
    if (isStreaming) {
      stopLoop();
      stopCamera();
      disconnect();
      stopAIAnalysis();
      setIsStreaming(false);
      setEvents([]);
      setAlertEvent(null);
    } else {
      const ok = await startCamera();
      if (!ok) {
        alert("Camera access denied");
        return;
      }
      connect();
      setIsStreaming(true);
      setTimeout(() => {
        startLoop();
        startAIAnalysis();
      }, 500);
    }
  }, [isStreaming, startCamera, stopCamera, connect, disconnect, startLoop, stopLoop, startAIAnalysis, stopAIAnalysis]);

  useEffect(() => {
    if (isStreaming) {
      stopLoop();
      startLoop();
    }
  }, [fps, isStreaming, stopLoop, startLoop]);

  useEffect(() => {
    return () => {
      stopLoop();
      stopCamera();
      disconnect();
      stopAIAnalysis();
    };
  }, [stopLoop, stopCamera, disconnect, stopAIAnalysis]);

  const getSeverityStyle = (severity: number, isDangerous?: boolean) => {
    if (isDangerous || severity >= 3) return { bg: "bg-red-500/10", border: "border-red-500", text: "text-red-400", dot: "bg-red-500" };
    return { bg: "bg-emerald-500/5", border: "border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-500" };
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-mono">
      {/* Alert Banner */}
      {alertEvent && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 px-4 py-3 animate-pulse">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-white animate-ping" />
              <span className="font-bold uppercase tracking-wide">ALERT DETECTED</span>
              <span className="opacity-80">|</span>
              <span>{alertEvent.label}</span>
            </div>
            <button 
              onClick={() => setAlertEvent(null)}
              className="text-white/80 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`sticky top-0 z-40 border-b border-zinc-800/50 bg-[#0a0a0f]/95 backdrop-blur ${alertEvent ? 'mt-12' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-emerald-400">EYE</span>
              <span className="text-zinc-400">WATCH</span>
            </h1>
            
            <div className="h-4 w-px bg-zinc-700" />

            <div className={`flex items-center gap-2 text-xs uppercase tracking-wider ${
              status === "online" ? "text-emerald-400" :
              status === "connecting" ? "text-amber-400" :
              "text-zinc-500"
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                status === "online" ? "bg-emerald-400" :
                status === "connecting" ? "bg-amber-400 animate-pulse" :
                "bg-zinc-600"
              }`} />
              {status}
            </div>

            {isStreaming && (
              <>
                <div className="h-4 w-px bg-zinc-700" />
                <div className={`flex items-center gap-2 text-xs uppercase tracking-wider ${
                  aiAnalyzing ? "text-cyan-400" : "text-emerald-400"
                }`}>
                  <div className={`w-2 h-2 rounded-full ${aiAnalyzing ? "bg-cyan-400 animate-pulse" : "bg-emerald-400"}`} />
                  AI {aiAnalyzing ? "ANALYZING" : "ACTIVE"}
                </div>
              </>
            )}
          </div>

          {isStreaming && (
            <div className="flex items-center gap-5 text-xs">
              <div className="text-zinc-500">
                FPS <span className="text-white font-bold ml-1">{debug.fps.toFixed(0)}</span>
              </div>
              <div className="text-zinc-500">
                SUBJECTS <span className="text-white font-bold ml-1">{debug.persons}</span>
              </div>
              <div className="flex items-center gap-2 text-red-400">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                REC
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          
          {/* Video Feed */}
          <div className="xl:col-span-3 space-y-3">
            <div className={`relative bg-black rounded-lg overflow-hidden border-2 ${
              alertEvent ? 'border-red-500 shadow-lg shadow-red-500/20' : 'border-zinc-800'
            }`} style={{ aspectRatio: "16/9" }}>
              <video 
                ref={videoRef} 
                className="absolute inset-0 w-full h-full object-cover" 
                playsInline 
                muted 
              />
              <canvas 
                ref={canvasRef} 
                className="absolute inset-0 w-full h-full object-cover pointer-events-none" 
              />

              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95">
                  <div className="w-20 h-20 rounded-full border-2 border-zinc-700 flex items-center justify-center mb-4">
                    <div className="w-10 h-10 rounded-full border-2 border-zinc-600" />
                  </div>
                  <p className="text-zinc-400 text-sm uppercase tracking-wider">Camera Offline</p>
                  <p className="text-zinc-600 text-xs mt-2">Click START to begin monitoring</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <button
                onClick={toggle}
                className={`px-6 py-2.5 rounded font-bold text-sm uppercase tracking-wider transition-all ${
                  isStreaming
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-emerald-500 hover:bg-emerald-600 text-black"
                }`}
              >
                {isStreaming ? "Stop" : "Start"}
              </button>

              <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800/50 rounded">
                <span className="text-xs text-zinc-500 uppercase">FPS</span>
                <input
                  type="range"
                  min="5"
                  max="15"
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="w-20 accent-emerald-500"
                />
                <span className="text-sm text-white w-5">{fps}</span>
              </div>

              <div className="ml-auto text-xs text-zinc-500 font-mono">
                {currentTime}
              </div>
            </div>
          </div>

          {/* Event Log */}
          <div className="bg-zinc-900/30 rounded-lg border border-zinc-800 flex flex-col" style={{ height: "calc(100vh - 120px)", minHeight: "500px" }}>
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-sm uppercase tracking-wider">Activity Log</h2>
                <p className="text-xs text-zinc-600 mt-0.5">AI-powered detection</p>
              </div>
              <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-1 rounded">
                {events.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                  <div className="w-8 h-8 rounded-full border border-zinc-700 mb-3" />
                  <p className="text-xs uppercase tracking-wider">Awaiting Events</p>
                  <p className="text-[10px] text-zinc-700 mt-1">AI analyzes every 2 seconds</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {events.map((ev, i) => {
                    const style = getSeverityStyle(ev.severity, ev.isDangerous);
                    return (
                      <div
                        key={`${ev.timestamp}-${i}`}
                        className={`px-4 py-3 ${style.bg} ${i === 0 ? 'animate-pulse' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${style.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${style.text}`}>
                                {ev.isDangerous ? "ALERT" : "INFO"}
                              </span>
                              <span className="text-[10px] text-zinc-600">
                                {ev.time}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-300 mt-1 leading-snug break-words">
                              {ev.label}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {events.length > 0 && (
              <div className="p-3 border-t border-zinc-800">
                <button
                  onClick={() => setEvents([])}
                  className="w-full py-2 text-xs text-zinc-500 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded uppercase tracking-wider transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
