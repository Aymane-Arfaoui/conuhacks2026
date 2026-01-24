"""
EyeWatch Analyzer - FastAPI WebSocket server for realtime video analysis.
"""
import os
import time
from typing import Optional
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from yolo import YOLODetector
from mediapipe_models import MediaPipeProcessor
from events import EventEngine
from buffer import TrackBuffer

load_dotenv()

# Global instances
yolo_detector: Optional[YOLODetector] = None
mediapipe_proc: Optional[MediaPipeProcessor] = None
event_engine: Optional[EventEngine] = None
track_buffer: Optional[TrackBuffer] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize models on startup."""
    global yolo_detector, mediapipe_proc, event_engine, track_buffer
    
    print("=" * 50)
    print("[EyeWatch] Starting analyzer...")
    print("=" * 50)
    
    model_path = os.getenv("YOLO_MODEL", "yolov8n.pt")
    yolo_detector = YOLODetector(model_path=model_path, confidence=0.5)
    mediapipe_proc = MediaPipeProcessor()
    event_engine = EventEngine()
    track_buffer = TrackBuffer(max_distance=100.0, max_age=2.0)
    
    print("")
    print("[EyeWatch] ✅ All models loaded!")
    print("")
    print("📌 DISTRESS SIGNALS:")
    print("   • Touch your head for 2+ seconds")
    print("   • System detects aggressive approaches")
    print("   • System detects drowsiness (head drooping)")
    print("   • System detects falls")
    print("")
    print("=" * 50)
    
    yield
    
    print("[EyeWatch] Shutting down...")
    if mediapipe_proc:
        mediapipe_proc.close()


app = FastAPI(
    title="EyeWatch Analyzer",
    version="2.0.0",
    lifespan=lifespan
)

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
        "features": [
            "distress_signal",
            "aggressive_approach",
            "drowsiness",
            "fall_detection",
            "harassment"
        ]
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
    print(f"\n[{timestamp}] 🔗 Client connected")
    
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
            
            # Run YOLO detection
            detections = yolo_detector.detect(frame)
            detections = track_buffer.update(detections)
            
            # Process pose for each person
            poses = []
            hands = []
            
            person_dets = [d for d in detections if d["cls"] == "person"]
            
            for det in person_dets:
                track_id = det.get("track_id", 0)
                bbox = det["bbox"]
                
                # Process pose
                pose_result = mediapipe_proc.process_pose(frame, bbox)
                if pose_result:
                    poses.append({
                        "track_id": track_id,
                        "landmarks": pose_result["landmarks"],
                        "body_angle_deg": pose_result["body_angle_deg"]
                    })
                
                # Process hands
                hand_result = mediapipe_proc.process_hands(frame, bbox, track_id)
                hands.append({
                    "track_id": track_id,
                    "left": hand_result["left"],
                    "right": hand_result["right"],
                    "gesture": hand_result["gesture"],
                    "clap_detected": hand_result.get("clap_detected", False)
                })
            
            # Run event detection
            events = event_engine.process(detections, poses, hands, track_buffer)
            
            # Log events with timestamps
            for event in events:
                severity_icon = "🔴" if event["severity"] >= 4 else "🟠" if event["severity"] >= 3 else "🟡"
                timestamp = time.strftime("%H:%M:%S")
                print(f"[{timestamp}] {severity_icon} {event['type']}: {event['label']}")
            
            fps = fps_counter.tick()
            
            response = {
                "frameId": frame_id,
                "ts": int(time.time() * 1000),
                "detections": detections,
                "pose": poses,
                "hands": hands,
                "events": events,
                "debug": {
                    "fps": round(fps, 1),
                    "persons": len(person_dets)
                }
            }
            
            await websocket.send_json(response)
            
    except WebSocketDisconnect:
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] 🔌 Client disconnected")
    except Exception as e:
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] ❌ Error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
