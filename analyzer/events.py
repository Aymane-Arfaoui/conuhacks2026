"""
Event detection engine for security alerts.
Advanced detection: aggressive approach, drowsiness, distress signals.
"""
import time
import math
from typing import List, Dict, Any, Tuple, Optional
from buffer import TrackBuffer, TrackState


class EventEngine:
    """
    Detects security events based on tracking data.
    
    Events:
    - DISTRESS_SIGNAL: Person signaling for help (head touch)
    - AGGRESSIVE_APPROACH: Someone moving fast toward another person
    - DROWSY: Person's head drooping (potential fainting)
    - FALL: Person on the ground
    - HARASSMENT: Prolonged aggressive proximity
    """
    
    def __init__(self):
        self.fired_events: Dict[Tuple, float] = {}
        self.event_cooldown = 4.0
        
        # Position tracking
        self.positions: Dict[int, List[Dict]] = {}
        self.head_positions: Dict[int, List[Dict]] = {}
        
        # Head touch tracking
        self.head_touch_start: Dict[int, float] = {}
        
        # Drowsy detection
        self.head_droop_start: Dict[int, float] = {}
    
    def process(
        self,
        detections: List[Dict],
        poses: List[Dict],
        hands: List[Dict],
        buffer: TrackBuffer
    ) -> List[Dict[str, Any]]:
        """Process all inputs and generate events."""
        events = []
        now = time.time()
        
        persons = [d for d in detections if d["cls"] == "person" and d.get("track_id")]
        pose_by_track = {p["track_id"]: p for p in poses}
        
        # Update position history for all persons
        for det in persons:
            self._update_position(det, now)
        
        # Check each person
        for det in persons:
            track_id = det["track_id"]
            bbox = det["bbox"]
            pose = pose_by_track.get(track_id)
            
            # 1. Head touch distress signal
            event = self._check_head_touch(track_id, pose, bbox, now)
            if event:
                events.append(event)
            
            # 2. Drowsy/head droop detection
            event = self._check_drowsy(track_id, pose, bbox, now)
            if event:
                events.append(event)
            
            # 3. Fall detection (lying on ground)
            event = self._check_fall(track_id, bbox, now)
            if event:
                events.append(event)
        
        # 4. Check interactions between people
        if len(persons) >= 2:
            # Aggressive approach
            events.extend(self._check_aggressive_approach(persons, now))
            # Harassment
            events.extend(self._check_harassment(persons, now))
        
        return events
    
    def _update_position(self, det: Dict, now: float):
        """Track position history for a detection."""
        track_id = det["track_id"]
        x, y, w, h = det["bbox"]
        center = (x + w/2, y + h/2)
        
        if track_id not in self.positions:
            self.positions[track_id] = []
        
        self.positions[track_id].append({
            "x": center[0],
            "y": center[1],
            "w": w,
            "h": h,
            "t": now
        })
        
        # Keep 2 seconds of history
        self.positions[track_id] = [
            p for p in self.positions[track_id] 
            if now - p["t"] < 2.0
        ]
    
    def _check_head_touch(
        self,
        track_id: int,
        pose: Optional[Dict],
        bbox: List[float],
        now: float
    ) -> Optional[Dict]:
        """Detect hand touching head as distress signal."""
        if not pose or not pose.get("landmarks"):
            return None
        
        lm = pose["landmarks"]
        if len(lm) < 17:
            return None
        
        x, y, w, h = bbox
        
        # Head region
        head_y_max = y + h * 0.3
        head_center_x = x + w * 0.5
        
        # Check wrists (15=left, 16=right)
        hand_near_head = False
        for wrist_idx in [15, 16]:
            wrist = lm[wrist_idx]
            if wrist["v"] < 0.3:
                continue
            
            # Is wrist near head?
            dist_to_head_x = abs(wrist["x"] - head_center_x)
            if wrist["y"] < head_y_max + 30 and dist_to_head_x < w * 0.6:
                hand_near_head = True
                break
        
        if hand_near_head:
            if track_id not in self.head_touch_start:
                self.head_touch_start[track_id] = now
            
            duration = now - self.head_touch_start[track_id]
            
            if duration >= 2.0:  # 2 seconds of touching head
                if self._can_fire(track_id, "DISTRESS", now):
                    self.head_touch_start.pop(track_id, None)
                    return {
                        "type": "DISTRESS_SIGNAL",
                        "severity": 4,
                        "label": f"Hand on head for {duration:.1f}s - possible distress signal",
                        "track_id": track_id,
                        "icon": "🆘",
                        "time": self._format_time(now)
                    }
        else:
            self.head_touch_start.pop(track_id, None)
        
        return None
    
    def _check_drowsy(
        self,
        track_id: int,
        pose: Optional[Dict],
        bbox: List[float],
        now: float
    ) -> Optional[Dict]:
        """Detect head drooping (drowsiness/about to faint)."""
        if not pose:
            return None
        
        x, y, w, h = bbox
        lm = pose.get("landmarks", [])
        
        # Check if head is drooping by looking at nose position relative to shoulders
        if len(lm) < 12:
            return None
        
        nose = lm[0] if len(lm) > 0 else None
        l_shoulder = lm[11] if len(lm) > 11 else None
        r_shoulder = lm[12] if len(lm) > 12 else None
        
        if not nose or not l_shoulder or not r_shoulder:
            return None
        
        # Calculate shoulder midpoint
        shoulder_y = (l_shoulder["y"] + r_shoulder["y"]) / 2
        
        # If nose is close to or below shoulder level, head is drooping
        head_droop = nose["y"] > shoulder_y - 20
        
        # Also check body angle - if tilted forward significantly
        body_angle = pose.get("body_angle_deg", 0)
        tilted_forward = body_angle > 40
        
        is_drowsy = head_droop or tilted_forward
        
        if is_drowsy:
            if track_id not in self.head_droop_start:
                self.head_droop_start[track_id] = now
            
            duration = now - self.head_droop_start[track_id]
            
            if duration >= 2.5:  # Head drooping for 2.5 seconds
                if self._can_fire(track_id, "DROWSY", now):
                    return {
                        "type": "DROWSY",
                        "severity": 3,
                        "label": f"Head drooping for {duration:.1f}s - person may be drowsy or unwell",
                        "track_id": track_id,
                        "icon": "😴",
                        "time": self._format_time(now)
                    }
        else:
            self.head_droop_start.pop(track_id, None)
        
        return None
    
    def _check_fall(
        self,
        track_id: int,
        bbox: List[float],
        now: float
    ) -> Optional[Dict]:
        """Detect if person has fallen (very wide bbox near bottom of frame)."""
        x, y, w, h = bbox
        
        aspect = w / max(h, 1)
        
        # Must be very horizontal (lying down)
        if aspect < 2.0:
            return None
        
        # Must be in lower portion of frame
        if y + h < 300:  # Not near bottom
            return None
        
        if self._can_fire(track_id, "FALL", now):
            return {
                "type": "FALL",
                "severity": 4,
                "label": "Person appears to have fallen - immediate attention needed",
                "track_id": track_id,
                "icon": "🚨",
                "time": self._format_time(now)
            }
        
        return None
    
    def _check_aggressive_approach(
        self,
        persons: List[Dict],
        now: float
    ) -> List[Dict]:
        """Detect when someone is moving aggressively toward another person."""
        events = []
        
        for i, p1 in enumerate(persons):
            for p2 in persons[i+1:]:
                t1, t2 = p1["track_id"], p2["track_id"]
                
                # Get movement data
                speed1, direction1 = self._get_movement(t1, now)
                speed2, direction2 = self._get_movement(t2, now)
                
                # Get positions
                x1, y1, w1, h1 = p1["bbox"]
                x2, y2, w2, h2 = p2["bbox"]
                c1 = (x1 + w1/2, y1 + h1/2)
                c2 = (x2 + w2/2, y2 + h2/2)
                
                dist = math.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2)
                
                # Check if p1 is moving fast toward p2
                if speed1 > 50:  # Moving fast
                    # Direction toward p2
                    to_p2 = math.atan2(c2[1]-c1[1], c2[0]-c1[0])
                    angle_diff = abs(direction1 - to_p2)
                    if angle_diff > math.pi:
                        angle_diff = 2*math.pi - angle_diff
                    
                    # Moving toward p2 and getting close
                    if angle_diff < 0.8 and dist < 200:
                        if self._can_fire((t1, t2), "AGGRESSIVE", now):
                            events.append({
                                "type": "AGGRESSIVE_APPROACH",
                                "severity": 4,
                                "label": f"Person #{t1} moving aggressively toward #{t2} - potential threat!",
                                "track_id": t1,
                                "track_id_2": t2,
                                "icon": "⚠️",
                                "time": self._format_time(now)
                            })
                
                # Check if p2 is moving fast toward p1
                if speed2 > 50:
                    to_p1 = math.atan2(c1[1]-c2[1], c1[0]-c2[0])
                    angle_diff = abs(direction2 - to_p1)
                    if angle_diff > math.pi:
                        angle_diff = 2*math.pi - angle_diff
                    
                    if angle_diff < 0.8 and dist < 200:
                        if self._can_fire((t2, t1), "AGGRESSIVE", now):
                            events.append({
                                "type": "AGGRESSIVE_APPROACH",
                                "severity": 4,
                                "label": f"Person #{t2} moving aggressively toward #{t1} - potential threat!",
                                "track_id": t2,
                                "track_id_2": t1,
                                "icon": "⚠️",
                                "time": self._format_time(now)
                            })
        
        return events
    
    def _check_harassment(
        self,
        persons: List[Dict],
        now: float
    ) -> List[Dict]:
        """Detect prolonged close proximity (harassment)."""
        events = []
        
        for i, p1 in enumerate(persons):
            for p2 in persons[i+1:]:
                t1, t2 = p1["track_id"], p2["track_id"]
                
                x1, y1, w1, h1 = p1["bbox"]
                x2, y2, w2, h2 = p2["bbox"]
                c1 = (x1 + w1/2, y1 + h1/2)
                c2 = (x2 + w2/2, y2 + h2/2)
                
                dist = math.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2)
                
                # Very close proximity
                if dist < 100:
                    key = (min(t1, t2), max(t1, t2), "proximity")
                    
                    if key not in self.fired_events:
                        self.fired_events[key] = now
                    
                    duration = now - self.fired_events[key]
                    
                    if duration > 5.0:  # 5 seconds of close proximity
                        if self._can_fire((t1, t2), "HARASSMENT", now):
                            events.append({
                                "type": "HARASSMENT",
                                "severity": 3,
                                "label": f"Persons #{t1} and #{t2} in close proximity for {duration:.0f}s",
                                "track_id": t1,
                                "track_id_2": t2,
                                "icon": "👥",
                                "time": self._format_time(now)
                            })
                else:
                    # Reset timer if they move apart
                    key = (min(t1, t2), max(t1, t2), "proximity")
                    self.fired_events.pop(key, None)
        
        return events
    
    def _get_movement(self, track_id: int, now: float) -> Tuple[float, float]:
        """Get speed and direction of movement for a track."""
        if track_id not in self.positions:
            return 0.0, 0.0
        
        history = self.positions[track_id]
        if len(history) < 3:
            return 0.0, 0.0
        
        # Get recent and older positions
        recent = [p for p in history if now - p["t"] < 0.3]
        older = [p for p in history if 0.3 <= now - p["t"] < 0.6]
        
        if not recent or not older:
            return 0.0, 0.0
        
        # Average positions
        rx = sum(p["x"] for p in recent) / len(recent)
        ry = sum(p["y"] for p in recent) / len(recent)
        ox = sum(p["x"] for p in older) / len(older)
        oy = sum(p["y"] for p in older) / len(older)
        
        dx = rx - ox
        dy = ry - oy
        
        speed = math.sqrt(dx**2 + dy**2) / 0.3  # pixels per second
        direction = math.atan2(dy, dx)
        
        return speed, direction
    
    def _format_time(self, timestamp: float) -> str:
        """Format timestamp for display."""
        return time.strftime("%H:%M:%S", time.localtime(timestamp))
    
    def _can_fire(self, key: Any, event_type: str, now: float) -> bool:
        """Check cooldown for event."""
        full_key = (key, event_type)
        last = self.fired_events.get(full_key, 0)
        
        if now - last >= self.event_cooldown:
            self.fired_events[full_key] = now
            return True
        return False
