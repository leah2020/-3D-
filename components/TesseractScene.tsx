import React, { useRef, useMemo, useState, useLayoutEffect, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Points, Image, Float, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import GUI from 'lil-gui'; 
import { GestureData, PhotoData } from '../types';
import { 
  COLOR_PARTICLE_YELLOW, 
  COLOR_PARTICLE_WHITE, 
  COLOR_LINE_YELLOW,
  COLOR_LINE_WHITE
} from '../constants';

interface SceneProps {
  gestureData: GestureData;
  photos: PhotoData[];
  mode: 'GESTURE' | 'MOUSE';
}

// Visual constants
const TUNNEL_LENGTH = 2000;

// Config object for GUI parameters
// We use a mutable object for things that don't need re-renders (speed, intensity)
const PARAMS = {
  bloomThreshold: 0.1,
  bloomIntensity: 2.5,
  bloomSmoothing: 0.9,
  rotationSensitivity: 0.1,
  zoomSensitivity: 1.5,
  glowStrength: 3.0,
};

interface GeometryProps {
  lineCount: number;
  opacity: number;
  glowStrength: number;
  lineWidth: number;
}

const TesseractGeometry: React.FC<GeometryProps> = ({ lineCount, opacity, glowStrength, lineWidth }) => {
  const radius = 20;

  const { geometry } = useMemo(() => {
    const points: number[] = [];
    const colors: number[] = [];
    
    // HDR Colors for High Intensity Bloom
    const colorY = new THREE.Color(COLOR_LINE_YELLOW).multiplyScalar(glowStrength);
    const colorW = new THREE.Color(COLOR_LINE_WHITE).multiplyScalar(glowStrength);

    const pushColor = (isYellow: boolean) => {
      const c = isYellow ? colorY : colorW;
      colors.push(c.r, c.g, c.b);
    };

    // Long longitudinal lines
    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      points.push(x, y, 0);
      points.push(x, y, -TUNNEL_LENGTH);
      
      // Alternating colors for lines
      const isYellow = i % 2 === 0;
      pushColor(isYellow);
      pushColor(isYellow);
    }

    // Cross sections (Rings)
    let index = 0;
    // Add rings deep into the tunnel
    for (let z = 0; z > -TUNNEL_LENGTH; z -= 20) {
       const size = radius * 0.8;
       // Box shape points
       const p = [
         [-size, -size, z], [size, -size, z],
         [size, -size, z], [size, size, z],
         [size, size, z], [-size, size, z],
         [-size, size, z], [-size, -size, z]
       ];

       const isYellow = index % 2 !== 0; // Alternate rings
       p.forEach(coord => {
         points.push(...coord);
         pushColor(isYellow);
       });
       index++;
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    return { geometry: geo };
  }, [lineCount, glowStrength]); 

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial 
        vertexColors 
        transparent 
        opacity={opacity} 
        linewidth={lineWidth} 
        blending={THREE.AdditiveBlending} 
        toneMapped={false}
      />
    </lineSegments>
  );
};

interface ParticleProps {
  maxCount: number;
  minCount: number;
  isDynamic: boolean;
  speed: number;
  maxDepth: number; // The limit of where the camera can go
}

const DustParticles: React.FC<ParticleProps> = ({ maxCount, minCount, isDynamic, speed, maxDepth }) => {
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(maxCount * 3);
    const cols = new Float32Array(maxCount * 3);
    const colorY = new THREE.Color(COLOR_PARTICLE_YELLOW).multiplyScalar(2.0);
    const colorW = new THREE.Color(COLOR_PARTICLE_WHITE).multiplyScalar(2.0);

    // FIX: Ensure particles always cover the full visual tunnel (2000), 
    // or deeper if the content (maxDepth) goes further.
    // Adding extra buffer (+200) to ensure no hard cut-off.
    const particleDepth = Math.max(TUNNEL_LENGTH, Math.abs(maxDepth)) + 200;

    for (let i = 0; i < maxCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;     
      pos[i * 3 + 1] = (Math.random() - 0.5) * 60; 
      // Generate particles from +20 down to deep negative Z
      pos[i * 3 + 2] = (Math.random() * -particleDepth) + 20; 
      
      const c = Math.random() > 0.5 ? colorY : colorW;
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: cols };
  }, [maxCount, maxDepth]);

  const pointsRef = useRef<THREE.Points>(null);
  const currentCountRef = useRef(maxCount);

  useFrame((state, delta) => {
    if (pointsRef.current && pointsRef.current.geometry) {
      pointsRef.current.rotation.z += 0.0005;

      let targetCount = maxCount;
      if (isDynamic) {
        const z = state.camera.position.z;
        // Map Camera Z to a reasonable depth range for density scaling
        // We use Math.min(maxDepth, -500) so the effect doesn't break if maxDepth is shallow
        const depthLimit = Math.min(maxDepth, -500);
        
        const t = THREE.MathUtils.mapLinear(z, 20, depthLimit, 0, 1);
        const clampedT = THREE.MathUtils.clamp(t, 0, 1);
        targetCount = THREE.MathUtils.lerp(minCount, maxCount, clampedT);
      }

      currentCountRef.current = THREE.MathUtils.lerp(currentCountRef.current, targetCount, delta * speed);
      const visibleCount = Math.floor(THREE.MathUtils.clamp(currentCountRef.current, 0, maxCount));
      pointsRef.current.geometry.setDrawRange(0, visibleCount);
    }
  });

  return (
    // FIX: Set frustumCulled to false to prevent particles from disappearing when camera moves deep
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.2}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
};

interface MemoryPhotoProps {
  data: PhotoData;
  index: number;
  size: number;
  spacing: number;
  spreadX: number;
  spreadY: number;
  framePadding: number;
  frameOpacity: number;
}

const MemoryPhoto: React.FC<MemoryPhotoProps> = ({ 
  data, 
  index, 
  size, 
  spacing, 
  spreadX, 
  spreadY,
  framePadding,
  frameOpacity
}) => {
  const ref = useRef<THREE.Mesh>(null);
  const frameRef = useRef<THREE.LineSegments>(null);
  
  // Calculate dynamic position
  const zPos = -20 - (index * spacing);
  const positionX = data.position[0] * spreadX;
  const positionY = data.position[1] * spreadY;
  
  useLayoutEffect(() => {
    if (ref.current && ref.current.material) {
       (ref.current.material as THREE.Material).opacity = 0;
    }
  }, []);

  useFrame((state, delta) => {
    const cameraZ = state.camera.position.z;
    const distance = Math.abs(cameraZ - zPos);
    const isVisible = distance < (100 + size) && distance > 1; 
    const targetOpacity = isVisible ? 1 : 0;
    
    // Animate Image Opacity
    if (ref.current && ref.current.material) {
       const mat = ref.current.material as THREE.Material;
       mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, delta * 3);
       // Gentle Bobbing
       ref.current.position.y = positionY + Math.sin(state.clock.elapsedTime + data.id) * 0.5;
    }

    // Animate Frame Opacity separately to respect user setting
    if (frameRef.current && frameRef.current.material) {
        const mat = frameRef.current.material as THREE.LineBasicMaterial;
        // Fade out entirely if not visible, otherwise fade to user setting
        const targetFrameOpacity = isVisible ? frameOpacity : 0;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetFrameOpacity, delta * 3);
        
        // Sync position with image bobbing
        if (ref.current) {
             frameRef.current.position.y = ref.current.position.y;
        }
    }
  });

  const frameColor = useMemo(() => new THREE.Color(COLOR_PARTICLE_YELLOW).multiplyScalar(4.0), []);

  // Generate a clean square outline geometry
  const frameGeometry = useMemo(() => {
      const dim = size + framePadding; // Total size of frame
      const hw = dim / 2;
      
      const points = [
          new THREE.Vector3(-hw, -hw, 0),
          new THREE.Vector3(hw, -hw, 0),
          new THREE.Vector3(hw, -hw, 0),
          new THREE.Vector3(hw, hw, 0),
          new THREE.Vector3(hw, hw, 0),
          new THREE.Vector3(-hw, hw, 0),
          new THREE.Vector3(-hw, hw, 0),
          new THREE.Vector3(-hw, -hw, 0)
      ];
      return new THREE.BufferGeometry().setFromPoints(points);
  }, [size, framePadding]);

  return (
    // We separate the frame from the Float component's children to control them better if needed,
    // but keeping them together in Float ensures they move together.
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5} position={[positionX, positionY, zPos]}>
      <Image
        ref={ref}
        url={data.url}
        scale={[size, size]} 
        transparent
        toneMapped={false}
      />
      
      <lineSegments 
        ref={frameRef} 
        geometry={frameGeometry} 
        // Slight Z offset to prevent Z-fighting with the image plane
        position={[0, 0, 0.05]} 
      >
          <lineBasicMaterial 
            color={frameColor} 
            transparent 
            opacity={frameOpacity} // Initial opacity, animated in useFrame
            toneMapped={false} 
            depthTest={false} // Ensure it draws over/under cleanly without z-fighting artifacts
            depthWrite={false}
          />
      </lineSegments>
    </Float>
  );
};

const TesseractScene: React.FC<SceneProps> = ({ gestureData, photos, mode }) => {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  
  // State for GUI params
  const [lineCount, setLineCount] = useState(40);
  const [lineOpacity, setLineOpacity] = useState(0.15);
  const [lineWidth, setLineWidth] = useState(2); 
  const [glowStrength, setGlowStrength] = useState(3.0);
  
  // Photo Layout State
  const [photoSize, setPhotoSize] = useState(15);
  const [photoSpacing, setPhotoSpacing] = useState(30);
  const [spreadX, setSpreadX] = useState(60); 
  const [spreadY, setSpreadY] = useState(40); 
  
  // Frame Settings
  const [framePadding, setFramePadding] = useState(0.5);
  const [frameOpacity, setFrameOpacity] = useState(0.5);

  // Particle States
  // Increased default counts to ensure density over the larger tunnel depth
  const [maxParticleCount, setMaxParticleCount] = useState(8000); 
  const [minParticleCount, setMinParticleCount] = useState(2000); 
  const [dynamicParticles, setDynamicParticles] = useState(true);
  const [particleSpeed, setParticleSpeed] = useState(2.0);

  const paramsRef = useRef(PARAMS);

  const dynamicMaxDepth = useMemo(() => {
     return -20 - (photos.length * photoSpacing) - 50; 
  }, [photos.length, photoSpacing]);

  // Setup GUI
  useEffect(() => {
    const gui = new GUI({ title: 'Tesseract Control' });

    const layoutFolder = gui.addFolder('Layout & Photos');
    layoutFolder.add({ s: photoSize }, 's', 5, 50).name('Photo Size').onChange(setPhotoSize);
    layoutFolder.add({ sp: photoSpacing }, 'sp', 10, 100).name('Photo Spacing').onChange(setPhotoSpacing);
    layoutFolder.add({ sx: spreadX }, 'sx', 0, 150).name('Spread X (Width)').onChange(setSpreadX);
    layoutFolder.add({ sy: spreadY }, 'sy', 0, 100).name('Spread Y (Height)').onChange(setSpreadY);

    const frameFolder = gui.addFolder('Photo Frame');
    frameFolder.add({ p: framePadding }, 'p', 0, 10).name('Frame Padding').onChange(setFramePadding);
    frameFolder.add({ o: frameOpacity }, 'o', 0, 1).name('Frame Opacity').onChange(setFrameOpacity);

    const visualsFolder = gui.addFolder('Visuals');
    visualsFolder.add(PARAMS, 'bloomThreshold', 0, 1).name('Bloom Threshold').onChange((v: number) => paramsRef.current.bloomThreshold = v);
    visualsFolder.add(PARAMS, 'bloomIntensity', 0, 10).name('Bloom Intensity').onChange((v: number) => paramsRef.current.bloomIntensity = v);
    visualsFolder.add(PARAMS, 'bloomSmoothing', 0, 1).name('Bloom Smoothing').onChange((v: number) => paramsRef.current.bloomSmoothing = v);
    
    const geometryFolder = gui.addFolder('Geometry');
    geometryFolder.add({ lineCount }, 'lineCount', 10, 100, 2).name('Line Count').onChange(setLineCount);
    geometryFolder.add({ lineOpacity }, 'lineOpacity', 0, 1).name('Line Opacity').onChange(setLineOpacity);
    geometryFolder.add({ lineWidth }, 'lineWidth', 1, 10, 0.5).name('Line Width').onChange(setLineWidth);
    geometryFolder.add({ glowStrength }, 'glowStrength', 1, 10).name('Line Glow Power').onChange(setGlowStrength);

    const particleFolder = gui.addFolder('Particles');
    particleFolder.add({ maxParticleCount }, 'maxParticleCount', 1000, 20000, 100).name('Max Count').onChange(setMaxParticleCount);
    particleFolder.add({ dynamicParticles }, 'dynamicParticles').name('Dynamic Zoom').onChange(setDynamicParticles);
    particleFolder.add({ minParticleCount }, 'minParticleCount', 0, 5000, 100).name('Min Count').onChange(setMinParticleCount);
    particleFolder.add({ particleSpeed }, 'particleSpeed', 0.1, 10).name('Change Speed').onChange(setParticleSpeed);

    const interactionFolder = gui.addFolder('Interaction');
    interactionFolder.add(PARAMS, 'rotationSensitivity', 0.1, 5).name('Rot Sensitivity').onChange((v: number) => paramsRef.current.rotationSensitivity = v);
    interactionFolder.add(PARAMS, 'zoomSensitivity', 0.1, 5).name('Zoom Sensitivity').onChange((v: number) => paramsRef.current.zoomSensitivity = v);

    return () => {
      gui.destroy();
    };
  }, []);

  const targetRotation = useRef({ x: 0, y: 0 });
  const targetZ = useRef(10);
  const prevMode = useRef(mode);

  useFrame((state, delta) => {
    const { zoomSensitivity, rotationSensitivity } = paramsRef.current;

    if (mode === 'GESTURE') {
        if (prevMode.current !== 'GESTURE') {
            targetZ.current = state.camera.position.z;
        }

        const speed = (gestureData.pinchRatio - 0.5) * 2; 
        const moveFactor = speed < 0 ? (80 * zoomSensitivity) : (40 * zoomSensitivity); 
        
        targetZ.current -= speed * moveFactor * delta; 
        targetZ.current = Math.min(Math.max(targetZ.current, dynamicMaxDepth), 20);

        state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ.current, delta * 2);

        const maxRotation = (Math.PI / 2 * 0.9); 
        const rawTargetY = -gestureData.handPosition.x * maxRotation * rotationSensitivity;
        const rawTargetX = gestureData.handPosition.y * (maxRotation * 0.5) * rotationSensitivity;

        targetRotation.current.y = THREE.MathUtils.clamp(rawTargetY, -maxRotation, maxRotation);
        targetRotation.current.x = THREE.MathUtils.clamp(rawTargetX, -maxRotation, maxRotation);

        if (groupRef.current) {
            groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotation.current.x, delta * 2);
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation.current.y, delta * 2);
        }

    } else {
        if (groupRef.current) {
            groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, delta * 2);
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, delta * 2);
        }
    }

    if (lightRef.current) {
      lightRef.current.position.z = state.camera.position.z;
    }
    
    prevMode.current = mode;
  });

  return (
    <>
      <Stars radius={150} depth={50} count={6000} factor={4} saturation={0} fade speed={0.5} />

      <group ref={groupRef}>
        <ambientLight intensity={0.2} />
        <pointLight ref={lightRef} position={[0, 0, 10]} intensity={2.5} color={COLOR_PARTICLE_YELLOW} distance={100} decay={2} />
        
        <TesseractGeometry 
          lineCount={lineCount} 
          opacity={lineOpacity} 
          glowStrength={glowStrength}
          lineWidth={lineWidth} 
        />
        
        <DustParticles 
          maxCount={maxParticleCount} 
          minCount={minParticleCount} 
          isDynamic={dynamicParticles} 
          speed={particleSpeed} 
          maxDepth={dynamicMaxDepth}
        />
        
        {photos.map((photo, i) => (
          <MemoryPhoto 
            key={photo.id} 
            data={photo} 
            index={i} 
            size={photoSize}
            spacing={photoSpacing}
            spreadX={spreadX}
            spreadY={spreadY}
            framePadding={framePadding}
            frameOpacity={frameOpacity}
          />
        ))}
      </group>

      <EffectComposer enableNormalPass={false}>
        <Bloom 
          luminanceThreshold={paramsRef.current.bloomThreshold} 
          luminanceSmoothing={paramsRef.current.bloomSmoothing} 
          height={300} 
          intensity={paramsRef.current.bloomIntensity} 
        />
      </EffectComposer>

      <fog attach="fog" args={[0x000000, 10, 200]} />
    </>
  );
};

export default TesseractScene;