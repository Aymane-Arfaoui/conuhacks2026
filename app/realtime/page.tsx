"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { analyzeFrame, DetectionEvent } from "../actions/detect";

// TensorFlow.js imports
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";

interface Event {
  type: string;
  severity: number;
  label: string;
  time?: string;
  timestamp?: number;
  isDangerous?: boolean;
}

type Status = "offline" | "loading" | "ready" | "running";

export default function RealtimePage() {
  const [status, setStatus] = useState<Status>("offline");
  const [events, setEvents] = useState<Event[]>([]);
  const [alertEvent, setAlertEvent] = useState<Event | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [fps, setFps] = useState(0);
  const [faceCount, setFaceCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const aiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Model
  const faceModelRef = useRef<blazeface.BlazeFaceModel | null>(null);
  
  // Tracking
  const lastDetectionRef = useRef(0);
  const fpsCounterRef = useRef<number[]>([]);

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Dismiss alert
  useEffect(() => {
    if (alertEvent) {
      const timer = setTimeout(() => setAlertEvent(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alertEvent]);

  // Load TensorFlow.js models
  const loadModels = useCallback(async () => {
    setStatus("loading");
    
    try {
      // Initialize TensorFlow.js
      await tf.ready();
      await tf.setBackend("webgl");
      console.log("TF.js ready with backend:", tf.getBackend());

      // Load BlazeFace (face detection)
      faceModelRef.current = await blazeface.load({
        maxFaces: 4,
      });
      console.log("BlazeFace loaded");

      setStatus("ready");
    } catch (error) {
      console.error("Failed to load models:", error);
      setStatus("offline");
    }
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
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

  // Stop camera
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // AI Analysis (server-side Gemini)
  const runAIAnalysis = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 640, 480);

    setAiAnalyzing(true);
    try {
      const result = await analyzeFrame(canvas.toDataURL("image/jpeg", 0.7));
      if (result.events?.length > 0) {
        const aiEvents: Event[] = result.events.map((e: DetectionEvent) => ({
          type: e.isDangerous ? "AI ALERT" : "AI",
          severity: e.isDangerous ? 3 : 1,
          label: e.description,
          time: new Date().toLocaleTimeString("en-US", { hour12: false }),
          timestamp: Date.now(),
          isDangerous: e.isDangerous
        }));
        setEvents(prev => [...aiEvents, ...prev].slice(0, 50));
        const dangerous = aiEvents.find(e => e.isDangerous);
        if (dangerous) setAlertEvent(dangerous);
      }
    } catch (err) {
      console.error("AI analysis error:", err);
    }
    setAiAnalyzing(false);
  }, []);

  // Main detection loop
  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(runDetection);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Throttle to ~15 FPS
    const now = performance.now();
    if (now - lastDetectionRef.current < 66) {
      animationRef.current = requestAnimationFrame(runDetection);
      return;
    }

    // FPS counter
    fpsCounterRef.current.push(now);
    fpsCounterRef.current = fpsCounterRef.current.filter(t => now - t < 1000);
    setFps(fpsCounterRef.current.length);

    lastDetectionRef.current = now;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    canvas.width = vw;
    canvas.height = vh;

    // Clear and draw video frame
    ctx.clearRect(0, 0, vw, vh);
    ctx.drawImage(video, 0, 0, vw, vh);

    let detectedFaces = 0;

    // FACE DETECTION (BlazeFace)
    if (faceModelRef.current) {
      try {
        const faces = await faceModelRef.current.estimateFaces(video, false);
        detectedFaces = faces.length;

        for (const face of faces) {
          const [x1, y1] = face.topLeft as [number, number];
          const [x2, y2] = face.bottomRight as [number, number];
          const w = x2 - x1;
          const h = y2 - y1;
          const conf = Math.round((face.probability as number) * 100);

          // Glow effect
          ctx.shadowColor = "#22c55e";
          ctx.shadowBlur = 20;

          // Face bounding box
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 2;
          ctx.strokeRect(x1, y1, w, h);

          ctx.shadowBlur = 0;

          // Corner brackets (professional look)
          const c = Math.min(w, h) * 0.18;
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 3;
          ctx.beginPath();
          // Top-left
          ctx.moveTo(x1, y1 + c); ctx.lineTo(x1, y1); ctx.lineTo(x1 + c, y1);
          // Top-right
          ctx.moveTo(x2 - c, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + c);
          // Bottom-left
          ctx.moveTo(x1, y2 - c); ctx.lineTo(x1, y2); ctx.lineTo(x1 + c, y2);
          // Bottom-right
          ctx.moveTo(x2 - c, y2); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - c);
          ctx.stroke();

          // Label background
          ctx.fillStyle = "#22c55e";
          ctx.font = "bold 12px monospace";
          const label = `FACE ${conf}%`;
          const tw = ctx.measureText(label).width + 12;
          ctx.fillRect(x1, y1 - 22, tw, 20);
          ctx.fillStyle = "#000";
          ctx.fillText(label, x1 + 6, y1 - 6);

          // Face landmarks
          if (face.landmarks) {
            const landmarks = face.landmarks as number[][];
            const names = ["L-EYE", "R-EYE", "NOSE", "MOUTH-L", "MOUTH-R", "L-EAR", "R-EAR"];
            const colors = ["#06b6d4", "#06b6d4", "#a855f7", "#ec4899", "#ec4899", "#f97316", "#f97316"];
            
            landmarks.forEach((pt, i) => {
              const [px, py] = pt;
              
              // Outer glow
              ctx.shadowColor = colors[i];
              ctx.shadowBlur = 8;
              
              // Draw point
              ctx.fillStyle = colors[i];
              ctx.beginPath();
              ctx.arc(px, py, i < 2 ? 6 : 5, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.shadowBlur = 0;
              
              // White outline
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 2;
              ctx.stroke();
              
              // Label for first 3 points
              if (i < 3 && names[i]) {
                ctx.fillStyle = colors[i];
                ctx.font = "bold 9px monospace";
                ctx.fillText(names[i], px + 10, py - 2);
              }
            });

            // Draw mouth line
            if (landmarks[3] && landmarks[4]) {
              const [mx1, my1] = landmarks[3];
              const [mx2, my2] = landmarks[4];
              ctx.strokeStyle = "#ec4899";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(mx1, my1);
              ctx.lineTo(mx2, my2);
              ctx.stroke();
              
              // Mouth label
              ctx.fillStyle = "#ec4899";
              ctx.font = "bold 9px monospace";
              ctx.fillText("MOUTH", (mx1 + mx2) / 2 - 15, (my1 + my2) / 2 + 15);
            }
          }
        }
      } catch (e) {
        console.error("Face detection error:", e);
      }
    }

    setFaceCount(detectedFaces);

    // HUD overlay
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#22c55e";
    ctx.fillText("LIVE", 12, 24);
    
    ctx.font = "11px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText(`${vw}x${vh} @ ${fps} FPS`, 12, 42);
    ctx.fillText(`Faces: ${detectedFaces}`, 12, 58);

    // AI status
    ctx.fillStyle = aiAnalyzing ? "#06b6d4" : "#555";
    ctx.fillText(aiAnalyzing ? "AI Analyzing..." : "AI Ready", 12, 74);

    // Right side - timestamp
    ctx.textAlign = "right";
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#fff";
    ctx.fillText(new Date().toLocaleTimeString("en-US", { hour12: false }), vw - 12, 24);
    ctx.font = "11px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText(new Date().toLocaleDateString(), vw - 12, 42);

    // REC indicator (blinking)
    if (Date.now() % 1000 < 600) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(vw - 12, 60, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 10px monospace";
    ctx.fillText("REC", vw - 26, 64);
    ctx.textAlign = "left";

    animationRef.current = requestAnimationFrame(runDetection);
  }, [fps, aiAnalyzing]);

  // Start/Stop
  const toggle = useCallback(async () => {
    if (status === "running") {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
      stopCamera();
      setStatus("ready");
      setEvents([]);
      setAlertEvent(null);
      setFaceCount(0);
    } else if (status === "ready") {
      const ok = await startCamera();
      if (!ok) return alert("Camera access denied");
      setStatus("running");
      
      setTimeout(() => {
        runDetection();
        // Run AI analysis immediately and every 2.5 seconds
        runAIAnalysis();
        aiIntervalRef.current = setInterval(runAIAnalysis, 2500);
      }, 500);
    }
  }, [status, startCamera, stopCamera, runDetection, runAIAnalysis]);

  // Load models on mount
  useEffect(() => {
    loadModels();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
      stopCamera();
    };
  }, [loadModels, stopCamera]);

  const getSeverityStyle = (severity: number, isDangerous?: boolean) => {
    if (isDangerous || severity >= 3) return { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-500" };
    return { bg: "bg-emerald-500/5", text: "text-emerald-400", dot: "bg-emerald-500" };
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-mono">
      {/* Alert Banner */}
      {alertEvent && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 px-4 py-3 animate-pulse">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-white animate-ping" />
              <span className="font-bold uppercase">ALERT</span>
              <span className="opacity-80">|</span>
              <span>{alertEvent.label}</span>
            </div>
            <button onClick={() => setAlertEvent(null)} className="text-white/80 hover:text-white text-sm">Dismiss</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`sticky top-0 z-40 border-b border-zinc-800/50 bg-[#0a0a0f]/95 backdrop-blur ${alertEvent ? 'mt-12' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <h1 className="text-lg font-bold">
              <span className="text-emerald-400">EYE</span><span className="text-zinc-400">WATCH</span>
            </h1>
            <div className="h-4 w-px bg-zinc-700" />
            <div className={`flex items-center gap-2 text-xs uppercase ${
              status === "running" ? "text-emerald-400" : 
              status === "loading" ? "text-amber-400" : 
              status === "ready" ? "text-cyan-400" : "text-zinc-500"
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                status === "running" ? "bg-emerald-400" : 
                status === "loading" ? "bg-amber-400 animate-pulse" : 
                status === "ready" ? "bg-cyan-400" : "bg-zinc-600"
              }`} />
              {status === "loading" ? "LOADING AI..." : status.toUpperCase()}
            </div>
          </div>
          {status === "running" && (
            <div className="flex items-center gap-5 text-xs">
              <span className="text-zinc-500">FPS <span className="text-white font-bold ml-1">{fps}</span></span>
              <span className="text-zinc-500">FACES <span className="text-cyan-400 font-bold ml-1">{faceCount}</span></span>
              <div className="flex items-center gap-2 text-red-400">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />REC
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* Video Section */}
          <div className="xl:col-span-3 space-y-3">
            <div className={`relative bg-black rounded-lg overflow-hidden border-2 ${alertEvent ? 'border-red-500 shadow-lg shadow-red-500/20' : 'border-zinc-800'}`} style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
              {status !== "running" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95">
                  <div className="w-20 h-20 rounded-full border-2 border-zinc-700 flex items-center justify-center mb-4">
                    <div className="w-10 h-10 rounded-full border-2 border-zinc-600" />
                  </div>
                  <p className="text-zinc-400 text-sm uppercase">
                    {status === "loading" ? "Loading BlazeFace AI..." : status === "ready" ? "Ready" : "Offline"}
                  </p>
                  <p className="text-zinc-600 text-xs mt-2">
                    {status === "loading" ? "Face Detection + Gemini Vision" : "Click START to begin surveillance"}
                  </p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <button 
                onClick={toggle} 
                disabled={status === "loading" || status === "offline"}
                className={`px-6 py-2.5 rounded font-bold text-sm uppercase transition-all ${
                  status === "running" ? "bg-red-500 hover:bg-red-600 text-white" : 
                  status === "ready" ? "bg-emerald-500 hover:bg-emerald-600 text-black" :
                  "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                }`}
              >
                {status === "running" ? "Stop" : status === "loading" ? "Loading..." : "Start"}
              </button>
              <div className="flex-1" />
              <div className="text-xs text-zinc-500 font-mono">{currentTime}</div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 p-3 bg-zinc-900/30 rounded-lg border border-zinc-800 text-xs">
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-500" /> Face Box</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-cyan-500" /> Eyes</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-purple-500" /> Nose</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-pink-500" /> Mouth</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-orange-500" /> Ears</span>
            </div>
          </div>

          {/* Events Panel */}
          <div className="bg-zinc-900/30 rounded-lg border border-zinc-800 flex flex-col" style={{ height: "calc(100vh - 120px)", minHeight: "500px" }}>
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="font-bold text-sm uppercase">Activity Log</h2>
              <p className="text-xs text-zinc-600 mt-0.5">Gemini Vision AI</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                  <div className="w-10 h-10 rounded-full border-2 border-zinc-700 mb-3 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border border-zinc-600" />
                  </div>
                  <p className="text-xs uppercase">Awaiting Events</p>
                  <p className="text-[10px] text-zinc-700 mt-1">AI analyzes every 2.5s</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {events.map((ev, i) => {
                    const style = getSeverityStyle(ev.severity, ev.isDangerous);
                    return (
                      <div key={`${ev.timestamp}-${i}`} className={`px-4 py-3 ${style.bg} ${i === 0 ? 'animate-pulse' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase ${style.text}`}>{ev.type}</span>
                              <span className="text-[10px] text-zinc-600">{ev.time}</span>
                            </div>
                            <p className="text-sm text-zinc-300 mt-1 break-words leading-relaxed">{ev.label}</p>
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
                <button onClick={() => setEvents([])} className="w-full py-2 text-xs text-zinc-500 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded uppercase transition-colors">Clear Log</button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
