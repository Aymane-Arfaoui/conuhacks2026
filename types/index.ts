export enum GestureType {
  NONE = 'NONE',
  OPEN_PALM = 'OPEN_PALM',
  FIST = 'FIST',
  THUMBS_UP = 'THUMBS_UP',
  POINTING = 'POINTING',
  PEACE = 'PEACE',
  TOUCHING_HEAD = 'TOUCHING_HEAD',
  ARMS_UP = 'ARMS_UP',
  DISTRESS = 'DISTRESS'
}

export enum EmergencyResponse {
  LOCK_DOORS = 'LOCK_DOORS',
  SOUND_ALARM = 'SOUND_ALARM',
  BOTH = 'BOTH'
}

export interface GestureDetection {
  type: GestureType;
  confidence: number;
  label: string;
}

export interface LogEntry {
  id: string;
  message: string;
  type: GestureType;
  timestamp: Date;
  isDangerous?: boolean;
}

export interface AIEvent {
  type: string;
  severity: number;
  label: string;
  time?: string;
  timestamp?: number;
  isDangerous?: boolean;
}

export interface EmergencySettings {
  emergencyGesture: GestureType;
  emergencyResponse: EmergencyResponse;
  enabled: boolean;
}

export const GESTURE_INFO: Record<GestureType, { label: string; description: string; icon: string }> = {
  [GestureType.NONE]: { label: 'None', description: 'No gesture detected', icon: '○' },
  [GestureType.OPEN_PALM]: { label: 'Open Palm', description: 'Hand open with fingers spread', icon: '🖐' },
  [GestureType.FIST]: { label: 'Closed Fist', description: 'Hand closed in a fist', icon: '✊' },
  [GestureType.THUMBS_UP]: { label: 'Thumbs Up', description: 'Thumb pointing upward', icon: '👍' },
  [GestureType.POINTING]: { label: 'Pointing', description: 'Index finger pointing up', icon: '☝' },
  [GestureType.PEACE]: { label: 'Peace Sign', description: 'Victory/peace hand sign', icon: '✌' },
  [GestureType.TOUCHING_HEAD]: { label: 'Touching Head', description: 'Hand raised near head area', icon: '🤚' },
  [GestureType.ARMS_UP]: { label: 'Arms Up', description: 'Both arms raised high', icon: '🙌' },
  [GestureType.DISTRESS]: { label: 'Distress', description: 'General distress signal', icon: '⚠' }
};

export const DEFAULT_EMERGENCY_SETTINGS: EmergencySettings = {
  emergencyGesture: GestureType.ARMS_UP,
  emergencyResponse: EmergencyResponse.BOTH,
  enabled: true
};
