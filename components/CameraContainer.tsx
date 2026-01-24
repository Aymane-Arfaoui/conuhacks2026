
import React, { useRef, useEffect, useState } from 'react';
import { FilesetResolver, GestureRecognizer, DrawingUtils } from '@mediapipe/tasks-vision';
import { GestureDetection } from '../types';
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
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<number | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      try {
        console.log('Initializing MediaPipe Gesture Recognizer...');
        const vision = await FilesetResolver.forVisionTasks(
          `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`
        );
        
        console.log('Creating GestureRecognizer...');
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
        console.log('GestureRecognizer initialized successfully');
      } catch (error) {
        console.error("Failed to initialize Gesture Recognizer:", error);
        setError("Failed to load gesture recognition model. Please refresh and try again.");
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
    // Wait for recognizer to be ready
    if (!recognizerRef.current) return;

    let stream: MediaStream | null = null;
    let isMounted = true;

    const setupWebcam = async () => {
      try {
        console.log('Requesting camera access...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false
        });
        
        console.log('Camera access granted');
        if (videoRef.current && isMounted) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            console.log('Video metadata loaded, starting detection');
            if (isMounted) requestRef.current = requestAnimationFrame(detectFrame);
          };
        }
      } catch (err) {
        console.error("Webcam error:", err);
        setError(`Camera access denied: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
            for (const landmarks of results.landmarks) {
                drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
                    color: "#00FF00",
                    lineWidth: 5
                });
                drawingUtils.drawLandmarks(landmarks, {
                    color: "#FF0000",
                    lineWidth: 2
                });
            }
          }
          canvasCtx.restore();
        }
      }
      
      requestRef.current = requestAnimationFrame(detectFrame);
    };

    setupWebcam();

    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [onGestureDetected]); // Dependency onGestureDetected is usually stable

  return (
    <div className="relative w-full h-full bg-black">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
          <div className="text-center space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent"></div>
            <p className="text-slate-400 text-sm">Loading gesture recognition model...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/20 z-10">
          <div className="text-center space-y-3 p-6 bg-slate-900 rounded-lg border border-red-500/50">
            <p className="text-red-400 font-medium">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )}
      
      {/* Video is mirrored for natural feel */}
      <video 
        ref={videoRef} 
        className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" 
        autoPlay 
        playsInline 
        muted 
      />
      
      {/* Canvas overlays landmarks on top of mirrored video */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
        width={1280}
        height={720}
      />
    </div>
  );
};

export default CameraContainer;
