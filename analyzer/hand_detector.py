"""
Hand detection and gesture recognition using MediaPipe.
Detects: hands, fingers, gestures (open palm, fist, hand on head, etc.)
"""
import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
import time

try:
    import mediapipe as mp
    MP_AVAILABLE = True
except ImportError:
    MP_AVAILABLE = False
    print("[Hands] MediaPipe not available")


class HandDetector:
    """Detects hands and recognizes gestures."""
    
    def __init__(self):
        self.hands = None
        self.mp_hands = None
        self.mp_drawing = None
        
        # Gesture tracking
        self.hand_on_head_start: Dict[int, float] = {}
        self.gesture_cooldown: Dict[str, float] = {}
        
        if MP_AVAILABLE:
            try:
                self.mp_hands = mp.solutions.hands
                self.mp_drawing = mp.solutions.drawing_utils
                self.hands = self.mp_hands.Hands(
                    static_image_mode=False,
                    max_num_hands=2,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
                print("[Hands] MediaPipe Hands initialized")
            except Exception as e:
                print(f"[Hands] MediaPipe init failed: {e}")
                self.hands = None
        else:
            print("[Hands] Using fallback detection")
    
    def detect_hands(
        self,
        frame: np.ndarray,
        person_bbox: Optional[List[float]] = None,
        face_bbox: Optional[Dict] = None,
        track_id: int = 0
    ) -> Dict[str, Any]:
        """
        Detect hands and analyze gestures.
        Returns hand positions, landmarks, and detected gestures.
        """
        h, w = frame.shape[:2]
        
        result = {
            "hands": [],
            "gestures": [],
            "hand_on_head": False,
            "open_palm": False,
            "fist": False,
            "waving": False,
            "pointing": False
        }
        
        if self.hands is None:
            # Fallback: estimate hand positions from person bbox
            if person_bbox:
                result["hands"] = self._estimate_hands_from_bbox(person_bbox)
            return result
        
        # Convert to RGB for MediaPipe
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        
        # Process hands
        mp_result = self.hands.process(rgb)
        
        if mp_result.multi_hand_landmarks:
            for hand_idx, hand_landmarks in enumerate(mp_result.multi_hand_landmarks):
                # Get handedness (left/right)
                handedness = "unknown"
                if mp_result.multi_handedness:
                    handedness = mp_result.multi_handedness[hand_idx].classification[0].label.lower()
                
                # Extract landmarks
                landmarks = []
                xs, ys = [], []
                
                for lm in hand_landmarks.landmark:
                    px = int(lm.x * w)
                    py = int(lm.y * h)
                    landmarks.append({"x": px, "y": py, "z": lm.z})
                    xs.append(px)
                    ys.append(py)
                
                # Calculate bounding box
                x_min, x_max = min(xs), max(xs)
                y_min, y_max = min(ys), max(ys)
                padding = 20
                
                hand_data = {
                    "bbox": {
                        "x": max(0, x_min - padding),
                        "y": max(0, y_min - padding),
                        "w": x_max - x_min + padding * 2,
                        "h": y_max - y_min + padding * 2
                    },
                    "center": {
                        "x": (x_min + x_max) // 2,
                        "y": (y_min + y_max) // 2
                    },
                    "landmarks": landmarks,
                    "handedness": handedness,
                    "wrist": landmarks[0] if landmarks else None,
                    "thumb_tip": landmarks[4] if len(landmarks) > 4 else None,
                    "index_tip": landmarks[8] if len(landmarks) > 8 else None,
                    "middle_tip": landmarks[12] if len(landmarks) > 12 else None,
                    "ring_tip": landmarks[16] if len(landmarks) > 16 else None,
                    "pinky_tip": landmarks[20] if len(landmarks) > 20 else None,
                }
                
                # Analyze gesture for this hand
                gesture = self._analyze_gesture(landmarks)
                hand_data["gesture"] = gesture
                
                result["hands"].append(hand_data)
                
                # Check for open palm
                if gesture == "open_palm":
                    result["open_palm"] = True
                    if "open_palm" not in result["gestures"]:
                        result["gestures"].append("open_palm")
                
                # Check for fist
                if gesture == "fist":
                    result["fist"] = True
                    if "fist" not in result["gestures"]:
                        result["gestures"].append("fist")
                
                # Check for pointing
                if gesture == "pointing":
                    result["pointing"] = True
                    if "pointing" not in result["gestures"]:
                        result["gestures"].append("pointing")
        
        # Check if hand is on/near head
        if face_bbox and result["hands"]:
            result["hand_on_head"] = self._check_hand_on_head(
                result["hands"], face_bbox, track_id
            )
            if result["hand_on_head"]:
                result["gestures"].append("hand_on_head")
        
        return result
    
    def _analyze_gesture(self, landmarks: List[Dict]) -> str:
        """Analyze hand landmarks to determine gesture."""
        if len(landmarks) < 21:
            return "unknown"
        
        # Finger tip indices: thumb=4, index=8, middle=12, ring=16, pinky=20
        # Finger MCP (knuckle) indices: thumb=2, index=5, middle=9, ring=13, pinky=17
        
        tips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]]
        mcps = [landmarks[2], landmarks[5], landmarks[9], landmarks[13], landmarks[17]]
        
        # Count extended fingers (tip above MCP for fingers, to the side for thumb)
        extended = 0
        
        # Thumb (check if extended to the side)
        if abs(tips[0]["x"] - mcps[0]["x"]) > 30:
            extended += 1
        
        # Other fingers (tip above MCP = extended)
        for i in range(1, 5):
            if tips[i]["y"] < mcps[i]["y"] - 10:  # Tip above knuckle
                extended += 1
        
        # Determine gesture
        if extended >= 4:
            return "open_palm"
        elif extended <= 1:
            return "fist"
        elif extended == 1 and tips[1]["y"] < mcps[1]["y"] - 20:
            return "pointing"
        elif extended == 2:
            return "peace"
        else:
            return "partial"
    
    def _check_hand_on_head(
        self,
        hands: List[Dict],
        face_bbox: Dict,
        track_id: int
    ) -> bool:
        """Check if any hand is positioned on/near the head."""
        if not face_bbox:
            return False
        
        face_x = face_bbox.get("x", 0)
        face_y = face_bbox.get("y", 0)
        face_w = face_bbox.get("w", 0)
        face_h = face_bbox.get("h", 0)
        
        # Expand head region slightly
        head_region = {
            "x_min": face_x - face_w * 0.3,
            "x_max": face_x + face_w * 1.3,
            "y_min": face_y - face_h * 0.5,
            "y_max": face_y + face_h * 0.3
        }
        
        for hand in hands:
            center = hand.get("center", {})
            hx = center.get("x", 0)
            hy = center.get("y", 0)
            
            # Check if hand center is in head region
            if (head_region["x_min"] < hx < head_region["x_max"] and
                head_region["y_min"] < hy < head_region["y_max"]):
                
                # Track duration
                now = time.time()
                if track_id not in self.hand_on_head_start:
                    self.hand_on_head_start[track_id] = now
                
                duration = now - self.hand_on_head_start[track_id]
                return duration > 0.5  # Must be on head for 0.5s
        
        # Reset if no hand on head
        self.hand_on_head_start.pop(track_id, None)
        return False
    
    def _estimate_hands_from_bbox(self, person_bbox: List[float]) -> List[Dict]:
        """Estimate hand positions when MediaPipe not available."""
        x, y, w, h = person_bbox
        
        # Estimate left and right hand positions
        hands = [
            {
                "bbox": {
                    "x": int(x + w * 0.05),
                    "y": int(y + h * 0.45),
                    "w": int(w * 0.15),
                    "h": int(w * 0.15)
                },
                "center": {"x": int(x + w * 0.12), "y": int(y + h * 0.52)},
                "handedness": "left",
                "gesture": "unknown",
                "landmarks": []
            },
            {
                "bbox": {
                    "x": int(x + w * 0.80),
                    "y": int(y + h * 0.45),
                    "w": int(w * 0.15),
                    "h": int(w * 0.15)
                },
                "center": {"x": int(x + w * 0.88), "y": int(y + h * 0.52)},
                "handedness": "right",
                "gesture": "unknown",
                "landmarks": []
            }
        ]
        
        return hands
    
    def get_hand_on_head_duration(self, track_id: int) -> float:
        """Get how long hand has been on head."""
        if track_id in self.hand_on_head_start:
            return time.time() - self.hand_on_head_start[track_id]
        return 0.0
    
    def close(self):
        """Clean up resources."""
        if self.hands:
            self.hands.close()

