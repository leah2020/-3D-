import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import TesseractScene from './components/TesseractScene';
import HandController from './components/HandController';
import { GestureState, GestureData, PhotoData } from './types';
import { COLOR_BG, MEMORY_PHOTOS, createPhotosFromUrls, recalculatePhotoPositions } from './constants';

const App: React.FC = () => {
  const [gestureData, setGestureData] = useState<GestureData>({
    state: GestureState.IDLE,
    pinchRatio: 0.5,
    handPosition: { x: 0, y: 0 }
  });
  const [cameraReady, setCameraReady] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [photos, setPhotos] = useState<PhotoData[]>(MEMORY_PHOTOS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputUrls, setInputUrls] = useState<string>('');

  const activeMode = manualMode || !cameraReady ? 'MOUSE' : 'GESTURE';

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
    setManualMode(true); 
  };

  const handleRemovePhoto = (id: number) => {
    const newPhotos = photos.filter(p => p.id !== id);
    // Recalculate positions so there are no large gaps in the tunnel
    setPhotos(recalculatePhotoPositions(newPhotos));
  };

  const handleMovePhoto = (index: number, direction: 'left' | 'right') => {
    if (direction === 'left' && index === 0) return;
    if (direction === 'right' && index === photos.length - 1) return;

    const newPhotos = [...photos];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    
    // Swap
    [newPhotos[index], newPhotos[targetIndex]] = [newPhotos[targetIndex], newPhotos[index]];
    
    // Recalculate Z-Depth based on new order
    setPhotos(recalculatePhotoPositions(newPhotos));
  };

  const handleAddUrls = () => {
    const urls = inputUrls
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (urls.length > 0) {
      // Append new photos to the end
      const incomingPhotos = createPhotosFromUrls(urls);
      // Adjust the Z-depth of incoming photos to start after the last existing photo
      const currentCount = photos.length;
      const adjustedIncoming = incomingPhotos.map((p, i) => ({
        ...p,
        position: [p.position[0], p.position[1], -20 - ((currentCount + i) * 15)] as [number, number, number],
        triggerDepth: -10 - ((currentCount + i) * 15) + 30
      }));

      setPhotos(prev => [...prev, ...adjustedIncoming]);
      setInputUrls(''); // Clear input after adding
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      // Filter out non-image files and limit to 50 to prevent crashing WebGL context
      const files = Array.from(event.target.files)
        .filter(file => file.type.startsWith('image/'))
        .slice(0, 50);
      
      if (files.length === 0) {
        event.target.value = ''; // Reset input
        return;
      }

      const fileUrls = files.map(file => URL.createObjectURL(file as Blob));
      
      const incomingPhotos = createPhotosFromUrls(fileUrls);
      const currentCount = photos.length;
      const adjustedIncoming = incomingPhotos.map((p, i) => ({
        ...p,
        position: [p.position[0], p.position[1], -20 - ((currentCount + i) * 15)] as [number, number, number],
        triggerDepth: -10 - ((currentCount + i) * 15) + 30
      }));

      setPhotos(prev => [...prev, ...adjustedIncoming]);
      event.target.value = ''; // Reset input to allow selecting same file/folder again
    }
  };

  return (
    <div className="w-full h-screen relative bg-black overflow-hidden select-none text-white">
      
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 10], fov: 75 }}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        >
          <color attach="background" args={[COLOR_BG]} />
          <TesseractScene 
            gestureData={activeMode === 'GESTURE' ? gestureData : { state: GestureState.IDLE, pinchRatio: 0.5, handPosition: {x:0,y:0} }} 
            photos={photos} 
            mode={activeMode}
          />
          {activeMode === 'MOUSE' && (
            <OrbitControls 
              enableZoom={true} 
              enablePan={false} 
              autoRotate={false} 
              rotateSpeed={0.5}
              // Restrict rotation to keep front in view (+/- 85 degrees approx)
              minAzimuthAngle={-1.5} 
              maxAzimuthAngle={1.5}
              // Restrict vertical angle to avoid flipping
              minPolarAngle={Math.PI / 2 - 0.5}
              maxPolarAngle={Math.PI / 2 + 0.5}
              minDistance={2}
              maxDistance={MAX_DEPTH_ORBIT}
            />
          )}
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-8">
        
        {/* Header */}
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="space-y-1 pointer-events-none">
            <h1 className="text-4xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-yellow-400 font-['Rajdhani'] uppercase drop-shadow-[0_0_10px_rgba(253,230,138,0.5)]">
              Tesseract
            </h1>
            <p className="text-xs text-yellow-200/80 tracking-[0.3em] uppercase">Dimensional Data Visualizer</p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${cameraReady ? 'border-green-500/50 bg-green-900/20' : 'border-red-500/50 bg-red-900/20'}`}>
              <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-xs uppercase font-medium text-gray-300">{cameraReady ? 'System Online' : 'Camera Offline'}</span>
            </div>
            
            <div className="flex gap-4 items-center mt-2">
              <button 
                onClick={handleOpenSettings}
                className="text-xs flex items-center gap-1 text-yellow-200 hover:text-white border border-yellow-500/30 bg-black/50 px-3 py-1 rounded hover:bg-yellow-900/30 transition-all backdrop-blur-sm"
              >
                SETTINGS
              </button>
              <button 
                onClick={() => setManualMode(!manualMode)}
                className="text-xs text-yellow-200 hover:text-white underline decoration-yellow-500/50 transition-colors"
              >
                {manualMode ? 'Enable Gestures' : 'Enable Mouse'}
              </button>
            </div>
          </div>
        </header>

        {/* Center Guide */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 opacity-30">
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1" className="text-yellow-200 animate-[spin_10s_linear_infinite]">
            <circle cx="50" cy="50" r="48" strokeDasharray="10 5" />
            <path d="M50 20 L50 80 M20 50 L80 50" strokeOpacity="0.5" />
          </svg>
        </div>

        {/* Footer */}
        <footer className="flex justify-between items-end">
          <div className="w-64 space-y-4">
             <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-lg">
                <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Telemetry</h3>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-yellow-200">ZOOM</span>
                  {/* Progress bar for Zoom/Pinch */}
                  <div className="w-24 h-2 bg-gray-800 rounded overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-yellow-700 to-yellow-200 transition-all duration-100"
                      style={{ width: `${manualMode ? 50 : gestureData.pinchRatio * 100}%` }}
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                   <span>ROT X: {gestureData.handPosition.y.toFixed(2)}</span>
                   <span>ROT Y: {gestureData.handPosition.x.toFixed(2)}</span>
                </div>
             </div>
          </div>
        </footer>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
          <div className="bg-[#0a0c12] border border-yellow-500/30 rounded-lg max-w-2xl w-full p-6 shadow-2xl shadow-yellow-900/20 relative flex flex-col max-h-[90vh]">
            <button 
               onClick={() => { setIsSettingsOpen(false); setManualMode(false); }}
               className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >✕</button>
            <h2 className="text-xl font-['Rajdhani'] font-bold text-yellow-200 mb-2 tracking-wider uppercase border-b border-yellow-500/20 pb-2">
              Memory Database
            </h2>
            
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-hide">
              
              {/* Current Memories Gallery */}
              <section>
                <div className="flex justify-between items-center mb-2">
                   <label className="text-xs text-gray-400 uppercase tracking-widest">
                     Current Stream ({photos.length})
                   </label>
                   {photos.length > 0 && (
                     <button 
                       onClick={() => setPhotos([])} 
                       className="text-[10px] text-red-500 hover:text-red-400 uppercase"
                     >
                       Clear All
                     </button>
                   )}
                </div>
                
                {photos.length === 0 ? (
                  <div className="p-4 border border-dashed border-gray-800 rounded text-center text-gray-600 text-xs">
                    No memories loaded. Add some below.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                    {photos.map((photo, index) => (
                      <div key={photo.id} className="relative group aspect-square rounded overflow-hidden border border-gray-800 hover:border-yellow-500/50 transition-colors bg-gray-900 flex flex-col">
                        <div className="relative flex-1 w-full overflow-hidden">
                          <img 
                            src={photo.url} 
                            alt="memory" 
                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" 
                          />
                        </div>
                        
                        {/* Control Toolbar - Slides up on hover */}
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-black/80 backdrop-blur flex items-center justify-between px-1 translate-y-full group-hover:translate-y-0 transition-transform duration-200 border-t border-white/10">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMovePhoto(index, 'left'); }}
                            disabled={index === 0}
                            className={`w-6 h-full flex items-center justify-center text-gray-400 hover:text-yellow-200 hover:bg-white/5 ${index === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
                            title="Move Earlier"
                          >
                            ◄
                          </button>
                          
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemovePhoto(photo.id); }}
                            className="w-6 h-full flex items-center justify-center text-red-500 hover:text-red-300 hover:bg-red-900/20"
                            title="Delete Memory"
                          >
                            ✕
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); handleMovePhoto(index, 'right'); }}
                            disabled={index === photos.length - 1}
                            className={`w-6 h-full flex items-center justify-center text-gray-400 hover:text-yellow-200 hover:bg-white/5 ${index === photos.length - 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                            title="Move Later"
                          >
                            ►
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Add New Content */}
              <section className="border-t border-white/5 pt-4">
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-3">
                  Ingest New Data
                </label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Remote URLs */}
                  <div className="space-y-2">
                    <textarea 
                      value={inputUrls}
                      onChange={(e) => setInputUrls(e.target.value)}
                      className="w-full h-24 bg-black/50 border border-yellow-900/50 rounded p-3 text-xs font-mono text-gray-300 focus:border-yellow-500 focus:outline-none resize-none"
                      placeholder="Enter Image URLs (one per line)..."
                    />
                    <button 
                      onClick={handleAddUrls}
                      disabled={!inputUrls.trim()}
                      className="w-full py-2 rounded bg-yellow-900/30 border border-yellow-500/30 text-yellow-200 hover:bg-yellow-500 hover:text-black text-xs uppercase font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Add URLs
                    </button>
                  </div>

                  {/* Local Files */}
                  <div className="space-y-2 flex flex-col">
                     <div className="flex-1 flex flex-col gap-2">
                       <label className="flex-1 cursor-pointer bg-yellow-900/10 border border-yellow-500/20 rounded flex items-center justify-center hover:bg-yellow-900/20 transition-colors group">
                          <input 
                            type="file" 
                            accept="image/*" 
                            multiple 
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <div className="text-center">
                            <span className="block text-2xl mb-1 text-yellow-500/50 group-hover:text-yellow-400">⊕</span>
                            <span className="text-xs text-gray-500 group-hover:text-yellow-300 uppercase font-bold">Select Images</span>
                          </div>
                       </label>

                       <label className="flex-1 cursor-pointer bg-yellow-900/10 border border-yellow-500/20 rounded flex items-center justify-center hover:bg-yellow-900/20 transition-colors group">
                          <input 
                            type="file" 
                            // @ts-ignore: webkitdirectory is non-standard but supported
                            webkitdirectory="" 
                            directory=""
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                           <div className="text-center">
                            <span className="text-xs text-gray-500 group-hover:text-yellow-300 uppercase font-bold">Import Folder</span>
                          </div>
                       </label>
                     </div>
                  </div>
                </div>
              </section>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
               <button 
                  onClick={() => { setIsSettingsOpen(false); setManualMode(false); }}
                  className="px-6 py-2 rounded bg-yellow-500 text-black text-xs uppercase tracking-wider font-bold hover:bg-yellow-400 transition-all shadow-[0_0_15px_rgba(253,230,138,0.4)]"
                >
                  Return to Tesseract
                </button>
            </div>
          </div>
        </div>
      )}

      <HandController 
        onGestureData={setGestureData} 
        onCameraReady={setCameraReady} 
      />
    </div>
  );
};

// Increased max depth to support very large galleries in mouse mode
const MAX_DEPTH_ORBIT = 2000;

export default App;