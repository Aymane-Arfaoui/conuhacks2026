"""
AI Frame Analyzer using Google Gemini.
Detects: drowsiness, distress, danger, abnormal behavior.
"""
import os
import base64
import json
import time
from typing import List, Dict, Any

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("[AI] google-generativeai not installed")


class AIAnalyzer:
    """Uses Gemini AI to analyze video frames for safety concerns."""
    
    def __init__(self):
        self.model = None
        self.last_analysis_time = 0
        self.analysis_interval = 1.2  # Every 1.2 seconds
        self.failed_attempts = 0
        self.max_failures = 10  # More lenient
        
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        
        if GEMINI_AVAILABLE and api_key:
            try:
                genai.configure(api_key=api_key)
                
                # Try different models
                models_to_try = [
                    'gemini-2.0-flash-exp',
                    'gemini-1.5-flash',
                    'gemini-1.5-flash-latest',
                    'gemini-pro-vision',
                ]
                
                for model_name in models_to_try:
                    try:
                        self.model = genai.GenerativeModel(model_name)
                        print(f"[AI] Initialized: {model_name}")
                        break
                    except:
                        continue
                        
            except Exception as e:
                print(f"[AI] Init failed: {e}")
        else:
            if not api_key:
                print("[AI] No API key - set GEMINI_API_KEY in .env")
    
    def analyze_frame(self, frame_base64: str, detections: List[Dict]) -> List[Dict[str, Any]]:
        """Analyze frame for safety concerns."""
        now = time.time()
        time_str = time.strftime("%H:%M:%S")
        
        person_count = len([d for d in detections if d["cls"] == "person"])
        
        # Rate limit
        if now - self.last_analysis_time < self.analysis_interval:
            return []
        
        self.last_analysis_time = now
        
        # Fallback if no AI or too many failures
        if not self.model or self.failed_attempts >= self.max_failures:
            return self._basic_log(person_count, time_str)
        
        try:
            prompt = """Look at this webcam image carefully.

Describe what you see the person doing in ONE sentence.

You MUST set "alert": true if you see ANY of these signs:
- Eyes appear closed or nearly closed
- Head tilting, drooping, or falling
- Person appears tired, drowsy, or sleepy
- Unusual posture (slumped, leaning badly)
- Mouth wide open (yawning or distress)
- Person looks unwell or in pain
- Lying down or collapsed
- Any threatening or violent behavior

Set "alert": false ONLY if person is clearly awake, alert, with eyes open and normal posture.

Be VERY sensitive - if in doubt, set alert to true.

RESPOND ONLY WITH JSON:
{"description": "what you see", "alert": true or false}"""

            response = self.model.generate_content([
                prompt,
                {"mime_type": "image/jpeg", "data": frame_base64}
            ])
            
            text = response.text.strip()
            
            # Extract JSON
            if "```" in text:
                for part in text.split("```"):
                    part = part.strip()
                    if part.startswith("json"):
                        part = part[4:].strip()
                    if "{" in part:
                        start = part.find("{")
                        end = part.rfind("}") + 1
                        if start >= 0 and end > start:
                            text = part[start:end]
                            break
            
            result = json.loads(text)
            description = result.get("description", "Analyzing...")
            is_alert = result.get("alert", False)
            
            # Reset failures on success
            self.failed_attempts = 0
            
            if is_alert:
                print(f"[{time_str}] !! ALERT: {description}")
                return [{
                    "type": "WARNING",
                    "severity": 3,
                    "label": description,
                    "time": time_str
                }]
            else:
                print(f"[{time_str}] -- {description}")
                return [{
                    "type": "INFO",
                    "severity": 1,
                    "label": description,
                    "time": time_str
                }]
                
        except json.JSONDecodeError:
            self.failed_attempts += 1
            print(f"[{time_str}] AI: JSON parse error")
            return self._basic_log(person_count, time_str)
            
        except Exception as e:
            self.failed_attempts += 1
            err = str(e)[:60]
            print(f"[{time_str}] AI error: {err}")
            return self._basic_log(person_count, time_str)
    
    def _basic_log(self, person_count: int, time_str: str) -> List[Dict]:
        """Basic monitoring log when AI unavailable."""
        if person_count == 0:
            label = "No subjects detected"
        elif person_count == 1:
            label = "1 subject in frame"
        else:
            label = f"{person_count} subjects in frame"
        
        print(f"[{time_str}] -- {label}")
        return [{
            "type": "INFO",
            "severity": 1,
            "label": label,
            "time": time_str
        }]
    
    def is_available(self) -> bool:
        return self.model is not None
