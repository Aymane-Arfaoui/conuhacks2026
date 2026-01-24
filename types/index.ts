
export enum GestureType {
  NONE = 'NONE',
  OPEN_PALM = 'OPEN_PALM',
  FIST = 'FIST',
  THUMBS_UP = 'THUMBS_UP',
  TOUCHING_HEAD = 'TOUCHING_HEAD',
  ARMS_UP = 'ARMS_UP'
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
}

export interface Point {
  x: number;
  y: number;
  z: number;
}
