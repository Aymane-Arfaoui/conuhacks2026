"""
EyeWatch Analyzer - AI surveillance with holistic body detection.
Uses MediaPipe Holistic for accurate face, pose, and hand detection.
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
from holistic_detector import HolisticDetector
from buffer import TrackBuffer

load_dotenv()

# Global instances
yolo_detector: Optional[YOLODetector] = None
holistic_detector: Optional[HolisticDetector] = None
track_buffer: Optional[TrackBuffer] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize models on startup."""
    global yolo_detector, holistic_detector, track_buffer
    
    print("")
    print("=" * 60)
    print("  EYEWATCH - AI Surveillance System v5.0")
    print("=" * 60)
    print("")
    
    # Initialize YOLO
    model_path = os.getenv("YOLO_MODEL", "yolov8n.pt")
    yolo_detector = YOLODetector(model_path=model_path, confidence=0.5)
    
    # Initialize Holistic Detector (face + pose + hands)
    holistic_detector = HolisticDetector()
    
    # Initialize tracker
    track_buffer = TrackBuffer(max_distance=100.0, max_age=2.0)
    
    print("")
    print("  FEATURES:")
    print("  [+] Person Detection (YOLO)")
    print("  [+] Face Mesh (468 landmarks)")
    print("  [+] Eye Tracking (open/closed)")
    print("  [+] Hand Detection (21 landmarks each)")
    print("  [+] Pose Estimation (33 landmarks)")
    print("  [+] Gesture Recognition:")
    print("      - Open Palm, Fist, Pointing, Peace")
    print("      - Hand on Head (distress signal)")
    print("")
    print("=" * 60)
    print("")
    
    yield
    
    print("[EyeWatch] Shutting down...")
    if holistic_detector:
        holistic_detector.close()


app = FastAPI(title="EyeWatch AI", version="5.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "5.0.0"}


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
            
            # 1. YOLO person detection
            detections = yolo_detector.detect(frame)
            detections = track_buffer.update(detections)
            
            person_dets = [d for d in detections if d["cls"] == "person"]
            
            # 2. Holistic detection for each person
            bodies = []
            all_gestures = []
            events = []
            
            for det in person_dets:
                track_id = det.get("track_id", 0)
                bbox = det["bbox"]
                
                # Get holistic data (face, pose, hands)
                body_data = holistic_detector.process(frame, bbox, track_id)
                bodies.append(body_data)
                
                # Collect gestures
                if body_data["left_gesture"] != "none":
                    if body_data["left_gesture"] not in all_gestures:
                        all_gestures.append(body_data["left_gesture"])
                if body_data["right_gesture"] != "none":
                    if body_data["right_gesture"] not in all_gestures:
                        all_gestures.append(body_data["right_gesture"])
                
                # Generate events
                if body_data["hand_on_head"] and body_data["hand_on_head_duration"] > 1.5:
                    events.append({
                        "type": "DISTRESS",
                        "severity": 3,
                        "label": f"Hand on head ({body_data['hand_on_head_duration']:.1f}s) - distress signal",
                        "time": time.strftime("%H:%M:%S"),
                        "track_id": track_id
                    })
                
                if body_data["eye_closed_duration"] > 2.0:
                    events.append({
                        "type": "WARNING",
                        "severity": 3,
                        "label": f"Eyes closed ({body_data['eye_closed_duration']:.1f}s) - drowsiness detected",
                        "time": time.strftime("%H:%M:%S"),
                        "track_id": track_id
                })
            
            # Log events
            for event in events:
                ts = time.strftime("%H:%M:%S")
                print(f"[{ts}] >> {event['type']}: {event['label']}")
            
            fps = fps_counter.tick()
            
            # Count hands
            hand_count = sum(1 for b in bodies if b["left_hand"]) + sum(1 for b in bodies if b["right_hand"])
            
            response = {
                "frameId": frame_id,
                "ts": int(time.time() * 1000),
                "detections": detections,
                "bodies": bodies,
                "gestures": all_gestures,
                "events": events,
                "debug": {
                    "fps": round(fps, 1),
                    "persons": len(person_dets),
                    "hands": hand_count
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
