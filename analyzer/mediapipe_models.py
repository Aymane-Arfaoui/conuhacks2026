"""
MediaPipe pose and hand detection module.
Includes gesture detection for distress signals (clap, hands up, SOS).
"""
import math
import time
from typing import List, Dict, Any, Optional
import numpy as np

# Try to import MediaPipe
try:
import mediapipe as mp
    if hasattr(mp, 'solutions'):
        USE_LEGACY_API = True
    else:
        USE_LEGACY_API = False
except:
    USE_LEGACY_API = False


POSE_CONNECTIONS = [
    (11, 12), (11, 13), (13, 15), (12, 14), (14, 16),
    (11, 23), (12, 24), (23, 24), (23, 25), (25, 27), (24, 26), (26, 28),
]


class MediaPipeProcessor:
    """
    MediaPipe pose and hand landmark detection with gesture recognition.
    """
    
    def __init__(self):
        self.pose = None
        self.hands = None
        self.use_stub = False
        
        # Gesture detection state
        self.hand_history: Dict[int, List[Dict]] = {}  # track_id -> list of hand positions
        self.last_clap_time: Dict[int, float] = {}
        self.clap_cooldown = 2.0  # seconds between clap detections
        
        if USE_LEGACY_API:
            self._init_legacy()
        else:
            print("[MediaPipe] Legacy API not available, using stub mode")
            self.use_stub = True
        
        print("[MediaPipe] Initialized" + (" (stub mode)" if self.use_stub else ""))
    
    def _init_legacy(self):
        """Initialize using legacy solutions API."""
        import mediapipe as mp
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=4,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        print("[MediaPipe] Using legacy solutions API")
    
    def process_pose(
        self,
        frame: np.ndarray,
        person_bbox: Optional[List[float]] = None
    ) -> Optional[Dict[str, Any]]:
        """Process pose for a frame."""
        if self.use_stub or self.pose is None:
            if person_bbox:
                return self._estimate_pose_from_bbox(person_bbox)
            return None
        
        h, w = frame.shape[:2]
        offset_x, offset_y = 0, 0
        
        if person_bbox:
            x, y, bw, bh = [int(v) for v in person_bbox]
            pad = 20
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(w, x + bw + pad)
            y2 = min(h, y + bh + pad)
            frame = frame[y1:y2, x1:x2]
            offset_x, offset_y = x1, y1
            h, w = frame.shape[:2]
        
        if frame.size == 0:
            return None
        
        rgb = frame[:, :, ::-1]
        results = self.pose.process(rgb)
        
        if not results.pose_landmarks:
            return None
        
        landmarks = []
        for lm in results.pose_landmarks.landmark:
            px = lm.x * w + offset_x
            py = lm.y * h + offset_y
            landmarks.append({
                "x": round(px, 1),
                "y": round(py, 1),
                "v": round(lm.visibility, 2)
            })
        
        body_angle = self._calculate_body_angle(landmarks)
        
        return {
            "landmarks": landmarks,
            "body_angle_deg": body_angle
        }
    
    def _estimate_pose_from_bbox(self, bbox: List[float]) -> Dict[str, Any]:
        """Estimate basic pose landmarks from bounding box."""
        x, y, w, h = bbox
        landmarks = []
        
        # Head (indices 0-10)
        head_y = y + h * 0.1
        for i in range(11):
            landmarks.append({"x": x + w * 0.5, "y": head_y, "v": 0.8})
        
        # Shoulders (11, 12)
        shoulder_y = y + h * 0.2
        landmarks.append({"x": x + w * 0.3, "y": shoulder_y, "v": 0.9})
        landmarks.append({"x": x + w * 0.7, "y": shoulder_y, "v": 0.9})
        
        # Elbows (13, 14)
        elbow_y = y + h * 0.4
        landmarks.append({"x": x + w * 0.2, "y": elbow_y, "v": 0.8})
        landmarks.append({"x": x + w * 0.8, "y": elbow_y, "v": 0.8})
        
        # Wrists (15, 16)
        wrist_y = y + h * 0.55
        landmarks.append({"x": x + w * 0.15, "y": wrist_y, "v": 0.7})
        landmarks.append({"x": x + w * 0.85, "y": wrist_y, "v": 0.7})
        
        # Padding for indices 17-22
        for i in range(6):
            landmarks.append({"x": x + w * 0.5, "y": y + h * 0.5, "v": 0.3})
        
        # Hips (23, 24)
        hip_y = y + h * 0.55
        landmarks.append({"x": x + w * 0.35, "y": hip_y, "v": 0.9})
        landmarks.append({"x": x + w * 0.65, "y": hip_y, "v": 0.9})
        
        # Knees (25, 26)
        knee_y = y + h * 0.75
        landmarks.append({"x": x + w * 0.35, "y": knee_y, "v": 0.8})
        landmarks.append({"x": x + w * 0.65, "y": knee_y, "v": 0.8})
        
        # Ankles (27, 28)
        ankle_y = y + h * 0.95
        landmarks.append({"x": x + w * 0.35, "y": ankle_y, "v": 0.7})
        landmarks.append({"x": x + w * 0.65, "y": ankle_y, "v": 0.7})
        
        aspect = w / max(h, 1)
        body_angle = min(90, aspect * 60) if aspect > 1 else 0
        
        return {
            "landmarks": landmarks,
            "body_angle_deg": round(body_angle, 1)
        }
    
    def _calculate_body_angle(self, landmarks: List[Dict]) -> float:
        """Calculate body angle from vertical."""
        try:
            l_shoulder = landmarks[11]
            r_shoulder = landmarks[12]
            shoulder_mid = (
                (l_shoulder["x"] + r_shoulder["x"]) / 2,
                (l_shoulder["y"] + r_shoulder["y"]) / 2
            )
            
            l_hip = landmarks[23]
            r_hip = landmarks[24]
            hip_mid = (
                (l_hip["x"] + r_hip["x"]) / 2,
                (l_hip["y"] + r_hip["y"]) / 2
            )
            
            dx = shoulder_mid[0] - hip_mid[0]
            dy = shoulder_mid[1] - hip_mid[1]
            
            angle_rad = math.atan2(abs(dx), abs(dy))
            angle_deg = math.degrees(angle_rad)
            
            return round(angle_deg, 1)
        except (IndexError, KeyError):
            return 0.0
    
    def process_hands(
        self,
        frame: np.ndarray,
        person_bbox: Optional[List[float]] = None,
        track_id: int = 0
    ) -> Dict[str, Any]:
        """
        Process hand landmarks and detect gestures.
        """
        if self.use_stub or self.hands is None:
            # In stub mode, try to detect clap from pose wrist positions
            return {"left": [], "right": [], "gesture": "NONE", "clap_detected": False}
        
        h, w = frame.shape[:2]
        offset_x, offset_y = 0, 0
        
        if person_bbox:
            x, y, bw, bh = [int(v) for v in person_bbox]
            pad = 20
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(w, x + bw + pad)
            y2 = min(h, y + bh + pad)
            frame = frame[y1:y2, x1:x2]
            offset_x, offset_y = x1, y1
            h, w = frame.shape[:2]
        
        if frame.size == 0:
            return {"left": [], "right": [], "gesture": "NONE", "clap_detected": False}
        
        rgb = frame[:, :, ::-1]
        results = self.hands.process(rgb)
        
        left_hand = []
        right_hand = []
        left_center = None
        right_center = None
        
        if results.multi_hand_landmarks and results.multi_handedness:
            for hand_landmarks, handedness in zip(
                results.multi_hand_landmarks,
                results.multi_handedness
            ):
                label = handedness.classification[0].label
                
                landmarks = []
                sum_x, sum_y = 0, 0
                for lm in hand_landmarks.landmark:
                    px = lm.x * w + offset_x
                    py = lm.y * h + offset_y
                    landmarks.append({"x": round(px, 1), "y": round(py, 1)})
                    sum_x += px
                    sum_y += py
                
                center = (sum_x / len(landmarks), sum_y / len(landmarks))
                
                # Note: MediaPipe returns mirrored labels for selfie view
                if label == "Left":
                    right_hand = landmarks
                    right_center = center
                else:
                    left_hand = landmarks
                    left_center = center
        
        # Detect gestures
        gesture = "NONE"
        clap_detected = False
        
        # Check for clap (both hands detected and close together)
        if left_center and right_center:
            clap_detected = self._detect_clap(track_id, left_center, right_center)
            if clap_detected:
                gesture = "CLAP"
        
        # Check for hands up
        if not clap_detected:
            if self._hands_raised(left_hand, right_hand, person_bbox):
                gesture = "HANDS_UP"
        
        return {
            "left": left_hand,
            "right": right_hand,
            "gesture": gesture,
            "clap_detected": clap_detected
        }
    
    def _detect_clap(self, track_id: int, left_center: tuple, right_center: tuple) -> bool:
        """
        Detect clapping motion - hands coming together quickly.
        """
        now = time.time()
        
        # Check cooldown
        if track_id in self.last_clap_time:
            if now - self.last_clap_time[track_id] < self.clap_cooldown:
                return False
        
        # Calculate current distance between hands
        dist = math.sqrt(
            (left_center[0] - right_center[0]) ** 2 +
            (left_center[1] - right_center[1]) ** 2
        )
        
        # Initialize history if needed
        if track_id not in self.hand_history:
            self.hand_history[track_id] = []
        
        # Add current position to history
        self.hand_history[track_id].append({
            "left": left_center,
            "right": right_center,
            "dist": dist,
            "time": now
        })
        
        # Keep only recent history (last 0.5 seconds)
        self.hand_history[track_id] = [
            h for h in self.hand_history[track_id]
            if now - h["time"] < 0.5
        ]
        
        history = self.hand_history[track_id]
        
        if len(history) < 3:
            return False
        
        # Check for clap pattern:
        # 1. Hands were apart (dist > 100)
        # 2. Hands came together quickly (dist < 50)
        # 3. Distance decreased rapidly
        
        max_dist = max(h["dist"] for h in history)
        min_dist = min(h["dist"] for h in history)
        current_dist = dist
        
        # Clap detected if:
        # - Max distance was > 80 pixels
        # - Current distance is < 60 pixels
        # - Change happened within the history window
        if max_dist > 80 and current_dist < 60 and (max_dist - min_dist) > 50:
            self.last_clap_time[track_id] = now
            # Clear history after clap detected
            self.hand_history[track_id] = []
            print(f"[MediaPipe] CLAP detected for track {track_id}!")
            return True
        
        return False
    
    def _hands_raised(
        self,
        left: List[Dict],
        right: List[Dict],
        bbox: Optional[List[float]]
    ) -> bool:
        """Check if both hands are raised above shoulders."""
        if not bbox:
            return False
        
        # Shoulder level is roughly 20% down from top of bbox
        _, y, _, h = bbox
        shoulder_y = y + h * 0.25
        
        left_raised = False
        right_raised = False
        
        if left and len(left) > 0:
            # Wrist is landmark 0
            wrist_y = left[0]["y"]
            left_raised = wrist_y < shoulder_y
        
        if right and len(right) > 0:
            wrist_y = right[0]["y"]
            right_raised = wrist_y < shoulder_y
        
        return left_raised and right_raised
    
    def detect_clap_from_pose(self, pose_landmarks: List[Dict], track_id: int) -> bool:
        """
        Detect clap from pose wrist positions (fallback when hands not detected).
        Uses wrist landmarks (15=left, 16=right).
        """
        if len(pose_landmarks) < 17:
            return False
        
        now = time.time()
        
        # Check cooldown
        if track_id in self.last_clap_time:
            if now - self.last_clap_time[track_id] < self.clap_cooldown:
                return False
        
        left_wrist = pose_landmarks[15]
        right_wrist = pose_landmarks[16]
        
        if left_wrist["v"] < 0.5 or right_wrist["v"] < 0.5:
            return False
        
        left_pos = (left_wrist["x"], left_wrist["y"])
        right_pos = (right_wrist["x"], right_wrist["y"])
        
        dist = math.sqrt(
            (left_pos[0] - right_pos[0]) ** 2 +
            (left_pos[1] - right_pos[1]) ** 2
        )
        
        # Use negative track_id for pose-based detection
        pose_track_id = -track_id - 1000
        
        if pose_track_id not in self.hand_history:
            self.hand_history[pose_track_id] = []
        
        self.hand_history[pose_track_id].append({
            "left": left_pos,
            "right": right_pos,
            "dist": dist,
            "time": now
        })
        
        self.hand_history[pose_track_id] = [
            h for h in self.hand_history[pose_track_id]
            if now - h["time"] < 0.5
        ]
        
        history = self.hand_history[pose_track_id]
        
        if len(history) < 3:
            return False
        
        max_dist = max(h["dist"] for h in history)
        current_dist = dist
        
        if max_dist > 60 and current_dist < 40 and (max_dist - current_dist) > 30:
            self.last_clap_time[track_id] = now
            self.hand_history[pose_track_id] = []
            print(f"[MediaPipe] CLAP detected from pose for track {track_id}!")
            return True
        
        return False
    
    def close(self):
        """Release resources."""
        if self.pose and hasattr(self.pose, 'close'):
        self.pose.close()
        if self.hands and hasattr(self.hands, 'close'):
        self.hands.close()
