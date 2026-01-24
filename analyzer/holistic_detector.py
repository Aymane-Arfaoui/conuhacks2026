"""
Holistic body detection using MediaPipe.
Detects face, pose, and hands together for better accuracy.
"""
import cv2
import numpy as np
from typing import Dict, Any, List, Optional
import time

try:
    import mediapipe as mp
    MP_AVAILABLE = True
except ImportError:
    MP_AVAILABLE = False
    print("[Holistic] MediaPipe not available")


class HolisticDetector:
    """
    Uses MediaPipe Holistic for combined face, pose, and hand detection.
    Much more accurate than separate detectors.
    """
    
    def __init__(self):
        self.holistic = None
        self.mp_holistic = None
        self.mp_drawing = None
        
        # Tracking
        self.eye_closed_frames: Dict[int, int] = {}
        self.hand_on_head_start: Dict[int, float] = {}
        
        if MP_AVAILABLE:
            try:
                self.mp_holistic = mp.solutions.holistic
                self.mp_drawing = mp.solutions.drawing_utils
                self.mp_drawing_styles = mp.solutions.drawing_styles
                
                self.holistic = self.mp_holistic.Holistic(
                    static_image_mode=False,
                    model_complexity=1,
                    smooth_landmarks=True,
                    enable_segmentation=False,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
                print("[Holistic] MediaPipe Holistic initialized")
            except Exception as e:
                print(f"[Holistic] Init failed: {e}")
        else:
            print("[Holistic] Running in fallback mode")
    
    def process(
        self,
        frame: np.ndarray,
        person_bbox: List[float],
        track_id: int = 0
    ) -> Dict[str, Any]:
        """
        Process frame and return all detections.
        """
        h, w = frame.shape[:2]
        bx, by, bw, bh = [int(v) for v in person_bbox]
        
        result = {
            "track_id": track_id,
            "face": None,
            "face_landmarks": [],
            "eyes": [],
            "eyes_open": True,
            "eye_closed_duration": 0.0,
            "nose": None,
            "mouth": None,
            "left_hand": None,
            "right_hand": None,
            "left_hand_landmarks": [],
            "right_hand_landmarks": [],
            "left_gesture": "none",
            "right_gesture": "none",
            "pose_landmarks": [],
            "shoulders": None,
            "hand_on_head": False,
            "hand_on_head_duration": 0.0
        }
        
        if self.holistic is None:
            return self._fallback_detection(person_bbox, track_id)
        
        # Crop to person region with padding
        pad = 30
        x1 = max(0, bx - pad)
        y1 = max(0, by - pad)
        x2 = min(w, bx + bw + pad)
        y2 = min(h, by + bh + pad)
        
        roi = frame[y1:y2, x1:x2]
        if roi.size == 0:
            return result
        
        roi_h, roi_w = roi.shape[:2]
        
        # Process with MediaPipe
        rgb = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        mp_result = self.holistic.process(rgb)
        
        # Extract face landmarks
        if mp_result.face_landmarks:
            face_lms = []
            xs, ys = [], []
            
            for lm in mp_result.face_landmarks.landmark:
                px = int(lm.x * roi_w) + x1
                py = int(lm.y * roi_h) + y1
                face_lms.append({"x": px, "y": py})
                xs.append(px)
                ys.append(py)
            
            if xs and ys:
                result["face"] = {
                    "x": min(xs),
                    "y": min(ys),
                    "w": max(xs) - min(xs),
                    "h": max(ys) - min(ys)
                }
                result["face_landmarks"] = face_lms
                
                # Eye landmarks (indices for MediaPipe face mesh)
                # Left eye: 33, 133, 160, 144, 145, 153
                # Right eye: 362, 263, 387, 373, 374, 380
                left_eye_idx = [33, 133, 160, 144, 145, 153]
                right_eye_idx = [362, 263, 387, 373, 374, 380]
                
                if len(face_lms) > 380:
                    # Get eye regions
                    left_eye_pts = [face_lms[i] for i in left_eye_idx]
                    right_eye_pts = [face_lms[i] for i in right_eye_idx]
                    
                    # Eye bounding boxes
                    for eye_pts in [left_eye_pts, right_eye_pts]:
                        ex = [p["x"] for p in eye_pts]
                        ey = [p["y"] for p in eye_pts]
                        result["eyes"].append({
                            "x": min(ex) - 5,
                            "y": min(ey) - 5,
                            "w": max(ex) - min(ex) + 10,
                            "h": max(ey) - min(ey) + 10
                        })
                    
                    # Check if eyes open (eye aspect ratio)
                    result["eyes_open"] = self._check_eyes_open(mp_result.face_landmarks.landmark)
                
                # Nose (index 1)
                if len(face_lms) > 1:
                    result["nose"] = face_lms[1]
                
                # Mouth (indices 13, 14 for lips)
                if len(face_lms) > 14:
                    mouth_pts = [face_lms[13], face_lms[14]]
                    result["mouth"] = {
                        "x": (mouth_pts[0]["x"] + mouth_pts[1]["x"]) // 2,
                        "y": (mouth_pts[0]["y"] + mouth_pts[1]["y"]) // 2,
                        "w": abs(mouth_pts[0]["x"] - mouth_pts[1]["x"]) + 20
                    }
        
        # Eye closed tracking
        if not result["eyes_open"]:
            if track_id not in self.eye_closed_frames:
                self.eye_closed_frames[track_id] = 0
            self.eye_closed_frames[track_id] += 1
            result["eye_closed_duration"] = self.eye_closed_frames[track_id] * 0.1
        else:
            self.eye_closed_frames[track_id] = 0
            result["eye_closed_duration"] = 0.0
        
        # Extract pose landmarks
        if mp_result.pose_landmarks:
            pose_lms = []
            for lm in mp_result.pose_landmarks.landmark:
                px = int(lm.x * roi_w) + x1
                py = int(lm.y * roi_h) + y1
                pose_lms.append({"x": px, "y": py, "v": lm.visibility})
            
            result["pose_landmarks"] = pose_lms
            
            # Shoulders (indices 11, 12)
            if len(pose_lms) > 12:
                result["shoulders"] = {
                    "left": pose_lms[11],
                    "right": pose_lms[12]
                }
        
        # Extract left hand
        if mp_result.left_hand_landmarks:
            hand_lms, bbox = self._extract_hand(mp_result.left_hand_landmarks, roi_w, roi_h, x1, y1)
            result["left_hand"] = bbox
            result["left_hand_landmarks"] = hand_lms
            result["left_gesture"] = self._detect_gesture(hand_lms)
        
        # Extract right hand
        if mp_result.right_hand_landmarks:
            hand_lms, bbox = self._extract_hand(mp_result.right_hand_landmarks, roi_w, roi_h, x1, y1)
            result["right_hand"] = bbox
            result["right_hand_landmarks"] = hand_lms
            result["right_gesture"] = self._detect_gesture(hand_lms)
        
        # Check hand on head
        result["hand_on_head"], result["hand_on_head_duration"] = self._check_hand_on_head(
            result, track_id
        )
        
        return result
    
    def _extract_hand(self, hand_landmarks, roi_w, roi_h, offset_x, offset_y):
        """Extract hand landmarks and bounding box."""
        landmarks = []
        xs, ys = [], []
        
        for lm in hand_landmarks.landmark:
            px = int(lm.x * roi_w) + offset_x
            py = int(lm.y * roi_h) + offset_y
            landmarks.append({"x": px, "y": py})
            xs.append(px)
            ys.append(py)
        
        bbox = None
        if xs and ys:
            pad = 15
            bbox = {
                "x": min(xs) - pad,
                "y": min(ys) - pad,
                "w": max(xs) - min(xs) + pad * 2,
                "h": max(ys) - min(ys) + pad * 2
            }
        
        return landmarks, bbox
    
    def _detect_gesture(self, landmarks: List[Dict]) -> str:
        """Detect hand gesture from landmarks."""
        if len(landmarks) < 21:
            return "none"
        
        # Fingertip indices: thumb=4, index=8, middle=12, ring=16, pinky=20
        # PIP (middle joint) indices: thumb=3, index=6, middle=10, ring=14, pinky=18
        
        tips = [4, 8, 12, 16, 20]
        pips = [3, 6, 10, 14, 18]
        
        fingers_up = 0
        
        # Thumb (check x distance from palm)
        if landmarks[4]["x"] < landmarks[3]["x"] - 10 or landmarks[4]["x"] > landmarks[3]["x"] + 10:
            fingers_up += 1
        
        # Other fingers (tip above pip = extended)
        for i in range(1, 5):
            if landmarks[tips[i]]["y"] < landmarks[pips[i]]["y"] - 15:
                fingers_up += 1
        
        if fingers_up >= 4:
            return "open_palm"
        elif fingers_up == 0:
            return "fist"
        elif fingers_up == 1 and landmarks[8]["y"] < landmarks[6]["y"] - 20:
            return "pointing"
        elif fingers_up == 2:
            return "peace"
        elif fingers_up == 3:
            return "three"
        else:
            return "partial"
    
    def _check_eyes_open(self, face_landmarks) -> bool:
        """Check if eyes are open using eye aspect ratio."""
        # Simplified check using vertical distance
        try:
            # Left eye vertical landmarks
            left_top = face_landmarks[159].y
            left_bottom = face_landmarks[145].y
            left_ratio = abs(left_bottom - left_top)
            
            # Right eye vertical landmarks  
            right_top = face_landmarks[386].y
            right_bottom = face_landmarks[374].y
            right_ratio = abs(right_bottom - right_top)
            
            # If eye height is very small, eyes are closed
            avg_ratio = (left_ratio + right_ratio) / 2
            return avg_ratio > 0.01  # Threshold
        except:
            return True
    
    def _check_hand_on_head(self, result: Dict, track_id: int) -> tuple:
        """Check if hand is on/near head."""
        face = result.get("face")
        if not face:
            self.hand_on_head_start.pop(track_id, None)
            return False, 0.0
        
        face_center_y = face["y"] + face["h"] / 2
        face_top = face["y"]
        face_x_min = face["x"] - face["w"] * 0.5
        face_x_max = face["x"] + face["w"] * 1.5
        
        hands = []
        if result["left_hand"]:
            hands.append(result["left_hand"])
        if result["right_hand"]:
            hands.append(result["right_hand"])
        
        for hand in hands:
            hand_center_x = hand["x"] + hand["w"] / 2
            hand_center_y = hand["y"] + hand["h"] / 2
            
            # Check if hand is near/above face
            if (face_x_min < hand_center_x < face_x_max and
                hand_center_y < face_center_y + 50):
                
                now = time.time()
                if track_id not in self.hand_on_head_start:
                    self.hand_on_head_start[track_id] = now
                
                duration = now - self.hand_on_head_start[track_id]
                return True, duration
        
        self.hand_on_head_start.pop(track_id, None)
        return False, 0.0
    
    def _fallback_detection(self, person_bbox: List[float], track_id: int) -> Dict:
        """Fallback when MediaPipe not available."""
        x, y, w, h = person_bbox
        
        return {
            "track_id": track_id,
            "face": {"x": int(x + w*0.25), "y": int(y), "w": int(w*0.5), "h": int(h*0.3)},
            "face_landmarks": [],
            "eyes": [],
            "eyes_open": True,
            "eye_closed_duration": 0.0,
            "nose": {"x": int(x + w*0.5), "y": int(y + h*0.15)},
            "mouth": {"x": int(x + w*0.5), "y": int(y + h*0.22), "w": int(w*0.2)},
            "left_hand": None,
            "right_hand": None,
            "left_hand_landmarks": [],
            "right_hand_landmarks": [],
            "left_gesture": "none",
            "right_gesture": "none",
            "pose_landmarks": [],
            "shoulders": {
                "left": {"x": int(x + w*0.2), "y": int(y + h*0.25)},
                "right": {"x": int(x + w*0.8), "y": int(y + h*0.25)}
            },
            "hand_on_head": False,
            "hand_on_head_duration": 0.0
        }
    
    def close(self):
        """Clean up."""
        if self.holistic:
            self.holistic.close()

