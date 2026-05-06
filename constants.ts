import { PhotoData } from './types';

// Visual Style
export const COLOR_BG = '#05070a'; // Original Dark Blue-Black
export const COLOR_PARTICLE_YELLOW = '#fff9c4'; // Original Pale Lemon Yellow
export const COLOR_PARTICLE_WHITE = '#ffffff'; 
export const COLOR_LINE_YELLOW = '#fff9c4'; // Original Pale Lemon Yellow for lines
export const COLOR_LINE_WHITE = '#ffffff';
export const COLOR_HIGHLIGHT = '#ffffff';

// Interaction
export const MOVE_SPEED = 0.5;
export const MAX_DEPTH = 100;
export const MIN_DEPTH = -20;

// Camera
export const FOV_DEFAULT = 75;
export const FOV_ZOOM = 90;

// Helper to generate photo data structure from a list of URLs
export const createPhotosFromUrls = (urls: string[]): PhotoData[] => {
  return urls.map((url, i) => ({
    id: Date.now() + i, // Unique ID based on timestamp
    url: url,
    // Arranged in a spiral/tunnel depth
    // NORMALIZED POSITIONS (approx -0.5 to 0.5)
    // The actual spread width/height is now controlled by the Scene GUI (Spread X/Y)
    position: [
      (Math.random() - 0.5), 
      (Math.random() - 0.5), 
      -20 - (i * 15) // Base Z, overridden by scene spacing
    ],
    rotation: [
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      0
    ],
    triggerDepth: -10 - (i * 15) + 30 // Visible when camera approaches
  }));
};

// Helper to recalculate depth/positions after reordering
export const recalculatePhotoPositions = (photos: PhotoData[]): PhotoData[] => {
  return photos.map((photo, i) => ({
    ...photo,
    // Keep X/Y normalized values stable to preserve identity
    position: [
      photo.position[0], 
      photo.position[1], 
      -20 - (i * 15) // Update Z (Depth) based on new index
    ],
    triggerDepth: -10 - (i * 15) + 30
  }));
};

// Default Mock Photos (Memories)
// Changed from 10 to 3 as requested previously
const defaultUrls = Array.from({ length: 3 }).map((_, i) => `https://picsum.photos/600/600?random=${i}`);
export const MEMORY_PHOTOS: PhotoData[] = createPhotosFromUrls(defaultUrls);