"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Detection {
  cls: string;
  conf: number;
  bbox: [number, number, number, number];
  track_id?: number;
}

interface Event {
  type: string;
  severity: number;
  label: string;
  track_id: number;
  track_id_2?: number;
  icon?: string;
  time?: string;
  timestamp?: number;
}

interface FrameResponse {
  frameId: number;
  ts: number;
  detections: Detection[];
  pose: unknown[];
  hands: unknown[];
  events: Event[];
  debug: { fps: number; persons: number };
}

type ConnectionStatus = "disconnected" | "connecting" | "connected";

export default function RealtimePage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [fps, setFps] = useState(6);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [events, setEvents] = useState<Event[]>([]);
  const [debugInfo, setDebugInfo] = useState({ fps: 0, persons: 0 });
  const [alertActive, setAlertActive] = useState(false);
  const [lastAlert, setLastAlert] = useState<Event | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameLoopRef = useRef<number | null>(null);

  const WS_URL = process.env.NEXT_PUBLIC_ANALYZER_WS_URL || "ws://127.0.0.1:8000/ws";

  useEffect(() => {
    offscreenCanvasRef.current = document.createElement("canvas");
  }, []);

  // Flash alert for critical events
  useEffect(() => {
    if (alertActive) {
      const timer = setTimeout(() => setAlertActive(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [alertActive]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setConnectionStatus("connecting");
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnectionStatus("connected");

    ws.onmessage = (event) => {
      try {
        const data: FrameResponse = JSON.parse(event.data);
        setDebugInfo(data.debug);

        if (data.events?.length > 0) {
          const newEvents = data.events.map((e) => ({
            ...e,
            timestamp: Date.now(),
          }));
          
          // Trigger alert for critical events
          const critical = newEvents.find(e => e.severity >= 3);
          if (critical) {
            setAlertActive(true);
            setLastAlert(critical);
          }
          
          setEvents((prev) => [...newEvents, ...prev].slice(0, 50));
        }

        drawOverlay(data);
      } catch (err) {
        console.error("Parse error:", err);
      }
    };

    ws.onclose = () => setConnectionStatus("disconnected");
    ws.onerror = () => setConnectionStatus("disconnected");
    wsRef.current = ws;
  }, [WS_URL]);

  const disconnectWebSocket = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
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
    const offscreen = offscreenCanvasRef.current;
    const ws = wsRef.current;
    if (!video || !offscreen || !ws || ws.readyState !== WebSocket.OPEN || video.readyState < 2) return;

    offscreen.width = video.videoWidth || 640;
    offscreen.height = video.videoHeight || 480;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    offscreen.toBlob((blob) => {
      if (blob && ws.readyState === WebSocket.OPEN) {
        blob.arrayBuffer().then((buffer) => ws.send(buffer));
      }
    }, "image/jpeg", 0.7);
  }, []);

  const startFrameLoop = useCallback(() => {
    const interval = 1000 / fps;
    let lastTime = 0;
    const loop = (time: number) => {
      if (time - lastTime >= interval) {
        sendFrame();
        lastTime = time;
      }
      frameLoopRef.current = requestAnimationFrame(loop);
    };
    frameLoopRef.current = requestAnimationFrame(loop);
  }, [fps, sendFrame]);

  const stopFrameLoop = useCallback(() => {
    if (frameLoopRef.current) {
      cancelAnimationFrame(frameLoopRef.current);
      frameLoopRef.current = null;
    }
  }, []);

  const drawOverlay = useCallback((data: FrameResponse) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Check for active alerts
    const hasAlert = data.events?.some(e => e.severity >= 3);
    
    if (hasAlert) {
      // Red pulsing border for alerts
      ctx.strokeStyle = "#ff0040";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
      
      // Semi-transparent red overlay
      ctx.fillStyle = "rgba(255, 0, 64, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw detections (bounding boxes only, no skeleton)
    for (const det of data.detections) {
      const [x, y, w, h] = det.bbox;
      const hasEvent = data.events?.some((e) => e.track_id === det.track_id);

      // Colors based on state
      let boxColor = "#00ff88";
      let labelBg = "#00ff88";
      
      if (det.cls === "person") {
        if (hasEvent) {
          boxColor = "#ff0040";
          labelBg = "#ff0040";
        } else {
          boxColor = "#00d4ff";
          labelBg = "#00d4ff";
        }
      }

      // Draw box
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      // Draw corners for style
      const corner = 20;
      ctx.lineWidth = 4;
      ctx.beginPath();
      // Top left
      ctx.moveTo(x, y + corner);
      ctx.lineTo(x, y);
      ctx.lineTo(x + corner, y);
      // Top right
      ctx.moveTo(x + w - corner, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + corner);
      // Bottom right
      ctx.moveTo(x + w, y + h - corner);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w - corner, y + h);
      // Bottom left
      ctx.moveTo(x + corner, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + h - corner);
      ctx.stroke();

      // Label
      const label = `#${det.track_id || "?"} ${Math.round(det.conf * 100)}%`;
      ctx.font = "bold 14px system-ui";
      const tw = ctx.measureText(label).width;
      
      ctx.fillStyle = labelBg;
      ctx.fillRect(x, y - 24, tw + 16, 22);
      
      ctx.fillStyle = "#000";
      ctx.fillText(label, x + 8, y - 7);
    }

    // Timestamp
    ctx.font = "12px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(new Date().toLocaleTimeString(), 10, canvas.height - 10);
    
    // Person count
    ctx.fillText(`${data.debug.persons} person(s) detected`, 10, 20);
  }, []);

  const toggleStreaming = useCallback(async () => {
    if (isStreaming) {
      stopFrameLoop();
      stopCamera();
      disconnectWebSocket();
      setIsStreaming(false);
      setEvents([]);
      canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    } else {
      const started = await startCamera();
      if (!started) {
        alert("Camera access denied");
        return;
      }
      connectWebSocket();
      setIsStreaming(true);
      setTimeout(startFrameLoop, 500);
    }
  }, [isStreaming, startCamera, stopCamera, connectWebSocket, disconnectWebSocket, startFrameLoop, stopFrameLoop]);

  useEffect(() => {
    if (isStreaming) {
      stopFrameLoop();
      startFrameLoop();
    }
  }, [fps, isStreaming, stopFrameLoop, startFrameLoop]);

  useEffect(() => {
    return () => {
      stopFrameLoop();
      stopCamera();
      disconnectWebSocket();
    };
  }, [stopFrameLoop, stopCamera, disconnectWebSocket]);

  const getEventColor = (severity: number) => {
    if (severity >= 4) return { bg: "bg-red-500/20", border: "border-red-500", text: "text-red-400" };
    if (severity >= 3) return { bg: "bg-orange-500/20", border: "border-orange-500", text: "text-orange-400" };
    return { bg: "bg-yellow-500/20", border: "border-yellow-500", text: "text-yellow-400" };
  };

  const formatEventTime = (timestamp?: number) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleTimeString("en-US", { 
      hour: "2-digit", 
      minute: "2-digit", 
      second: "2-digit",
      hour12: false 
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Alert Banner */}
      {alertActive && lastAlert && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 flex items-center justify-center gap-3 animate-pulse">
          <span className="text-2xl">{lastAlert.icon || "🚨"}</span>
          <span className="font-bold text-lg">{lastAlert.type}</span>
          <span className="text-sm opacity-90">{lastAlert.label}</span>
        </div>
      )}

      {/* Header */}
      <header className={`sticky top-0 z-40 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur ${alertActive ? 'mt-14' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-lg">
                👁️
              </div>
              <h1 className="text-xl font-bold">
                <span className="text-cyan-400">Eye</span>Watch
              </h1>
            </div>
            
            <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${
              connectionStatus === "connected" ? "bg-green-500/20 text-green-400" :
              connectionStatus === "connecting" ? "bg-yellow-500/20 text-yellow-400" :
              "bg-red-500/20 text-red-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus === "connected" ? "bg-green-400" :
                connectionStatus === "connecting" ? "bg-yellow-400 animate-pulse" :
                "bg-red-400"
              }`} />
              {connectionStatus}
            </div>
          </div>

          {isStreaming && (
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">FPS:</span>
                <span className="font-mono font-bold text-cyan-400">{debugInfo.fps}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Detected:</span>
                <span className="font-mono font-bold text-white">{debugInfo.persons}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 font-medium">LIVE</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`relative aspect-video bg-black rounded-xl overflow-hidden border-2 ${
              alertActive ? 'border-red-500 shadow-lg shadow-red-500/20' : 'border-zinc-800'
            }`}>
              <video ref={videoRef} className="w-full h-full object-contain" playsInline muted />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />

              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90">
                  <div className="text-6xl mb-4">📹</div>
                  <p className="text-zinc-400 text-lg">Camera Off</p>
                  <p className="text-zinc-600 text-sm mt-1">Press Start to begin monitoring</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
              <button
                onClick={toggleStreaming}
                className={`px-6 py-3 rounded-lg font-bold text-sm transition-all ${
                  isStreaming
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-cyan-500 hover:bg-cyan-600 text-black"
                }`}
              >
                {isStreaming ? "⏹ Stop" : "▶ Start"}
              </button>

              <div className="flex items-center gap-3 px-4 py-2 bg-zinc-800 rounded-lg">
                <span className="text-sm text-zinc-400">FPS:</span>
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="w-24"
                />
                <span className="font-mono text-cyan-400 w-4">{fps}</span>
              </div>
              
              <div className="ml-auto text-sm text-zinc-500">
                💡 Touch your head for 2s to signal distress
              </div>
            </div>
          </div>

          {/* Event Log */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col max-h-[600px]">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2">
                📋 Event Log
              </h2>
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
                {events.length} events
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {events.length === 0 ? (
                <div className="text-center py-12 text-zinc-600">
                  <div className="text-4xl mb-3">✓</div>
                  <p>No events detected</p>
                  <p className="text-sm mt-1">All clear</p>
                </div>
              ) : (
                events.map((event, idx) => {
                  const colors = getEventColor(event.severity);
                  return (
                    <div
                      key={`${event.timestamp}-${idx}`}
                      className={`p-3 rounded-lg border-l-4 ${colors.bg} ${colors.border}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{event.icon || "⚠️"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-bold text-sm ${colors.text}`}>
                              {event.type}
                            </span>
                            <span className="text-xs text-zinc-500">
                              #{event.track_id}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            {event.label}
                          </p>
                          <p className="text-xs text-zinc-500 mt-2 font-mono">
                            {event.time || formatEventTime(event.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {events.length > 0 && (
              <div className="p-3 border-t border-zinc-800">
                <button
                  onClick={() => setEvents([])}
                  className="w-full py-2 text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded-lg transition-colors"
                >
                  Clear Log
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
