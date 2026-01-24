"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
}

export interface DetectionEvent {
  timestamp: string;
  description: string;
  isDangerous: boolean;
  severity: number;
}

export interface DetectionResult {
  events: DetectionEvent[];
  error?: string;
}

export async function analyzeFrame(base64Image: string): Promise<DetectionResult> {
  if (!genAI) {
    return { 
      events: [{
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        description: "AI not configured - add GEMINI_API_KEY to .env.local",
        isDangerous: false,
        severity: 0
      }]
    };
  }

  try {
    // Extract base64 data (remove prefix if present)
    let base64Data = base64Image;
    if (base64Image.includes(',')) {
      base64Data = base64Image.split(',')[1];
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg'
      },
    };

    const prompt = `You are a security monitoring AI analyzing a webcam feed. Look at this image carefully.

ALWAYS return exactly one event describing what you see.

Set "isDangerous": true if you detect ANY of these warning signs:

DROWSINESS/FATIGUE:
- Eyes closed or nearly closed
- Eyes drooping or heavy-lidded
- Yawning or mouth wide open
- Head nodding, tilting, or drooping forward
- Slouched or slumped posture
- Person appears tired or sleepy

MEDICAL EMERGENCY:
- Person falling or collapsed
- Person on the ground unexpectedly
- Clutching chest, head, or stomach in pain
- Appears unconscious or unresponsive
- Swaying, losing balance, or stumbling
- Seizure or convulsing movements
- Visible injury or bleeding

DISTRESS/DANGER:
- Person signaling for help (hands up, waving)
- Fighting or physical altercation
- Threatening posture or aggressive behavior
- Person appears scared or in distress

Set "isDangerous": false ONLY if the person is:
- Clearly awake with eyes open
- Alert and upright posture
- Engaged in normal activity (working, talking, using phone)
- Looking directly at camera with eyes open

BE VERY SENSITIVE - when in doubt, mark as dangerous. It's better to have a false alarm than miss a real emergency.

RESPOND WITH JSON ONLY (no markdown):
{"description": "brief description of what you see", "isDangerous": true or false}`;

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text().trim();

    // Parse JSON
    let jsonStr = text;
    
    // Handle code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    
    return {
      events: [{
        timestamp,
        description: parsed.description || "Analysis complete",
        isDangerous: parsed.isDangerous || false,
        severity: parsed.isDangerous ? 3 : 1
      }]
    };

  } catch (error) {
    console.error('AI Detection error:', error);
    return {
      events: [{
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        description: "Monitoring active",
        isDangerous: false,
        severity: 1
      }],
      error: String(error)
    };
  }
}

