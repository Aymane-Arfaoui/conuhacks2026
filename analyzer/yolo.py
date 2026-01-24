"""
YOLOv8 detection module.
"""
import os
from typing import List, Dict, Any
import numpy as np
from ultralytics import YOLO


# Classes we care about (COCO dataset indices)
RELEVANT_CLASSES = {
    0: "person",
    24: "backpack",
    25: "umbrella",
    26: "handbag",
    27: "tie",
    28: "suitcase",
    39: "bottle",
    41: "cup",
    63: "laptop",
    64: "mouse",
    65: "remote",
    66: "keyboard",
    67: "cell phone",
}


class YOLODetector:
    """YOLOv8 object detector."""
    
    def __init__(self, model_path: str = "yolov8n.pt", confidence: float = 0.5):
        """
        Initialize YOLO detector.
        
        Args:
            model_path: Path to YOLO model weights (downloads if not found)
            confidence: Minimum confidence threshold
        """
        self.model = YOLO(model_path)
        self.confidence = confidence
        print(f"[YOLO] Loaded model: {model_path}")
    
    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Run detection on a frame.
        
        Args:
            frame: BGR image as numpy array
            
        Returns:
            List of detection dicts with cls, conf, bbox
        """
        results = self.model(frame, verbose=False, conf=self.confidence)
        
        detections = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
                
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                
                # Filter to relevant classes
                if cls_id not in RELEVANT_CLASSES:
                    continue
                
                conf = float(boxes.conf[i].item())
                
                # Get bbox in [x, y, w, h] format
                xyxy = boxes.xyxy[i].cpu().numpy()
                x1, y1, x2, y2 = xyxy
                bbox = [float(x1), float(y1), float(x2 - x1), float(y2 - y1)]
                
                detections.append({
                    "cls": RELEVANT_CLASSES[cls_id],
                    "conf": round(conf, 2),
                    "bbox": bbox
                })
        
        return detections
    
    def detect_persons(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Run detection and return only person detections.
        
        Args:
            frame: BGR image as numpy array
            
        Returns:
            List of person detection dicts
        """
        all_dets = self.detect(frame)
        return [d for d in all_dets if d["cls"] == "person"]

