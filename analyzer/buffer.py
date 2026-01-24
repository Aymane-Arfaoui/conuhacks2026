"""
Ring buffer for tracking history and event detection.
"""
from collections import deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import time


@dataclass
class TrackState:
    """State for a single tracked object."""
    track_id: int
    bbox: List[float]  # [x, y, w, h]
    center: tuple  # (cx, cy)
    first_seen: float
    last_seen: float
    in_zone_since: Optional[float] = None
    fall_detected_at: Optional[float] = None
    history: deque = field(default_factory=lambda: deque(maxlen=30))


class TrackBuffer:
    """
    Manages track states across frames for event detection.
    Simple nearest-center tracker for hackathon purposes.
    """
    
    def __init__(self, max_distance: float = 100.0, max_age: float = 2.0):
        self.tracks: Dict[int, TrackState] = {}
        self.next_id = 1
        self.max_distance = max_distance
        self.max_age = max_age  # seconds before track is removed
    
    def update(self, detections: List[dict]) -> List[dict]:
        """
        Update tracks with new detections.
        Returns detections with assigned track_ids.
        """
        now = time.time()
        
        # Remove stale tracks
        stale_ids = [
            tid for tid, track in self.tracks.items()
            if now - track.last_seen > self.max_age
        ]
        for tid in stale_ids:
            del self.tracks[tid]
        
        # Calculate centers for new detections
        det_centers = []
        for det in detections:
            x, y, w, h = det["bbox"]
            cx, cy = x + w / 2, y + h / 2
            det_centers.append((cx, cy))
        
        # Match detections to existing tracks (greedy nearest)
        matched = set()
        results = []
        
        for i, det in enumerate(detections):
            cx, cy = det_centers[i]
            best_track_id = None
            best_dist = float("inf")
            
            for tid, track in self.tracks.items():
                if tid in matched:
                    continue
                tcx, tcy = track.center
                dist = ((cx - tcx) ** 2 + (cy - tcy) ** 2) ** 0.5
                if dist < best_dist and dist < self.max_distance:
                    best_dist = dist
                    best_track_id = tid
            
            if best_track_id is not None:
                # Update existing track
                matched.add(best_track_id)
                track = self.tracks[best_track_id]
                track.bbox = det["bbox"]
                track.center = (cx, cy)
                track.last_seen = now
                track.history.append({
                    "bbox": det["bbox"],
                    "center": (cx, cy),
                    "ts": now
                })
                det["track_id"] = best_track_id
            else:
                # Create new track
                new_id = self.next_id
                self.next_id += 1
                self.tracks[new_id] = TrackState(
                    track_id=new_id,
                    bbox=det["bbox"],
                    center=(cx, cy),
                    first_seen=now,
                    last_seen=now,
                    history=deque([{
                        "bbox": det["bbox"],
                        "center": (cx, cy),
                        "ts": now
                    }], maxlen=30)
                )
                det["track_id"] = new_id
            
            results.append(det)
        
        return results
    
    def get_track(self, track_id: int) -> Optional[TrackState]:
        return self.tracks.get(track_id)
    
    def set_in_zone(self, track_id: int, in_zone: bool):
        """Mark track as in/out of restricted zone."""
        track = self.tracks.get(track_id)
        if track:
            if in_zone and track.in_zone_since is None:
                track.in_zone_since = time.time()
            elif not in_zone:
                track.in_zone_since = None
    
    def set_fall_detected(self, track_id: int):
        """Mark track as having a fall detected."""
        track = self.tracks.get(track_id)
        if track and track.fall_detected_at is None:
            track.fall_detected_at = time.time()
    
    def clear_fall(self, track_id: int):
        """Clear fall state for track."""
        track = self.tracks.get(track_id)
        if track:
            track.fall_detected_at = None

