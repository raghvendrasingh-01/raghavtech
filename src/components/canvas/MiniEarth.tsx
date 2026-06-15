import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Preload, useGLTF } from "@react-three/drei";

const Earth = () => {
  const earth = useGLTF("./planet/scene.gltf");

  return (
    <primitive object={earth.scene} scale={2} position-y={0} position-x={0} rotation-y={0} />
  );
};

interface MiniEarthCanvasProps {
  className?: string;
}

const MiniEarthCanvas = ({ className = "" }: MiniEarthCanvasProps) => {
  return (
    <div className={`w-24 h-24 md:w-32 md:h-32 ${className}`}>
      <Canvas
        shadows
        frameloop="always"
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
        camera={{
          fov: 45,
          near: 0.1,
          far: 200,
          position: [-4, 2, 8],
        }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <OrbitControls
            autoRotate
            autoRotateSpeed={3}
            enablePan={false}
            enableZoom={false}
            enableRotate={false}
          />
          <Earth />
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default MiniEarthCanvas;
