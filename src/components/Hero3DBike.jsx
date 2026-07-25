import React, { useRef, useState, useEffect, Suspense, Component } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, ContactShadows, useGLTF, Center } from '@react-three/drei';
import { Rotate3D } from 'lucide-react';

const DEFAULT_BIKE_MODEL_URL = '/models/bike.glb';

// Preload GLTF model early outside the component cycle
useGLTF.preload(DEFAULT_BIKE_MODEL_URL);

// ─── Error Boundary to fallback to Procedural Model if GLTF fails ───
class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[Hero3DBike] GLTF model failed to load, switching to fallback 3D model:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ─── GLTF Model Component ───
function ModelGLTF({ url = DEFAULT_BIKE_MODEL_URL, isMobile }) {
  const { scene } = useGLTF(url);
  const bikeRef = useRef();

  // Slow continuous Y-axis rotation
  useFrame((state, delta) => {
    if (bikeRef.current) {
      bikeRef.current.rotation.y += delta * 0.35;
    }
  });

  return (
    <group ref={bikeRef}>
      <Center position={[0, -0.15, 0]}>
        <primitive
          object={scene}
          scale={isMobile ? 1.5 : 2.0}
        />
      </Center>
    </group>
  );
}

// ─── Fallback Procedural 3D Sports Bike Component ───
function ProceduralSportsBike({ isMobile }) {
  const bikeRef = useRef();

  useFrame((state, delta) => {
    if (bikeRef.current) {
      bikeRef.current.rotation.y += delta * 0.35;
    }
  });

  return (
    <group ref={bikeRef} position={[0, -0.15, 0]} scale={isMobile ? 0.85 : 1}>
      {/* --- REAR WHEEL --- */}
      <group position={[-1.3, -0.2, 0]}>
        <mesh castShadow>
          <torusGeometry args={[0.5, 0.18, 16, 32]} />
          <meshStandardMaterial color="#111827" roughness={0.8} metalness={0.1} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.38, 0.38, 0.1, 16]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <cylinderGeometry args={[0.28, 0.28, 0.02, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.95} roughness={0.1} />
        </mesh>
      </group>

      {/* --- FRONT WHEEL --- */}
      <group position={[1.4, -0.2, 0]}>
        <mesh castShadow>
          <torusGeometry args={[0.5, 0.15, 16, 32]} />
          <meshStandardMaterial color="#111827" roughness={0.8} metalness={0.1} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.38, 0.38, 0.08, 16]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.06]}>
          <cylinderGeometry args={[0.26, 0.26, 0.02, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.95} roughness={0.1} />
        </mesh>
      </group>

      {/* --- ENGINE & CHASSIS FRAME --- */}
      <group position={[0, 0.05, 0]}>
        <mesh castShadow position={[0, -0.05, 0]}>
          <boxGeometry args={[1.1, 0.6, 0.45]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[-0.1, 0.15, 0]} rotation={[0, 0, -Math.PI / 6]}>
          <cylinderGeometry args={[0.18, 0.18, 0.5, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* --- EXHAUST PIPE --- */}
      <group position={[-0.4, -0.15, 0.28]} rotation={[0, 0, 0.15]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.07, 0.1, 1.2, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh position={[0, -0.6, 0]}>
          <cylinderGeometry args={[0.09, 0.07, 0.2, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
      </group>

      {/* --- FUEL TANK & BODYFAIRING (TVS Racing Blue/Red Accent) --- */}
      <mesh castShadow position={[0.25, 0.5, 0]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[1.0, 0.45, 0.55]} />
        <meshStandardMaterial color="#0066CC" metalness={0.65} roughness={0.2} />
      </mesh>

      <mesh position={[0.25, 0.73, 0]}>
        <boxGeometry args={[0.8, 0.02, 0.18]} />
        <meshStandardMaterial color="#ef4444" metalness={0.4} roughness={0.3} />
      </mesh>

      <group position={[1.0, 0.55, 0]} rotation={[0, 0, -0.4]}>
        <mesh castShadow>
          <boxGeometry args={[0.65, 0.5, 0.5]} />
          <meshStandardMaterial color="#0066CC" metalness={0.65} roughness={0.2} />
        </mesh>
        <mesh position={[0.34, -0.05, 0]}>
          <boxGeometry args={[0.04, 0.2, 0.35]} />
          <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={3} />
        </mesh>
        <mesh position={[0.1, 0.28, 0]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.4, 0.02, 0.38]} />
          <meshStandardMaterial color="#090d16" transparent opacity={0.85} roughness={0.1} />
        </mesh>
      </group>

      {/* --- FRONT FORK & HANDLEBARS --- */}
      <group position={[1.1, 0.2, 0]} rotation={[0, 0, -0.38]}>
        <mesh position={[0, 0, 0.18]}>
          <cylinderGeometry args={[0.04, 0.04, 1.1, 16]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0, -0.18]}>
          <cylinderGeometry args={[0.04, 0.04, 1.1, 16]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.7, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.9} />
        </mesh>
      </group>

      {/* --- SEAT & REAR TAIL --- */}
      <mesh castShadow position={[-0.45, 0.52, 0]}>
        <boxGeometry args={[0.75, 0.18, 0.46]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[-1.0, 0.58, 0]} rotation={[0, 0, 0.25]}>
        <boxGeometry args={[0.6, 0.25, 0.38]} />
        <meshStandardMaterial color="#dc2626" metalness={0.5} roughness={0.2} />
      </mesh>
      <mesh position={[-1.31, 0.64, 0]}>
        <boxGeometry args={[0.04, 0.08, 0.22]} />
        <meshStandardMaterial color="#ef4444" emissive="#f87171" emissiveIntensity={3} />
      </mesh>
    </group>
  );
}

// ─── 3D Scene Composition ───
function BikeScene({ isMobile, modelUrl = DEFAULT_BIKE_MODEL_URL }) {
  return (
    <>
      {/* --- LIGHTING SETUP --- */}
      <ambientLight intensity={0.8} />
      
      {/* Key Studio Light */}
      <directionalLight
        position={[6, 8, 6]}
        intensity={1.7}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      
      {/* Fill Light */}
      <directionalLight position={[-6, 4, 4]} intensity={0.6} />
      
      {/* TVS Accent Blue Rim Light */}
      <pointLight position={[-4, 3, -5]} intensity={4.5} color="#0066CC" distance={12} />
      
      {/* Front Headlight Glow Accent */}
      <spotLight position={[4, 2, 2]} intensity={3.5} color="#60a5fa" angle={0.6} penumbra={0.5} />

      {/* Floating Animation Wrapper */}
      <Float
        speed={1.8}
        rotationIntensity={0.15}
        floatIntensity={0.4}
        floatingRange={[-0.08, 0.08]}
      >
        <ModelErrorBoundary fallback={<ProceduralSportsBike isMobile={isMobile} />}>
          <ModelGLTF url={modelUrl} isMobile={isMobile} />
        </ModelErrorBoundary>
      </Float>

      {/* Ground Contact Shadow */}
      <ContactShadows
        position={[0, -0.95, 0]}
        opacity={0.65}
        scale={10}
        blur={2.2}
        far={4.5}
        color="#000000"
      />

      {/* Orbit Controls for Drag Rotation */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate={!isMobile} // Disable rotate drag on mobile to allow smooth page scrolling
        autoRotate={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 2.05}
      />
    </>
  );
}

// ─── Loading Skeleton / Spinner ───
export function Hero3DLoader() {
  return (
    <div className="w-full h-full min-h-[280px] sm:min-h-[384px] bg-transparent flex flex-col items-center justify-center space-y-3 rounded-2xl">
      <div className="relative w-12 h-12 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
        <div className="w-10 h-10 rounded-full border-2 border-[#0066CC] border-t-transparent animate-spin" />
      </div>
      <p className="text-xs font-medium text-blue-300/80 tracking-wide animate-pulse">
        Loading 3D Bike Model...
      </p>
    </div>
  );
}

// ─── Main Hero3DBike Component Export ───
export default function Hero3DBike({ modelUrl = DEFAULT_BIKE_MODEL_URL }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[300px] sm:min-h-[420px] rounded-2xl overflow-visible bg-transparent group">
      
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 1.05, 5.2], fov: isMobile ? 48 : 42 }}
        shadows
        gl={{ antialias: true, alpha: true }}
        className="w-full h-full cursor-grab active:cursor-grabbing overflow-visible"
      >
        <Suspense fallback={null}>
          <BikeScene isMobile={isMobile} modelUrl={modelUrl} />
        </Suspense>
      </Canvas>

      {/* Interactive Helper Badge (Hides on Mobile) */}
      {!isMobile && (
        <div className="absolute top-3.5 right-3.5 px-2.5 py-1 rounded-full bg-[#151c2c]/80 backdrop-blur-md border border-[#0066CC]/30 text-[10px] font-semibold text-blue-300 pointer-events-none z-10 flex items-center space-x-1.5 shadow-lg">
          <Rotate3D className="w-3.5 h-3.5 text-[#0066CC]" />
          <span>Drag to rotate 3D</span>
        </div>
      )}
    </div>
  );
}
