"""
AI Frame Analyzer using Google Gemini.
Actually analyzes what's happening in the frame instead of heuristics.
"""
import os
import base64
import json
import time
from typing import List, Dict, Any, Optional

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("[AI] google-generativeai not installed")


class AIAnalyzer:
    """
    Uses Gemini AI to analyze video frames for dangerous situations.
    """
    
    def __init__(self):
        self.model = None
        self.last_analysis_time = 0
        self.analysis_interval = 2.0  # Analyze every 2 seconds
        self.last_events: List[Dict] = []
        
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        
        if GEMINI_AVAILABLE and api_key:
            try:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('gemini-1.5-flash')
                print("[AI] ✅ Gemini AI initialized successfully")
            except Exception as e:
                print(f"[AI] ❌ Failed to initialize Gemini: {e}")
                self.model = None
        else:
            if not GEMINI_AVAILABLE:
                print("[AI] ⚠️ Gemini not available - install google-generativeai")
            if not api_key:
                print("[AI] ⚠️ No GEMINI_API_KEY or GOOGLE_API_KEY found in environment")
    
    def analyze_frame(self, frame_base64: str, detections: List[Dict]) -> List[Dict[str, Any]]:
        """
        Analyze a frame using Gemini AI.
        
        Args:
            frame_base64: Base64 encoded JPEG image
            detections: YOLO detections for context
            
        Returns:
            List of events detected
        """
        now = time.time()
        
        # Rate limit - only analyze every N seconds
        if now - self.last_analysis_time < self.analysis_interval:
            return self.last_events
        
        self.last_analysis_time = now
        
        if not self.model:
            return []
        
        try:
            # Build context from detections
            person_count = len([d for d in detections if d["cls"] == "person"])
            
            prompt = f"""You are a security monitoring AI analyzing a camera frame.

CONTEXT: {person_count} person(s) detected in frame.

Analyze this image and identify any concerning situations.

Mark "isDangerous": true ONLY if you CLEARLY see:
- FAINTING: Person actively collapsing, going limp, losing consciousness
- FALLING: Person in the act of falling or on the ground unexpectedly
- MEDICAL DISTRESS: Person clutching chest/head in obvious pain
- FIGHTING: Physical altercation between people
- VIOLENCE: Aggressive threatening behavior
- DISTRESS SIGNAL: Person with hands on head signaling for help

Mark "isDangerous": false for:
- Normal standing, sitting, walking
- Looking at phone
- Talking to others
- Normal facial expressions
- Any routine activity

BE CONSERVATIVE - only flag truly dangerous situations.

Return ONLY valid JSON (no markdown):
{{"events": [{{"description": "what is happening", "isDangerous": true/false}}]}}

If nothing notable, return: {{"events": [{{"description": "Normal activity", "isDangerous": false}}]}}"""

            # Send to Gemini
            response = self.model.generate_content([
                prompt,
                {"mime_type": "image/jpeg", "data": frame_base64}
            ])
            
            # Parse response
            text = response.text.strip()
            
            # Clean up response (remove markdown if present)
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            text = text.strip()
            
            result = json.loads(text)
            events = result.get("events", [])
            
            # Format events
            formatted_events = []
            for event in events:
                if event.get("isDangerous", False):
                    formatted_events.append({
                        "type": "DANGER_DETECTED",
                        "severity": 4,
                        "label": event.get("description", "Dangerous situation detected"),
                        "icon": "🚨",
                        "time": time.strftime("%H:%M:%S")
                    })
                else:
                    # Don't spam normal activity events
                    pass
            
            self.last_events = formatted_events
            return formatted_events
            
        except Exception as e:
            print(f"[AI] Analysis error: {e}")
            return []
    
    def is_available(self) -> bool:
        """Check if AI analysis is available."""
        return self.model is not None

