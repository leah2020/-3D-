export enum GestureState {
  IDLE = 'IDLE',
  OPEN_PALM = 'OPEN_PALM', // Trigger Zoom In
  CLOSED_FIST = 'CLOSED_FIST', // Trigger Zoom Out/Hold
  UNKNOWN = 'UNKNOWN'
}

export interface GestureData {
  state: GestureState;
  pinchRatio: number; // 0.0 (closed) to 1.0 (open)
  handPosition: { x: number; y: number }; // Normalized -1 to 1
}

export interface HandLandmarkerResult {
  landmarks: Array<Array<{ x: number; y: number; z: number }>>;
}

export interface PhotoData {
  id: number;
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  triggerDepth: number;
}