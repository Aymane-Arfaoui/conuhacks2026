import { GestureRecognizerResult } from '@mediapipe/tasks-vision';
import { GestureType, GestureDetection } from '../types';

/**
 * Maps multi-hand MediaPipe results to a single prioritized gesture.
 */
export const mapGestureResult = (result: GestureRecognizerResult): GestureDetection => {
  const { gestures, landmarks } = result;

  const defaultDetection: GestureDetection = {
    type: GestureType.NONE,
    confidence: 0,
    label: 'None'
  };

  if (!gestures || gestures.length === 0 || !landmarks || landmarks.length === 0) {
    return defaultDetection;
  }

  // Priority queue for multiple hand gestures
  // Higher index = higher priority
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const priorityOrder = [
    GestureType.NONE,
    GestureType.OPEN_PALM,
    GestureType.FIST,
    GestureType.THUMBS_UP,
    GestureType.TOUCHING_HEAD,
    GestureType.ARMS_UP
  ];

  let bestDetection = defaultDetection;

  // Iterate through all detected hands to find the most significant gesture
  landmarks.forEach((handLandmarks, index) => {
    const handGestures = gestures[index];
    if (!handGestures) return;

    let currentHandDetection = defaultDetection;

    // --- HEURISTICS ---
    
    // 1. Arms Up (Highest)
    const isHighUp = handLandmarks.some(p => p.y < 0.12);
    if (isHighUp) {
      currentHandDetection = { type: GestureType.ARMS_UP, confidence: 0.95, label: 'Arms Up' };
    } 
    // 2. Touching Head
    // Simplified heuristic: Hands near top center (roughly face area)
    // In a real app with face landmarks, we would check intersection
    else if (handLandmarks[0].y < 0.4 && handLandmarks[0].x > 0.3 && handLandmarks[0].x < 0.7) {
       currentHandDetection = { type: GestureType.TOUCHING_HEAD, confidence: 0.85, label: 'Touching Head' };
    }
    else {
        // 3. MediaPipe Standard Gestures
        if (handGestures.length > 0) {
            const topGesture = handGestures[0];
            const categoryName = topGesture.categoryName;
            const score = topGesture.score;

            if (categoryName === 'Open_Palm') {
                currentHandDetection = { type: GestureType.OPEN_PALM, confidence: score, label: 'Open Palm' };
            } else if (categoryName === 'Closed_Fist') {
                currentHandDetection = { type: GestureType.FIST, confidence: score, label: 'Fist' };
            } else if (categoryName === 'Thumb_Up') {
                currentHandDetection = { type: GestureType.THUMBS_UP, confidence: score, label: 'Thumbs Up' };
            }
        }
    }

    // Compare priorities (simple enum order check could work if we map them to numbers, but here we just check if "Not None")
    // If we have a custom gesture, it usually overrides standard ones in this simple logic
    if (currentHandDetection.type !== GestureType.NONE) {
        // Simple override: Last detected valid gesture wins
        bestDetection = currentHandDetection;
    }
  });

  return bestDetection;
};
