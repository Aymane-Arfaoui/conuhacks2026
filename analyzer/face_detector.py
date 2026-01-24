"""
Face and eye detection using OpenCV DNN and Haar cascades.
Detects: face, eyes, nose, mouth positions.
"""
import cv2
import numpy as np
from typing import List, Dict, Any, Optional
import os

class FaceDetector:
    """Detects face landmarks using OpenCV."""
    
    def __init__(self):
        self.face_cascade = None
        self.eye_cascade = None
        
        # Try to load Haar cascades
        try:
            cv2_data = cv2.data.haarcascades
            self.face_cascade = cv2.CascadeClassifier(cv2_data + 'haarcascade_frontalface_default.xml')
            self.eye_cascade = cv2.CascadeClassifier(cv2_data + 'haarcascade_eye.xml')
            print("[Face] Haar cascade detectors loaded")
        except Exception as e:
            print(f"[Face] Failed to load cascades: {e}")
        
        # Eye state tracking
        self.eye_history: Dict[int, List[bool]] = {}  # track_id -> list of eye states
        self.eye_closed_start: Dict[int, float] = {}
        
    def detect_face_landmarks(
        self, 
        frame: np.ndarray, 
        person_bbox: List[float],
        track_id: int = 0
    ) -> Dict[str, Any]:
        """
        Detect face and eye positions within a person bounding box.
        Returns normalized coordinates relative to person bbox.
        """
        result = {
            "face": None,
            "eyes": [],
            "eyes_detected": False,
            "eyes_open": True,
            "eye_confidence": 0.0
        }
        
        if self.face_cascade is None:
            return result
        
        x, y, w, h = [int(v) for v in person_bbox]
        
        # Focus on upper body for face
        face_region_y = max(0, y)
        face_region_h = min(int(h * 0.5), frame.shape[0] - face_region_y)
        face_region_x = max(0, x)
        face_region_w = min(w, frame.shape[1] - face_region_x)
        
        if face_region_w <= 0 or face_region_h <= 0:
            return result
        
        roi = frame[face_region_y:face_region_y+face_region_h, 
                    face_region_x:face_region_x+face_region_w]
        
        if roi.size == 0:
            return result
        
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = self.face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1, 
            minNeighbors=5,
            minSize=(30, 30)
        )
        
        if len(faces) > 0:
            # Take largest face
            fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
            
            # Convert to absolute coordinates
            abs_fx = face_region_x + fx
            abs_fy = face_region_y + fy
            
            result["face"] = {
                "x": abs_fx,
                "y": abs_fy,
                "w": fw,
                "h": fh
            }
            
            # Detect eyes within face region
            face_roi = gray[fy:fy+fh, fx:fx+fw]
            if face_roi.size > 0:
                eyes = self.eye_cascade.detectMultiScale(
                    face_roi,
                    scaleFactor=1.1,
                    minNeighbors=5,
                    minSize=(15, 15)
                )
                
                for (ex, ey, ew, eh) in eyes[:2]:  # Max 2 eyes
                    result["eyes"].append({
                        "x": abs_fx + fx + ex,
                        "y": abs_fy + fy + ey,
                        "w": ew,
                        "h": eh
                    })
                
                result["eyes_detected"] = len(eyes) >= 1
                result["eyes_open"] = len(eyes) >= 1
                result["eye_confidence"] = min(1.0, len(eyes) / 2.0)
                
                # Track eye state
                self._track_eye_state(track_id, result["eyes_open"])
            
            # Estimate nose position (center of face, lower half)
            result["nose"] = {
                "x": abs_fx + fw // 2,
                "y": abs_fy + int(fh * 0.6)
            }
            
            # Estimate mouth position
            result["mouth"] = {
                "x": abs_fx + fw // 2,
                "y": abs_fy + int(fh * 0.8),
                "w": int(fw * 0.5)
            }
        
        return result
    
    def _track_eye_state(self, track_id: int, eyes_open: bool):
        """Track eye open/closed state over time."""
        if track_id not in self.eye_history:
            self.eye_history[track_id] = []
        
        self.eye_history[track_id].append(eyes_open)
        
        # Keep last 10 frames
        if len(self.eye_history[track_id]) > 10:
            self.eye_history[track_id] = self.eye_history[track_id][-10:]
    
    def get_eye_closed_duration(self, track_id: int) -> float:
        """Get how long eyes have been closed."""
        if track_id not in self.eye_history:
            return 0.0
        
        history = self.eye_history[track_id]
        if not history:
            return 0.0
        
        # Count consecutive closed frames from end
        closed_count = 0
        for state in reversed(history):
            if not state:  # eyes closed
                closed_count += 1
            else:
                break
        
        # Approximate duration (assuming ~6-8 FPS)
        return closed_count * 0.15
    
    def detect_pose_keypoints(
        self,
        frame: np.ndarray,
        person_bbox: List[float]
    ) -> Dict[str, Any]:
        """
        Estimate body keypoints from person bbox.
        Returns estimated positions for shoulders, etc.
        """
        x, y, w, h = person_bbox
        
        # Estimate keypoints based on typical body proportions
        keypoints = {
            "left_shoulder": {"x": x + w * 0.2, "y": y + h * 0.2},
            "right_shoulder": {"x": x + w * 0.8, "y": y + h * 0.2},
            "left_elbow": {"x": x + w * 0.1, "y": y + h * 0.4},
            "right_elbow": {"x": x + w * 0.9, "y": y + h * 0.4},
            "left_wrist": {"x": x + w * 0.1, "y": y + h * 0.55},
            "right_wrist": {"x": x + w * 0.9, "y": y + h * 0.55},
            "left_hip": {"x": x + w * 0.3, "y": y + h * 0.55},
            "right_hip": {"x": x + w * 0.7, "y": y + h * 0.55},
        }
        
        return keypoints

