import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Html } from "@react-three/drei";
import * as THREE from "three";

// Keyboard layout
const keyboardRows = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'"],
  ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"],
  ["SPACE"]
];

const rowOffsets = [0, 0.3, 0.5, 0.8, 0];
const keyWidths: { [key: string]: number } = {
  SPACE: 6,
  default: 0.9
};

// Color palette for keys - each key gets a unique color
const getKeyColor = (keyChar: string): string => {
  const colors: { [key: string]: string } = {
    // Number row - warm gradient
    "1": "#ff6b6b", "2": "#ff8e53", "3": "#ffa94d", "4": "#ffd43b",
    "5": "#a9e34b", "6": "#69db7c", "7": "#38d9a9", "8": "#3bc9db",
    "9": "#4dabf7", "0": "#748ffc", "-": "#9775fa", "=": "#da77f2",
    // QWERTY row - cool blues and purples
    "Q": "#e64980", "W": "#be4bdb", "E": "#7950f2", "R": "#4c6ef5",
    "T": "#228be6", "Y": "#15aabf", "U": "#12b886", "I": "#40c057",
    "O": "#82c91e", "P": "#fab005", "[": "#fd7e14", "]": "#fa5252",
    // ASDF row - teals and greens
    "A": "#ff6b6b", "S": "#cc5de8", "D": "#845ef7", "F": "#5c7cfa",
    "G": "#339af0", "H": "#22b8cf", "J": "#20c997", "K": "#51cf66",
    "L": "#94d82d", ";": "#fcc419", "'": "#ff922b",
    // ZXCV row - vibrant mix
    "Z": "#f06595", "X": "#ae3ec9", "C": "#7048e8", "V": "#4263eb",
    "B": "#1c7ed6", "N": "#1098ad", "M": "#0ca678", ",": "#37b24d",
    ".": "#74b816", "/": "#f59f00",
    // Space bar
    "SPACE": "#868e96"
  };
  return colors[keyChar] || "#495057";
};

interface KeyProps {
  keyChar: string;
  position: [number, number, number];
  width?: number;
  pressedKey: string;
  rowIndex: number;
  keyIndex: number;
}

// Single Key Component
const Key = ({ keyChar, position, width = 0.9, pressedKey }: KeyProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const isPressed = pressedKey.toUpperCase() === keyChar || 
                   (keyChar === "SPACE" && pressedKey === " ");
  
  const keyColor = getKeyColor(keyChar);
  
  useFrame(() => {
    if (meshRef.current) {
      const targetY = isPressed ? -0.1 : 0;
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        position[1] + targetY,
        0.3
      );
    }
  });

  return (
    <group position={[position[0], position[1], position[2]]}>
      <RoundedBox
        ref={meshRef}
        args={[width, 0.4, 0.9]}
        radius={0.08}
        smoothness={4}
      >
        <meshStandardMaterial
          color={isPressed ? "#ffffff" : keyColor}
          emissive={keyColor}
          emissiveIntensity={isPressed ? 1.0 : 0.5}
          metalness={0.1}
          roughness={0.4}
        />
      </RoundedBox>
      {/* Key label using HTML for guaranteed visibility */}
      <Html
        position={[0, 0.25, 0]}
        center
        distanceFactor={8}
        style={{
          color: '#000000',
          fontSize: keyChar === "SPACE" ? '14px' : '18px',
          fontWeight: 'bold',
          fontFamily: 'Arial, sans-serif',
          textShadow: '0 0 2px rgba(255,255,255,0.5)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {keyChar === "SPACE" ? "SPACE" : keyChar}
      </Html>
    </group>
  );
};

// Keyboard Component
const Keyboard3D = ({ pressedKey }: { pressedKey: string }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // Gentle breathing animation
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.03 + 0.5;
    }
  });

  return (
    <group ref={groupRef} position={[0, -2, 0]} rotation={[0.5, 0, 0]}>
      {/* Keyboard base */}
      <RoundedBox
        args={[14, 0.5, 7]}
        radius={0.2}
        smoothness={4}
        position={[0, -0.3, 0]}
      >
        <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.5} />
      </RoundedBox>

      {/* Keys */}
      {keyboardRows.map((row, rowIndex) => {
        let xOffset = -5.5 + rowOffsets[rowIndex];
        
        return row.map((key, keyIndex) => {
          const keyWidth = keyWidths[key] || keyWidths.default;
          const xPos = xOffset + keyWidth / 2;
          xOffset += keyWidth + 0.1;
          
          // Center the space bar
          const finalXPos = key === "SPACE" ? 0 : xPos;
          
          return (
            <Key
              key={`${rowIndex}-${keyIndex}`}
              keyChar={key}
              position={[finalXPos, 0.2, (rowIndex - 2) * 1.1]}
              width={keyWidth}
              pressedKey={pressedKey}
              rowIndex={rowIndex}
              keyIndex={keyIndex}
            />
          );
        });
      })}
    </group>
  );
};

// Floating particles background
const Particles = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 200;
  
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
  }

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
      pointsRef.current.rotation.x = state.clock.elapsedTime * 0.01;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#6366f1" transparent opacity={0.6} />
    </points>
  );
};

// Scene Component
const Scene = ({ pressedKey }: { pressedKey: string }) => {
  return (
    <>
      <ambientLight intensity={1.5} />
      <pointLight position={[10, 10, 10]} intensity={2} color="#ffffff" />
      <pointLight position={[-10, 10, 5]} intensity={1.5} color="#a5b4fc" />
      <pointLight position={[0, 5, 10]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[0, 10, 5]} intensity={1} color="#ffffff" />
      <spotLight
        position={[0, 15, 0]}
        angle={0.5}
        penumbra={1}
        intensity={2}
        castShadow
        color="#ffffff"
      />
      <Particles />
      <Keyboard3D pressedKey={pressedKey} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
};

interface Keyboard3DCanvasProps {
  pressedKey: string;
}

const Keyboard3DCanvas = ({ pressedKey }: Keyboard3DCanvasProps) => {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas camera={{ position: [0, 5, 12], fov: 45 }}>
        <color attach="background" args={["#050816"]} />
        <Scene pressedKey={pressedKey} />
      </Canvas>
    </div>
  );
};

export default Keyboard3DCanvas;
