"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { analyzeFrame, DetectionEvent } from "../actions/detect";
import { FilesetResolver, GestureRecognizer, DrawingUtils } from "@mediapipe/tasks-vision";
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";
import LogsPanel from "@/components/LogsPanel";
import GestureDisplay from "@/components/GestureDisplay";
import Navbar from "@/components/Navbar";
import { 
  GestureType, 
  GestureDetection, 
  LogEntry, 
  AIEvent,
  EmergencySettings,
  EmergencyResponse,
  DEFAULT_EMERGENCY_SETTINGS,
  GESTURE_INFO
} from "@/types";
import { Settings, Lock, Volume2, Shield, FolderOpen } from "lucide-react";

type Status = "offline" | "loading" | "ready" | "running";

const MP_VERSION = "0.10.32";

export default function RealtimePage() {
  const [status, setStatus] = useState<Status>("offline");
  const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alertEvent, setAlertEvent] = useState<AIEvent | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [fps, setFps] = useState(0);
  const [faceCount, setFaceCount] = useState(0);
  const [handCount, setHandCount] = useState(0);
  const [currentGesture, setCurrentGesture] = useState<GestureDetection | null>(null);
  const [emergencySettings, setEmergencySettings] = useState<EmergencySettings>(DEFAULT_EMERGENCY_SETTINGS);
  const [emergencyTriggered, setEmergencyTriggered] = useState(false);
  const [emergencyAction, setEmergencyAction] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const aiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeOscillatorRef = useRef<OscillatorNode | null>(null);
  const alarmStoppedRef = useRef(false);
  const [gestureHoldProgress, setGestureHoldProgress] = useState(0);
  
  // Models
  const faceModelRef = useRef<blazeface.BlazeFaceModel | null>(null);
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  
  // Tracking
  const lastDetectionRef = useRef(0);
  const fpsCounterRef = useRef<number[]>([]);
  const lastLogTimeRef = useRef(0);
  const emergencyGestureStartRef = useRef<number | null>(null);

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

  // Initialize audio context (must be called on user interaction)
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // Play alarm sound (single beep, no overlap)
  const isPlayingRef = useRef(false);
  
  const playAlarmSound = useCallback(() => {
    // Don't play if alarm was stopped
    if (alarmStoppedRef.current) return;
    
    // Prevent overlapping sounds
    if (isPlayingRef.current) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      isPlayingRef.current = true;
      const ctx = audioContextRef.current;
      
      // Single alarm beep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.25;
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
      
      // Track active oscillator
      activeOscillatorRef.current = osc;
      
      // Allow next sound after this one finishes
      setTimeout(() => {
        isPlayingRef.current = false;
        activeOscillatorRef.current = null;
      }, 400);
      
    } catch (err) {
      isPlayingRef.current = false;
      console.error("[ALARM] Failed to play:", err);
    }
  }, []);

  // Trigger emergency response
  const triggerEmergency = useCallback(() => {
    if (emergencyTriggered) return;
    
    console.log("[EMERGENCY] *** TRIGGERING EMERGENCY ***");
    console.log("[EMERGENCY] Response type:", emergencySettings.emergencyResponse);
    
    // Reset alarm stopped flag
    alarmStoppedRef.current = false;
    
    setEmergencyTriggered(true);
    setGestureHoldProgress(0);
    
    const response = emergencySettings.emergencyResponse;
    const actions: string[] = [];
    
    if (response === EmergencyResponse.LOCK_DOORS || response === EmergencyResponse.BOTH) {
      actions.push("DOORS LOCKED");
      console.log("[EMERGENCY] Locking all doors...");
    }
    
    if (response === EmergencyResponse.SOUND_ALARM || response === EmergencyResponse.BOTH) {
      actions.push("ALARM ACTIVE");
      console.log("[EMERGENCY] Sounding alarm...");
      // Start continuous alarm
      playAlarmSound();
      alarmIntervalRef.current = setInterval(playAlarmSound, 500);
    }
    
    setEmergencyAction(actions.join(" + "));
    
    // Add to AI events
    setAiEvents(prev => [{
      type: "EMERGENCY",
      severity: 5,
      label: `EMERGENCY TRIGGERED: ${actions.join(", ")}`,
      time: new Date().toLocaleTimeString("en-US", { hour12: false }),
      timestamp: Date.now(),
      isDangerous: true
    }, ...prev].slice(0, 50));
  }, [emergencyTriggered, emergencySettings, playAlarmSound]);

  // Cancel emergency and stop alarm
  const cancelEmergency = useCallback(() => {
    console.log("[EMERGENCY] Cancelling emergency...");
    
    // FIRST: Set flag to prevent any new sounds
    alarmStoppedRef.current = true;
    
    // Stop the alarm interval IMMEDIATELY
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    
    // Stop any active oscillator
    if (activeOscillatorRef.current) {
      try {
        activeOscillatorRef.current.stop();
        activeOscillatorRef.current.disconnect();
      } catch {}
      activeOscillatorRef.current = null;
    }
    
    // Close the AudioContext completely
    isPlayingRef.current = false;
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    
    // Reset state
    setEmergencyTriggered(false);
    setEmergencyAction(null);
    emergencyGestureStartRef.current = null;
    
    console.log("[EMERGENCY] Emergency cancelled - alarm stopped");
  }, []);

  // Add log entry
  const addLog = useCallback((gesture: GestureDetection) => {
    const now = Date.now();
    if (now - lastLogTimeRef.current < 80) return;
    lastLogTimeRef.current = now;

    setLogs((prev) => {
      const newEntry: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        message: gesture.label,
        type: gesture.type,
        timestamp: new Date(),
        isDangerous: gesture.type === emergencySettings.emergencyGesture
      };
      return [newEntry, ...prev].slice(0, 150);
    });
  }, [emergencySettings.emergencyGesture]);

  // Load models
  const loadModels = useCallback(async () => {
    setStatus("loading");
    
    try {
      await tf.ready();
      await tf.setBackend("webgl");
      console.log("TF.js ready");

      faceModelRef.current = await blazeface.load({ maxFaces: 4 });
      console.log("BlazeFace loaded");

      const vision = await FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`
      );
      
      gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      });
      console.log("GestureRecognizer loaded");

      setStatus("ready");
    } catch (error) {
      console.error("Failed to load models:", error);
      setStatus("offline");
    }
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      // Initialize audio context on user interaction
      initAudio();
      
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
  }, [initAudio]);

  // Stop camera
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // AI Analysis (Gemini)
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
        const events: AIEvent[] = result.events.map((e: DetectionEvent) => ({
          type: e.isDangerous ? "AI ALERT" : "AI",
          severity: e.isDangerous ? 3 : 1,
          label: e.description,
          time: new Date().toLocaleTimeString("en-US", { hour12: false }),
          timestamp: Date.now(),
          isDangerous: e.isDangerous
        }));
        setAiEvents(prev => [...events, ...prev].slice(0, 50));
        const dangerous = events.find(e => e.isDangerous);
        if (dangerous) setAlertEvent(dangerous);
      }
    } catch (err) {
      console.error("AI error:", err);
    }
    setAiAnalyzing(false);
  }, []);

  // Map MediaPipe gesture to our type
  const mapGesture = useCallback((
    results: { gestures?: { categoryName: string; score: number }[][]; landmarks?: { x: number; y: number; z: number }[][] }
  ): GestureDetection => {
    const defaultGesture: GestureDetection = { type: GestureType.NONE, confidence: 0, label: 'None' };
    
    if (!results.gestures?.length || !results.landmarks?.length) return defaultGesture;

    let bestGesture = defaultGesture;

    results.landmarks.forEach((handLandmarks, index) => {
      const handGestures = results.gestures?.[index];
      if (!handGestures) return;

      const wrist = handLandmarks[0];
      const isArmsUp = handLandmarks.some(p => p.y < 0.15);
      const isTouchingHead = wrist.y < 0.35 && wrist.x > 0.25 && wrist.x < 0.75;

      if (isArmsUp) {
        bestGesture = { type: GestureType.ARMS_UP, confidence: 0.95, label: 'Arms Up' };
      } else if (isTouchingHead) {
        bestGesture = { type: GestureType.TOUCHING_HEAD, confidence: 0.85, label: 'Touching Head' };
      } else if (handGestures.length > 0) {
        const top = handGestures[0];
        if (top.categoryName === 'Open_Palm') {
          bestGesture = { type: GestureType.OPEN_PALM, confidence: top.score, label: 'Open Palm' };
        } else if (top.categoryName === 'Closed_Fist') {
          bestGesture = { type: GestureType.FIST, confidence: top.score, label: 'Fist' };
        } else if (top.categoryName === 'Thumb_Up') {
          bestGesture = { type: GestureType.THUMBS_UP, confidence: top.score, label: 'Thumbs Up' };
        } else if (top.categoryName === 'Pointing_Up') {
          bestGesture = { type: GestureType.POINTING, confidence: top.score, label: 'Pointing' };
        } else if (top.categoryName === 'Victory') {
          bestGesture = { type: GestureType.PEACE, confidence: top.score, label: 'Peace' };
        }
      }
    });

    return bestGesture;
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

    const now = performance.now();
    if (now - lastDetectionRef.current < 50) {
      animationRef.current = requestAnimationFrame(runDetection);
      return;
    }

    fpsCounterRef.current.push(now);
    fpsCounterRef.current = fpsCounterRef.current.filter(t => now - t < 1000);
    setFps(fpsCounterRef.current.length);

    lastDetectionRef.current = now;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    canvas.width = vw;
    canvas.height = vh;

    ctx.clearRect(0, 0, vw, vh);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -vw, 0, vw, vh);
    ctx.restore();

    let detectedFaces = 0;
    let detectedHands = 0;
    let gesture: GestureDetection = { type: GestureType.NONE, confidence: 0, label: 'None' };

    // GESTURE RECOGNITION (MediaPipe)
    if (gestureRecognizerRef.current) {
      try {
        const results = gestureRecognizerRef.current.recognizeForVideo(video, now);
        detectedHands = results.landmarks?.length || 0;
        gesture = mapGesture(results);

        if (results.landmarks) {
          const drawingUtils = new DrawingUtils(ctx);
          
          results.landmarks.forEach((landmarks, index) => {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-vw, 0);

            const color = index === 0 ? "#6366f1" : "#10b981";
            drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
              color: color,
              lineWidth: 4
            });
            drawingUtils.drawLandmarks(landmarks, {
              color: "#ffffff",
              lineWidth: 1,
              radius: 5
            });

            if (results.gestures?.[index]?.[0]?.score > 0.4) {
              const wrist = landmarks[0];
              const posX = wrist.x * vw;
              const posY = wrist.y * vh - 50;

              ctx.beginPath();
              ctx.arc(posX, posY, 15, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.shadowBlur = 20;
              ctx.shadowColor = color;
              ctx.fill();

              ctx.beginPath();
              ctx.arc(posX, posY, 8, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
              ctx.fill();
            }

            ctx.restore();
          });
        }
      } catch (e) {
        console.error("Gesture detection error:", e);
      }
    }

    // Check for emergency gesture
    const isEmergencyGestureDetected = emergencySettings.enabled && 
      gesture.type === emergencySettings.emergencyGesture && 
      gesture.confidence > 0.5;  // Lowered threshold
    
    if (isEmergencyGestureDetected && !emergencyTriggered) {
      if (!emergencyGestureStartRef.current) {
        emergencyGestureStartRef.current = now;
        console.log("[EMERGENCY] Started detecting:", gesture.type, "confidence:", gesture.confidence);
      }
      
      const holdTime = now - emergencyGestureStartRef.current;
      const progress = Math.min(holdTime / 2000, 1); // 2 seconds to trigger
      setGestureHoldProgress(progress);
      
      if (holdTime > 2000) {
        // Gesture held for 2 seconds - trigger emergency
        console.log("[EMERGENCY] Hold time reached, triggering!");
        triggerEmergency();
      }
    } else if (!isEmergencyGestureDetected) {
      if (emergencyGestureStartRef.current) {
        console.log("[EMERGENCY] Gesture lost");
      }
      emergencyGestureStartRef.current = null;
      setGestureHoldProgress(0);
    }

    // FACE DETECTION (BlazeFace)
    if (faceModelRef.current) {
      try {
        const faces = await faceModelRef.current.estimateFaces(video, false);
        detectedFaces = faces.length;

        for (const face of faces) {
          let [x1, y1] = face.topLeft as [number, number];
          let [x2, y2] = face.bottomRight as [number, number];
          
          x1 = vw - x2;
          x2 = vw - (face.topLeft as [number, number])[0];
          
          const w = x2 - x1;
          const h = y2 - y1;
          const conf = Math.round((face.probability as number) * 100);

          ctx.shadowColor = "#22c55e";
          ctx.shadowBlur = 15;
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 2;
          ctx.strokeRect(x1, y1, w, h);
          ctx.shadowBlur = 0;

          const c = Math.min(w, h) * 0.18;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x1, y1 + c); ctx.lineTo(x1, y1); ctx.lineTo(x1 + c, y1);
          ctx.moveTo(x2 - c, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + c);
          ctx.moveTo(x1, y2 - c); ctx.lineTo(x1, y2); ctx.lineTo(x1 + c, y2);
          ctx.moveTo(x2 - c, y2); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - c);
          ctx.stroke();

          ctx.fillStyle = "#22c55e";
          const label = `FACE ${conf}%`;
          const tw = ctx.measureText(label).width + 12;
          ctx.fillRect(x1, y1 - 22, tw, 20);
          ctx.fillStyle = "#000";
          ctx.font = "bold 12px monospace";
          ctx.fillText(label, x1 + 6, y1 - 6);

          if (face.landmarks) {
            const landmarks = face.landmarks as number[][];
            landmarks.forEach((pt, i) => {
              const px = vw - pt[0];
              const py = pt[1];
              const colors = ["#06b6d4", "#06b6d4", "#a855f7", "#ec4899", "#ec4899"];
              ctx.fillStyle = colors[i] || "#fff";
              ctx.beginPath();
              ctx.arc(px, py, 4, 0, Math.PI * 2);
              ctx.fill();
            });
          }
        }
      } catch (e) {
        console.error("Face detection error:", e);
      }
    }

    setFaceCount(detectedFaces);
    setHandCount(detectedHands);
    setCurrentGesture(gesture);
    addLog(gesture);
    
    // Debug: Log when emergency gesture is detected
    if (gesture.type !== GestureType.NONE && gesture.type === emergencySettings.emergencyGesture) {
      console.log(`[GESTURE] Emergency gesture detected: ${gesture.type}, confidence: ${gesture.confidence.toFixed(2)}`);
    }

    // HUD
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = emergencyTriggered ? "#ef4444" : "#22c55e";
    ctx.fillText(emergencyTriggered ? "EMERGENCY" : "LIVE", 12, 24);
    ctx.font = "11px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText(`${vw}x${vh} @ ${fps} FPS`, 12, 42);
    ctx.fillText(`Faces: ${detectedFaces} | Hands: ${detectedHands}`, 12, 58);
    ctx.fillStyle = aiAnalyzing ? "#06b6d4" : "#555";
    ctx.fillText(aiAnalyzing ? "AI Analyzing..." : "AI Ready", 12, 74);

    ctx.textAlign = "right";
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#fff";
    ctx.fillText(new Date().toLocaleTimeString("en-US", { hour12: false }), vw - 12, 24);
    ctx.font = "11px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText(new Date().toLocaleDateString(), vw - 12, 42);

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
  }, [fps, aiAnalyzing, mapGesture, addLog, emergencySettings, triggerEmergency, emergencyTriggered]);

  // Start/Stop
  const toggle = useCallback(async () => {
    if (status === "running") {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
      cancelEmergency();
      stopCamera();
      setStatus("ready");
      setAiEvents([]);
      setLogs([]);
      setAlertEvent(null);
      setCurrentGesture(null);
    } else if (status === "ready") {
      const ok = await startCamera();
      if (!ok) return alert("Camera access denied");
      setStatus("running");
      
      setTimeout(() => {
        runDetection();
        runAIAnalysis();
        aiIntervalRef.current = setInterval(runAIAnalysis, 3000);
      }, 500);
    }
  }, [status, startCamera, stopCamera, runDetection, runAIAnalysis, cancelEmergency]);

  // Load on mount
  useEffect(() => {
    loadModels();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
      if (gestureRecognizerRef.current) gestureRecognizerRef.current.close();
      // Close audio context on unmount
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch {}
        audioContextRef.current = null;
      }
      stopCamera();
    };
  }, [loadModels, stopCamera]);

  const isEmergencyGesture = currentGesture && currentGesture.type === emergencySettings.emergencyGesture;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-mono">
      {/* Emergency Banner */}
      {emergencyTriggered && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 px-4 py-4 animate-pulse">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="animate-bounce" size={24} />
              <div>
                <span className="font-bold uppercase text-lg">EMERGENCY ACTIVE</span>
                <div className="flex items-center gap-3 mt-1 text-sm">
                  {emergencyAction?.includes("DOORS") && (
                    <span className="flex items-center gap-1"><Lock size={14} /> Doors Locked</span>
                  )}
                  {emergencyAction?.includes("ALARM") && (
                    <span className="flex items-center gap-1"><Volume2 size={14} /> Alarm Active</span>
                  )}
                </div>
              </div>
            </div>
            <button 
              onClick={cancelEmergency} 
              className="px-4 py-2 bg-white text-red-600 rounded font-bold uppercase text-sm hover:bg-gray-100"
            >
              Cancel Emergency
            </button>
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {alertEvent && !emergencyTriggered && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-white animate-ping" />
              <span className="font-bold uppercase">ALERT</span>
              <span className="opacity-80">|</span>
              <span>{alertEvent.label}</span>
            </div>
            <button onClick={() => setAlertEvent(null)} className="text-white/80 hover:text-white text-sm">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Navbar */}
      <div className={`${(alertEvent || emergencyTriggered) ? 'mt-14' : ''}`}>
        <Navbar showSettings />
      </div>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Video + Timeline */}
          <div className="lg:col-span-9 space-y-4">
            <div className={`relative rounded-xl overflow-hidden border-2 transition-all ${
              emergencyTriggered ? 'border-red-500 shadow-lg shadow-red-500/30 animate-pulse' : 
              isEmergencyGesture ? 'border-amber-500 shadow-lg shadow-amber-500/20' : 'border-zinc-800'
            }`} style={{ aspectRatio: "16/9" }}>
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
              
              {/* Emergency gesture indicator with progress */}
              {isEmergencyGesture && !emergencyTriggered && (
                <div className="absolute top-4 left-4 right-4 bg-amber-500/95 text-black px-4 py-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">
                      {GESTURE_INFO[emergencySettings.emergencyGesture].icon} HOLD {GESTURE_INFO[emergencySettings.emergencyGesture].label.toUpperCase()}
                    </span>
                    <span className="font-mono text-sm">{Math.round(gestureHoldProgress * 100)}%</span>
                  </div>
                  <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-600 transition-all duration-100"
                      style={{ width: `${gestureHoldProgress * 100}%` }}
                    />
                  </div>
                  <p className="text-xs mt-1 opacity-80">Keep holding for 2 seconds to trigger emergency</p>
                </div>
              )}
              
              {status !== "running" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95">
                  <div className="w-20 h-20 rounded-full border-2 border-zinc-700 flex items-center justify-center mb-4">
                    {status === "loading" ? (
                      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className="w-10 h-10 rounded-full border-2 border-zinc-600" />
                    )}
                  </div>
                  <p className="text-zinc-400 text-sm uppercase">
                    {status === "loading" ? "Loading AI Models..." : status === "ready" ? "Ready" : "Offline"}
                  </p>
                  <p className="text-zinc-600 text-xs mt-2">
                    {status === "loading" ? "BlazeFace + MediaPipe Gesture + Gemini" : "Click START to begin"}
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
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">AI Analysis</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {aiEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
                    <p className="text-xs uppercase">Awaiting AI</p>
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
    </div>
  );
}
