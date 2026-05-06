import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureState, GestureData } from '../types';

interface HandControllerProps {
  onGestureData: (data: GestureData) => void;
  onCameraReady: (isReady: boolean) => void;
}

const HandController: React.FC<HandControllerProps> = ({ onGestureData, onCameraReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const isLoopRunning = useRef<boolean>(false);

  // 1. Initialize MediaPipe HandLandmarker
  useEffect(() => {
    const initLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        console.log("MediaPipe HandLandmarker initialized");
        setLandmarker(handLandmarker);
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
      }
    };
    initLandmarker();
  }, []);

  // 2. Start Webcam
  useEffect(() => {
    const startCamera = async () => {
      if (videoRef.current && navigator.mediaDevices && landmarker) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              width: 320, 
              height: 240,
              frameRate: { ideal: 30 }
            }
          });
          videoRef.current.srcObject = stream;
          
          videoRef.current.onloadeddata = () => {
             console.log("Camera data loaded");
             onCameraReady(true);
             videoRef.current?.play().catch(e => console.error("Play error", e));
             
             if (!isLoopRunning.current) {
               isLoopRunning.current = true;
               predictWebcam();
             }
          };
        } catch (err) {
          console.error("Camera denied:", err);
          onCameraReady(false);
        }
      }
    };

    if (landmarker) {
      startCamera();
    }
    
    return () => {
       if (videoRef.current && videoRef.current.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
       }
    }
  }, [landmarker]);

  // 3. Gesture Recognition Loop
  const predictWebcam = () => {
    if (!isLoopRunning.current) return;
    
    requestRef.current = requestAnimationFrame(predictWebcam);

    if (landmarker && videoRef.current && videoRef.current.readyState >= 2) {
      let startTimeMs = performance.now();
      
      try {
        const results = landmarker.detectForVideo(videoRef.current, startTimeMs);
        
        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          
          // --- Continuous Interaction Data ---
          
          // 1. Pinch Ratio (Thumb Tip to Index Tip)
          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];
          const pinchDist = Math.hypot(
            thumbTip.x - indexTip.x,
            thumbTip.y - indexTip.y,
            thumbTip.z - indexTip.z
          );

          // Normalize with Palm Size
          const wrist = landmarks[0];
          const indexMCP = landmarks[5];
          const palmSize = Math.hypot(
            wrist.x - indexMCP.x,
            wrist.y - indexMCP.y,
            wrist.z - indexMCP.z
          );

          const rawRatio = palmSize > 0 ? pinchDist / palmSize : 0;
          // Clamp and smooth ratio: 0.2 (closed) to 1.0 (open)
          const pinchRatio = Math.min(Math.max((rawRatio - 0.2) / 0.8, 0), 1);

          // 2. Hand Position (Center of palm roughly)
          // Video is mirrored horizontally usually, so we invert X
          // MediaPipe coords are 0..1, we want -1..1
          // x: 0 is left (in video), 1 is right. If mirrored:
          const x = (landmarks[9].x - 0.5) * 2; // Middle finger MCP
          const y = -(landmarks[9].y - 0.5) * 2; // Invert Y because screen Y is top-down
          
          // 3. Determine State
          let state = GestureState.IDLE;
          if (pinchRatio > 0.6) state = GestureState.OPEN_PALM;
          else if (pinchRatio < 0.3) state = GestureState.CLOSED_FIST;

          onGestureData({
            state,
            pinchRatio,
            handPosition: { x, y }
          });
        } else {
           // No hand detected
           onGestureData({
             state: GestureState.IDLE,
             pinchRatio: 0.5,
             handPosition: { x: 0, y: 0 }
           });
        }
      } catch (e) {
        console.warn("Detection error:", e);
      }
    }
  };

  useEffect(() => {
    return () => {
      isLoopRunning.current = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 opacity-50 hover:opacity-100 transition-opacity">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-32 h-24 rounded-lg border border-yellow-500/30 transform scale-x-[-1] object-cover" 
      />
      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none">
        <span className="text-[10px] text-yellow-200 bg-black/50 px-1 rounded">DEBUG VIEW</span>
      </div>
    </div>
  );
};

export default HandController;