"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { analyzeFrame, DetectionEvent } from "../actions/detect";
import { FilesetResolver, GestureRecognizer, FaceLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
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
import { Settings, Lock, Volume2, Shield, FolderOpen, AlertTriangle, X, AlertCircle } from "lucide-react";

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
  const emergencyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emergencyTriggeredRef = useRef(false);
  const [gestureHoldProgress, setGestureHoldProgress] = useState(0);
  
  // Models
  const faceModelRef = useRef<FaceLandmarker | null>(null);
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
      
      // Allow next sound after this one finishes
      setTimeout(() => {
        isPlayingRef.current = false;
      }, 400);
      
    } catch (err) {
      isPlayingRef.current = false;
      console.error("[ALARM] Failed to play:", err);
    }
  }, []);

  // Trigger emergency response
  const triggerEmergency = useCallback(() => {
    if (emergencyTriggeredRef.current) return;
    
    console.log("[EMERGENCY] *** TRIGGERING EMERGENCY ***");
    console.log("[EMERGENCY] Response type:", emergencySettings.emergencyResponse);
    
    emergencyTriggeredRef.current = true;
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
  }, [emergencySettings, playAlarmSound]);

  // Cancel emergency
  const cancelEmergency = useCallback(() => {
    console.log("[EMERGENCY] Canceling emergency response");
    emergencyTriggeredRef.current = false;
    setEmergencyTriggered(false);
    setEmergencyAction(null);
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    if (emergencyTimeoutRef.current) {
      clearTimeout(emergencyTimeoutRef.current);
      emergencyTimeoutRef.current = null;
    }
    emergencyGestureStartRef.current = null;
    setGestureHoldProgress(0);
  }, []);

  // Auto-stop emergency after 5 seconds
  useEffect(() => {
    if (emergencyTriggered) {
      if (emergencyTimeoutRef.current) {
        clearTimeout(emergencyTimeoutRef.current);
      }
      emergencyTimeoutRef.current = setTimeout(() => {
        cancelEmergency();
      }, 5000);
    }
    
    return () => {
      if (emergencyTimeoutRef.current) {
        clearTimeout(emergencyTimeoutRef.current);
      }
    };
  }, [emergencyTriggered, cancelEmergency]);

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
      const vision = await FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`
      );

      faceModelRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numFaces: 4,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false
      });
      console.log("FaceLandmarker loaded");
      
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
    
    // If emergency is triggered and gesture changes away, cancel emergency
    if (emergencyTriggered && !isEmergencyGestureDetected) {
      cancelEmergency();
      return;
    }
    
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

    // FACE DETECTION (MediaPipe FaceLandmarker)
    if (faceModelRef.current) {
      try {
        const faceResults = faceModelRef.current.detectForVideo(video, now);
        detectedFaces = faceResults.faceLandmarks?.length || 0;

        if (faceResults.faceLandmarks) {
          const drawingUtils = new DrawingUtils(ctx);
          
          faceResults.faceLandmarks.forEach((landmarks) => {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-vw, 0);

            // Draw face mesh tesselation
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
              color: "#22c55e30",
              lineWidth: 1
            });
            
            // Draw face contours
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {
              color: "#22c55e",
              lineWidth: 2
            });
            
            // Draw eye contours
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, {
              color: "#06b6d4",
              lineWidth: 2
            });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {
              color: "#06b6d4",
              lineWidth: 2
            });
            
            // Draw eyebrows
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, {
              color: "#a855f7",
              lineWidth: 2
            });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, {
              color: "#a855f7",
              lineWidth: 2
            });
            
            // Draw lips
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, {
              color: "#ec4899",
              lineWidth: 2
            });
            
            // Draw iris
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, {
              color: "#3b82f6",
              lineWidth: 1
            });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, {
              color: "#3b82f6",
              lineWidth: 1
            });

            ctx.restore();
          });
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
  }, [fps, aiAnalyzing, mapGesture, addLog, emergencySettings, triggerEmergency, emergencyTriggered, cancelEmergency]);

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
      if (faceModelRef.current) faceModelRef.current.close();
      stopCamera();
    };
  }, [loadModels, stopCamera]);

  const isEmergencyGesture = currentGesture && currentGesture.type === emergencySettings.emergencyGesture;

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
      <div>
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
                    {status === "loading" ? "MediaPipe Face Mesh + Gesture + Gemini" : "Click START to begin"}
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
