"""
Event detection - now primarily uses AI analysis.
Heuristics only as backup when AI is not available.
"""
import time
import math
from typing import List, Dict, Any, Tuple
from buffer import TrackBuffer


class EventEngine:
    """
    Event detection engine.
    Primary: AI analysis (Gemini)
    Fallback: Basic heuristics (very conservative)
    """
    
    def __init__(self):
        self.fired_events: Dict[Tuple, float] = {}
        self.event_cooldown = 10.0  # Long cooldown to prevent spam
        
        # For distress signal (hand on head)
        self.hand_on_head_start: Dict[int, float] = {}
        
        # Track positions
        self.positions: Dict[int, List[Dict]] = {}
    
    def process(
        self,
        detections: List[Dict],
        poses: List[Dict],
        hands: List[Dict],
        buffer: TrackBuffer,
        ai_events: List[Dict] = None  # Events from AI analyzer
    ) -> List[Dict[str, Any]]:
        """Process inputs and generate events."""
        events = []
        now = time.time()
        
        # 1. Use AI events if provided (primary)
        if ai_events:
            events.extend(ai_events)
        
        # 2. Check for distress signal (hand on head) - this is intentional user action
        persons = [d for d in detections if d["cls"] == "person" and d.get("track_id")]
        pose_by_track = {p["track_id"]: p for p in poses}
        
        for det in persons:
            track_id = det["track_id"]
            pose = pose_by_track.get(track_id)
            
            if pose:
                event = self._check_distress_signal(track_id, pose, det["bbox"], now)
                if event:
                    events.append(event)
        
        # 3. Check for aggressive approach between people (clear indicator)
        if len(persons) >= 2:
            approach_events = self._check_aggressive_approach(persons, now)
            events.extend(approach_events)
        
        return events
    
    def _check_distress_signal(
        self,
        track_id: int,
        pose: Dict,
        bbox: List[float],
        now: float
    ) -> Dict | None:
        """
        Detect hand on head as intentional distress signal.
        Must be sustained for 3 seconds to avoid false positives.
        """
        landmarks = pose.get("landmarks", [])
        if len(landmarks) < 17:
            return None
        
        x, y, w, h = bbox
        
        # Head region (top 25%)
        head_y_max = y + h * 0.25
        head_center_x = x + w * 0.5
        
        # Check wrists
        hand_near_head = False
        for wrist_idx in [15, 16]:
            wrist = landmarks[wrist_idx]
            if wrist["v"] < 0.4:
                continue
            
            # Hand must be clearly above shoulders and near head center
            if wrist["y"] < head_y_max and abs(wrist["x"] - head_center_x) < w * 0.4:
                hand_near_head = True
                break
        
        if hand_near_head:
            if track_id not in self.hand_on_head_start:
                self.hand_on_head_start[track_id] = now
            
            duration = now - self.hand_on_head_start[track_id]
            
            # Need 3 seconds of sustained hand on head
            if duration >= 3.0:
                if self._can_fire(track_id, "DISTRESS", now):
                    self.hand_on_head_start.pop(track_id, None)
                    return {
                        "type": "DISTRESS_SIGNAL",
                        "severity": 4,
                        "label": f"Hand on head for {duration:.0f}s - distress signal!",
                        "track_id": track_id,
                        "icon": "🆘",
                        "time": time.strftime("%H:%M:%S")
                    }
        else:
            self.hand_on_head_start.pop(track_id, None)
        
        return None
    
    def _check_aggressive_approach(
        self,
        persons: List[Dict],
        now: float
    ) -> List[Dict]:
        """
        Detect when someone is moving very fast toward another person.
        Must be very aggressive movement to trigger.
        """
        events = []
        
        for i, p1 in enumerate(persons):
            t1 = p1["track_id"]
            
            # Track positions
            x1, y1, w1, h1 = p1["bbox"]
            c1 = (x1 + w1/2, y1 + h1/2)
            
            if t1 not in self.positions:
                self.positions[t1] = []
            self.positions[t1].append({"x": c1[0], "y": c1[1], "t": now})
            self.positions[t1] = [p for p in self.positions[t1] if now - p["t"] < 1.0]
            
            for p2 in persons[i+1:]:
                t2 = p2["track_id"]
                x2, y2, w2, h2 = p2["bbox"]
                c2 = (x2 + w2/2, y2 + h2/2)
                
                # Calculate distance
                dist = math.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2)
                
                # Get movement speed toward other person
                speed = self._get_approach_speed(t1, c1, c2, now)
                
                # Must be VERY fast (>150 px/sec) and getting VERY close (<80px)
                if speed > 150 and dist < 80:
                    if self._can_fire((t1, t2), "AGGRESSIVE", now):
                        events.append({
                            "type": "AGGRESSIVE_APPROACH",
                            "severity": 4,
                            "label": f"Person #{t1} rushing toward #{t2}!",
                            "track_id": t1,
                            "icon": "⚠️",
                            "time": time.strftime("%H:%M:%S")
                        })
        
        return events
    
    def _get_approach_speed(
        self,
        track_id: int,
        current_pos: Tuple[float, float],
        target_pos: Tuple[float, float],
        now: float
    ) -> float:
        """Calculate how fast someone is approaching a target."""
        if track_id not in self.positions or len(self.positions[track_id]) < 3:
            return 0
        
        history = self.positions[track_id]
        
        # Get position from 0.5s ago
        old_pos = None
        for p in reversed(history):
            if now - p["t"] >= 0.4:
                old_pos = (p["x"], p["y"])
                break
        
        if not old_pos:
            return 0
        
        # Distance to target now vs before
        dist_now = math.sqrt((current_pos[0]-target_pos[0])**2 + (current_pos[1]-target_pos[1])**2)
        dist_old = math.sqrt((old_pos[0]-target_pos[0])**2 + (old_pos[1]-target_pos[1])**2)
        
        # Approach speed (positive = getting closer)
        return (dist_old - dist_now) / 0.5
    
    def _can_fire(self, key: Any, event_type: str, now: float) -> bool:
        """Check cooldown."""
        full_key = (key, event_type)
        last = self.fired_events.get(full_key, 0)
        if now - last >= self.event_cooldown:
            self.fired_events[full_key] = now
            return True
        return False
