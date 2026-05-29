"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  Icosahedron,
  MeshDistortMaterial,
  Sphere,
  Stars,
} from "@react-three/drei";
import { useRef } from "react";
import type { Mesh, Group } from "three";

/**
 * Ambient 3D hero: a slowly morphing "core" orb caged in a wireframe
 * icosahedron, lit cyan from one side and fuchsia from the other, drifting in a
 * starfield. The whole rig parallaxes gently toward the pointer. Purely
 * decorative — loaded client-only via dynamic import (see SceneCanvas).
 */
function Rig() {
  const group = useRef<Group>(null);

  useFrame((stateThree) => {
    if (!group.current) return;
    const { x, y } = stateThree.pointer;
    // Ease the group toward a small rotation that tracks the pointer.
    group.current.rotation.y += (x * 0.4 - group.current.rotation.y) * 0.04;
    group.current.rotation.x += (-y * 0.25 - group.current.rotation.x) * 0.04;
  });

  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.7} floatIntensity={1.1}>
        <Core />
        <Cage />
      </Float>
    </group>
  );
}

function Core() {
  const mesh = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * 0.15;
  });
  return (
    <Sphere ref={mesh} args={[1.15, 96, 96]}>
      <MeshDistortMaterial
        color="#7c5cff"
        emissive="#3b1d80"
        emissiveIntensity={0.4}
        roughness={0.15}
        metalness={0.6}
        distort={0.38}
        speed={1.6}
      />
    </Sphere>
  );
}

function Cage() {
  const mesh = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (mesh.current) {
      mesh.current.rotation.x -= delta * 0.08;
      mesh.current.rotation.z += delta * 0.05;
    }
  });
  return (
    <Icosahedron ref={mesh} args={[1.9, 1]}>
      <meshBasicMaterial wireframe color="#22d3ee" transparent opacity={0.18} />
    </Icosahedron>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[4, 2, 3]} intensity={120} color="#22d3ee" />
      <pointLight position={[-4, -1, 2]} intensity={120} color="#f472b6" />
      <Stars
        radius={60}
        depth={40}
        count={1800}
        factor={4}
        saturation={0}
        fade
        speed={0.6}
      />
      <Rig />
    </Canvas>
  );
}
