"""
EyeWatch Analyzer - AI-powered surveillance with face/pose detection.
"""
import os
import time
import base64
from typing import Optional
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from yolo import YOLODetector
from face_detector import FaceDetector
from events import EventEngine
from buffer import TrackBuffer
from ai_analyzer import AIAnalyzer

load_dotenv()

# Global instances
yolo_detector: Optional[YOLODetector] = None
face_detector: Optional[FaceDetector] = None
event_engine: Optional[EventEngine] = None
track_buffer: Optional[TrackBuffer] = None
ai_analyzer: Optional[AIAnalyzer] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize models on startup."""
    global yolo_detector, face_detector, event_engine, track_buffer, ai_analyzer
    
    print("")
    print("=" * 60)
    print("  EYEWATCH - AI Surveillance System")
    print("=" * 60)
    print("")
    
    # Initialize YOLO
    model_path = os.getenv("YOLO_MODEL", "yolov8n.pt")
    yolo_detector = YOLODetector(model_path=model_path, confidence=0.5)
    
    # Initialize Face Detector
    face_detector = FaceDetector()
    
    # Initialize event engine
    event_engine = EventEngine()
    
    # Initialize tracker
    track_buffer = TrackBuffer(max_distance=100.0, max_age=2.0)
    
    # Initialize AI analyzer (Gemini)
    ai_analyzer = AIAnalyzer()
    
    print("")
    print("  DETECTION MODES:")
    if ai_analyzer.is_available():
        print("  [+] AI Analysis (Gemini) - ACTIVE")
    else:
        print("  [-] AI Analysis - Set GEMINI_API_KEY in .env")
    print("  [+] Face Detection - Eyes, Nose, Mouth")
    print("  [+] Body Tracking - Shoulders, Pose")
    print("  [+] Eye State Monitoring - Open/Closed")
    print("")
    print("=" * 60)
    print("")
    
    yield
    
    print("[EyeWatch] Shutting down...")


app = FastAPI(title="EyeWatch AI", version="4.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "ai_available": ai_analyzer.is_available() if ai_analyzer else False,
    }


class FPSCounter:
    def __init__(self):
        self.times = []
    
    def tick(self) -> float:
        now = time.time()
        self.times.append(now)
        self.times = [t for t in self.times if now - t < 2.0]
        if len(self.times) < 2:
            return 0.0
        return len(self.times) / (self.times[-1] - self.times[0] + 0.001)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] Client connected")
    
    fps_counter = FPSCounter()
    frame_id = 0
    
    try:
        while True:
            data = await websocket.receive_bytes()
            
            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                continue
            
            frame_id += 1
            
            # 1. YOLO detection
            detections = yolo_detector.detect(frame)
            detections = track_buffer.update(detections)
            
            person_dets = [d for d in detections if d["cls"] == "person"]
            
            # 2. Face and body detection for each person
            faces = []
            for det in person_dets:
                track_id = det.get("track_id", 0)
                bbox = det["bbox"]
                
                # Detect face landmarks
                face_data = face_detector.detect_face_landmarks(frame, bbox, track_id)
                
                # Get pose keypoints
                pose_data = face_detector.detect_pose_keypoints(frame, bbox)
                
                # Check eye closed duration
                eye_closed_duration = face_detector.get_eye_closed_duration(track_id)
                
                faces.append({
                    "track_id": track_id,
                    "face": face_data.get("face"),
                    "eyes": face_data.get("eyes", []),
                    "eyes_open": face_data.get("eyes_open", True),
                    "eye_closed_duration": eye_closed_duration,
                    "nose": face_data.get("nose"),
                    "mouth": face_data.get("mouth"),
                    "keypoints": pose_data
                })
            
            # 3. AI Analysis
            ai_events = []
            if ai_analyzer:
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                frame_base64 = base64.b64encode(buffer).decode('utf-8')
                ai_events = ai_analyzer.analyze_frame(frame_base64, detections)
            
            # 4. Eye-based alerts (eyes closed too long)
            eye_events = []
            for face_info in faces:
                if face_info["eye_closed_duration"] > 2.0:  # Eyes closed > 2 seconds
                    eye_events.append({
                        "type": "WARNING",
                        "severity": 3,
                        "label": f"Eyes closed for {face_info['eye_closed_duration']:.1f}s - subject may be drowsy",
                        "time": time.strftime("%H:%M:%S"),
                        "track_id": face_info["track_id"]
                    })
            
            # 5. Combine all events
            events = ai_events + eye_events
            
            # Log high severity events
            for event in events:
                if event.get("severity", 1) >= 3:
                    ts = time.strftime("%H:%M:%S")
                    print(f"[{ts}] >> {event['type']}: {event['label']}")
            
            fps = fps_counter.tick()
            
            response = {
                "frameId": frame_id,
                "ts": int(time.time() * 1000),
                "detections": detections,
                "faces": faces,
                "events": events,
                "aiActive": ai_analyzer.is_available() if ai_analyzer else False,
                "debug": {
                    "fps": round(fps, 1),
                    "persons": len(person_dets)
                }
            }
            
            await websocket.send_json(response)
            
    except WebSocketDisconnect:
        ts = time.strftime("%H:%M:%S")
        print(f"[{ts}] Client disconnected")
    except Exception as e:
        ts = time.strftime("%H:%M:%S")
        print(f"[{ts}] Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
