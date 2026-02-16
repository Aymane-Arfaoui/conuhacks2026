/* eslint-disable prefer-const */
"use client";

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { FilesetResolver, GestureRecognizer, DrawingUtils } from "@mediapipe/tasks-vision";
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";
import { analyzeFrame, analyzeSuspiciousBehavior, DetectionEvent } from "@/app/actions/detect";
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

const MP_VERSION = "0.10.32";

type Status = "offline" | "loading" | "ready" | "running";
type VideoMode = "camera" | "file";

interface VideoCanvasProps {
  videoUrl?: string; // If provided, plays video file; otherwise uses camera
  onStatusChange?: (status: Status) => void;
  onGestureDetected?: (gesture: GestureDetection) => void;
  onLogEntry?: (log: LogEntry) => void;
  onAIEvent?: (event: AIEvent) => void;
  onAlertEvent?: (event: AIEvent | null) => void;
  onFpsUpdate?: (fps: number) => void;
  onFaceCountUpdate?: (count: number) => void;
  onHandCountUpdate?: (count: number) => void;
  onGestureHoldProgress?: (progress: number) => void;
  emergencySettings?: EmergencySettings;
  onEmergencyTriggered?: () => void;
  onEmergencyCanceled?: () => void;
}

export interface VideoCanvasHandle {
  toggle: () => Promise<void>;
  getStatus: () => Status;
  cancelEmergency: () => void;
}

const VideoCanvas = forwardRef<VideoCanvasHandle, VideoCanvasProps>(({
  videoUrl,
  onStatusChange,
  onGestureDetected,
  onLogEntry,
  onAIEvent,
  onAlertEvent,
  onFpsUpdate,
  onFaceCountUpdate,
  onHandCountUpdate,
  onGestureHoldProgress,
  emergencySettings = DEFAULT_EMERGENCY_SETTINGS,
  onEmergencyTriggered,
  onEmergencyCanceled,
}, ref) => {
  const mode: VideoMode = videoUrl ? "file" : "camera";
  
  const [status, setStatus] = useState<Status>("offline");
  const [fps, setFps] = useState(0);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [emergencyTriggered, setEmergencyTriggered] = useState(false);
  const [gestureHoldProgress, setGestureHoldProgress] = useState(0);
  const [currentGesture, setCurrentGesture] = useState<GestureDetection | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const aiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const emergencyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emergencyTriggeredRef = useRef(false);
  const runningRef = useRef(false);
  
  // Models
  const faceModelRef = useRef<blazeface.BlazeFaceModel | null>(null);
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  
  // Tracking
  const lastDetectionRef = useRef(0);
  const fpsCounterRef = useRef<number[]>([]);
  const lastLogTimeRef = useRef(0);
  const emergencyGestureStartRef = useRef<number | null>(null);
  const aiErrorCountRef = useRef(0);
  const isPlayingRef = useRef(false);

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // Notify parent of FPS changes
  useEffect(() => {
    onFpsUpdate?.(fps);
  }, [fps, onFpsUpdate]);

  // Initialize audio context
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // Play alarm sound
  const playAlarmSound = useCallback(() => {
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
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.25;
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
      
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
    
    emergencyTriggeredRef.current = true;
    setEmergencyTriggered(true);
    setGestureHoldProgress(0);
    onEmergencyTriggered?.();
    
    const response = emergencySettings.emergencyResponse;
    
    if (response === EmergencyResponse.SOUND_ALARM || response === EmergencyResponse.BOTH) {
      playAlarmSound();
      alarmIntervalRef.current = setInterval(playAlarmSound, 500);
    }
    
    // Add emergency event
    const emergencyEvent: AIEvent = {
      type: "EMERGENCY",
      severity: 5,
      label: `EMERGENCY TRIGGERED`,
      time: new Date().toLocaleTimeString("en-US", { hour12: false }),
      timestamp: Date.now(),
      isDangerous: true
    };
    onAIEvent?.(emergencyEvent);
  }, [emergencySettings, playAlarmSound, onEmergencyTriggered, onAIEvent]);

  // Cancel emergency
  const cancelEmergency = useCallback(() => {
    console.log("[EMERGENCY] Canceling emergency response");
    emergencyTriggeredRef.current = false;
    setEmergencyTriggered(false);
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
    onEmergencyCanceled?.();
  }, [onEmergencyCanceled]);

  // Auto-stop emergency after 30 seconds
  useEffect(() => {
    if (emergencyTriggered) {
      if (emergencyTimeoutRef.current) {
        clearTimeout(emergencyTimeoutRef.current);
      }
      emergencyTimeoutRef.current = setTimeout(() => {
        cancelEmergency();
      }, 30000);
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

    const newEntry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      message: gesture.label,
      type: gesture.type,
      timestamp: new Date(),
      isDangerous: gesture.type === emergencySettings.emergencyGesture
    };
    onLogEntry?.(newEntry);
  }, [emergencySettings.emergencyGesture, onLogEntry]);

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

  // Start video file playback
  const startVideoFile = useCallback(async () => {
    if (!videoRef.current || !videoUrl) return false;
    
    try {
      initAudio();
      videoRef.current.src = videoUrl;
      videoRef.current.loop = true;
      await videoRef.current.play();
      return true;
    } catch (err) {
      console.error("Failed to start video:", err);
      return false;
    }
  }, [videoUrl, initAudio]);

  // Stop video/camera
  const stopVideo = useCallback(() => {
    if (mode === "camera") {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      if (mode === "camera") {
        videoRef.current.srcObject = null;
      }
    }
  }, [mode]);

  // AI Analysis (Gemini) - uses different prompts for camera vs CCTV
  const runAIAnalysis = useCallback(async () => {
    if (aiErrorCountRef.current >= 3) return;
    
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
      // Use suspicious behavior detection for video files (CCTV), regular detection for camera
      const result = mode === "file" 
        ? await analyzeSuspiciousBehavior(canvas.toDataURL("image/jpeg", 0.7))
        : await analyzeFrame(canvas.toDataURL("image/jpeg", 0.7));
      
      aiErrorCountRef.current = 0;
      if (result.events?.length > 0) {
        const events: AIEvent[] = result.events.map((e: DetectionEvent) => ({
          type: e.isDangerous ? "AI ALERT" : "AI",
          severity: e.severity || (e.isDangerous ? 3 : 1),
          label: e.description,
          time: new Date().toLocaleTimeString("en-US", { hour12: false }),
          timestamp: Date.now(),
          isDangerous: e.isDangerous
        }));
        events.forEach(ev => onAIEvent?.(ev));
        const dangerous = events.find(e => e.isDangerous);
        if (dangerous) onAlertEvent?.(dangerous);
      }
    } catch {
      aiErrorCountRef.current++;
      if (aiErrorCountRef.current >= 3) {
        console.log("[AI] Disabled due to quota/errors");
      }
    }
    setAiAnalyzing(false);
  }, [mode, onAIEvent, onAlertEvent]);

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

  // Detection loop function (stored in ref to avoid dependency issues)
  const detectionLoopRef = useRef<(() => void) | undefined>(undefined);
  
  // Main detection loop
  const runDetectionLoop = useCallback(() => {
    if (!runningRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(() => detectionLoopRef.current?.());
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    if (now - lastDetectionRef.current < 50) {
      animationRef.current = requestAnimationFrame(() => detectionLoopRef.current?.());
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
    
    // Mirror for camera mode, normal for video file
    if (mode === "camera") {
      ctx.scale(-1, 1);
      ctx.drawImage(video, -vw, 0, vw, vh);
    } else {
      ctx.drawImage(video, 0, 0, vw, vh);
    }
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
            if (mode === "camera") {
              ctx.scale(-1, 1);
              ctx.translate(-vw, 0);
            }

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
      gesture.confidence > 0.5;
    
    if (!emergencyTriggeredRef.current) {
      if (isEmergencyGestureDetected) {
        if (!emergencyGestureStartRef.current) {
          emergencyGestureStartRef.current = now;
          console.log("[EMERGENCY] Started detecting:", gesture.type, "confidence:", gesture.confidence);
        }
        
        const holdTime = now - emergencyGestureStartRef.current;
        const progress = Math.min(holdTime / 2000, 1);
        setGestureHoldProgress(progress);
        
        if (holdTime > 2000) {
          console.log("[EMERGENCY] Hold time reached, triggering!");
          triggerEmergency();
        }
      } else {
        if (emergencyGestureStartRef.current) {
          console.log("[EMERGENCY] Gesture lost");
        }
        emergencyGestureStartRef.current = null;
        setGestureHoldProgress(0);
      }
    }

    onFaceCountUpdate?.(detectedFaces);
    onHandCountUpdate?.(detectedHands);
    setCurrentGesture(gesture);
    onGestureDetected?.(gesture);
    addLog(gesture);

    // HUD
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = emergencyTriggeredRef.current ? "#ef4444" : "#22c55e";
    ctx.fillText(emergencyTriggeredRef.current ? "EMERGENCY" : mode === "camera" ? "LIVE" : "PLAYBACK", 12, 24);
    ctx.font = "11px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText(`${vw}x${vh} @ ${fpsCounterRef.current.length} FPS`, 12, 42);
    ctx.fillText(`Hands: ${detectedHands}`, 12, 58);
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
    ctx.fillText(mode === "camera" ? "REC" : "▶", vw - 26, 64);
    ctx.textAlign = "left";

    animationRef.current = requestAnimationFrame(() => detectionLoopRef.current?.());
  }, [mode, mapGesture, addLog, emergencySettings, triggerEmergency, aiAnalyzing, onFaceCountUpdate, onHandCountUpdate, onGestureDetected]);

  // Keep ref updated with latest function
  useEffect(() => {
    detectionLoopRef.current = runDetectionLoop;
  }, [runDetectionLoop]);

  // Start/Stop toggle
  const toggle = useCallback(async () => {
    if (status === "running") {
      runningRef.current = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
      cancelEmergency();
      stopVideo();
      setStatus("ready");
      setCurrentGesture(null);
    } else if (status === "ready") {
      const ok = mode === "camera" ? await startCamera() : await startVideoFile();
      if (!ok) return alert(mode === "camera" ? "Camera access denied" : "Failed to load video");
      setStatus("running");
      runningRef.current = true;
      
      setTimeout(() => {
        detectionLoopRef.current?.();
        runAIAnalysis();
        aiIntervalRef.current = setInterval(runAIAnalysis, 3000);
      }, 500);
    }
  }, [status, mode, startCamera, startVideoFile, stopVideo, runAIAnalysis, cancelEmergency]);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    toggle,
    getStatus: () => status,
    cancelEmergency,
  }), [toggle, status, cancelEmergency]);

  // Load on mount
  useEffect(() => {
    loadModels();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
      if (gestureRecognizerRef.current) gestureRecognizerRef.current.close();
      stopVideo();
    };
  }, [loadModels, stopVideo]);

  const isEmergencyGesture = emergencySettings.enabled && currentGesture && currentGesture.type === emergencySettings.emergencyGesture && currentGesture.confidence > 0.5;

  return (
    <div className="relative w-full h-full">
      <div className={`relative rounded-xl overflow-hidden border-2 transition-all ${
        emergencyTriggered ? 'border-red-500 shadow-lg shadow-red-500/30 animate-pulse' : 
        isEmergencyGesture ? 'border-amber-500 shadow-lg shadow-amber-500/20' : 'border-zinc-800'
      }`} style={{ aspectRatio: "16/9" }}>
        <video 
          ref={videoRef} 
          className="absolute inset-0 w-full h-full object-cover opacity-0" 
          playsInline 
          muted 
        />
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
              {status === "loading" ? "BlazeFace + MediaPipe Gesture + Gemini" : "Click START to begin"}
            </p>
          </div>
        )}
      </div>

      {/* Emergency gesture progress indicator */}
      {isEmergencyGesture && !emergencyTriggered && gestureHoldProgress > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-amber-500/90 rounded-lg p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-black">
              {GESTURE_INFO[emergencySettings.emergencyGesture].icon} HOLD FOR EMERGENCY
            </span>
            <span className="text-xs font-mono text-black">{Math.round(gestureHoldProgress * 100)}%</span>
          </div>
          <div className="h-2 bg-amber-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 transition-all duration-100"
              style={{ width: `${gestureHoldProgress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

VideoCanvas.displayName = "VideoCanvas";

export default VideoCanvas;
