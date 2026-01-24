
import React, { useRef, useEffect, useState } from 'react';
import { FilesetResolver, GestureRecognizer, DrawingUtils } from '@mediapipe/tasks-vision';
import { GestureDetection, GestureType } from '../types';
import { mapGestureResult } from '../utils/gestureUtils';

interface CameraContainerProps {
  onGestureDetected: (gesture: GestureDetection) => void;
}

const MP_VERSION = "0.10.32";

const CameraContainer: React.FC<CameraContainerProps> = ({ onGestureDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef<number | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`
        );
        
        const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
        
        recognizerRef.current = gestureRecognizer;
        setLoading(false);
      } catch (error) {
        console.error("Failed to initialize Gesture Recognizer:", error);
        setLoading(false);
      }
    };
    
    init();

    return () => {
      if (recognizerRef.current) recognizerRef.current.close();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    if (loading || !recognizerRef.current) return;

    let stream: MediaStream | null = null;
    let isMounted = true;

    const setupWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false
        });
        
        if (videoRef.current && isMounted) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (isMounted) requestRef.current = requestAnimationFrame(detectFrame);
          };
        }
      } catch (err) {
        console.error("Webcam error:", err);
      }
    };

    const detectFrame = () => {
      if (!isMounted || !videoRef.current || !recognizerRef.current || !canvasRef.current) return;

      if (videoRef.current.readyState >= 2) {
        const results = recognizerRef.current.recognizeForVideo(videoRef.current, performance.now());

        // Process global gesture for timeline
        const gesture = mapGestureResult(results);
        onGestureDetected(gesture);

        const canvasCtx = canvasRef.current.getContext('2d');
        if (canvasCtx) {
          const width = canvasRef.current.width;
          const height = canvasRef.current.height;
          
          canvasCtx.save();
          canvasCtx.clearRect(0, 0, width, height);

          // Note: Mirroring is handled via CSS scale-x-[-1] on the canvas element itself
          const drawingUtils = new DrawingUtils(canvasCtx);
          
          if (results.landmarks) {
            results.landmarks.forEach((landmarks, index) => {
              // 1. Draw Hand Skeleton
              drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
                color: index === 0 ? "#6366f1" : "#10b981",
                lineWidth: 4
              });
              drawingUtils.drawLandmarks(landmarks, {
                color: "#ffffff",
                lineWidth: 1,
                radius: 4
              });

              // 2. Draw Floating Bubble (Indicator)
              if (results.gestures && results.gestures[index]) {
                const handGesture = results.gestures[index][0];
                if (handGesture.score > 0.4) {
                  const wrist = landmarks[0];
                  const posX = wrist.x * width;
                  const posY = wrist.y * height - 40;

                  canvasCtx.save();
                  canvasCtx.translate(posX, posY);
                  
                  // Bubble Style: Glowing circle without text
                  const bubbleColor = index === 0 ? "rgba(99, 102, 241, 0.9)" : "rgba(16, 185, 129, 0.9)";
                  
                  // Outer Glow
                  canvasCtx.beginPath();
                  canvasCtx.arc(0, 0, 12, 0, Math.PI * 2);
                  canvasCtx.fillStyle = bubbleColor;
                  canvasCtx.shadowBlur = 15;
                  canvasCtx.shadowColor = bubbleColor;
                  canvasCtx.fill();

                  // Inner Highlight
                  canvasCtx.beginPath();
                  canvasCtx.arc(0, 0, 6, 0, Math.PI * 2);
                  canvasCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
                  canvasCtx.fill();
                  
                  canvasCtx.restore();
                }
              }
            });
          }
          canvasCtx.restore();
        }
      }
      requestRef.current = requestAnimationFrame(detectFrame);
    };

    setupWebcam();

    return () => {
      isMounted = false;
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loading, onGestureDetected]);

  return (
    <div className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-xl">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-indigo-400 font-bold uppercase tracking-widest text-sm animate-pulse">Vision Intelligence Active</p>
        </div>
      )}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="w-full h-full object-cover scale-x-[-1]" 
      />
      <canvas 
        ref={canvasRef} 
        width={1280} 
        height={720} 
        className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-x-[-1]" 
      />
    </div>
  );
};

export default CameraContainer;
