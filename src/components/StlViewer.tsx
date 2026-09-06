"use client";

import { Canvas } from "@react-three/fiber";
import { Center, OrbitControls, Bounds } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

interface StlViewerProps {
  positions: Float32Array;
  normals: Float32Array;
  className?: string;
}

function MeshFromBuffers({
  positions,
  normals,
}: {
  positions: Float32Array;
  normals: Float32Array;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.computeBoundingSphere();
    return geo;
  }, [positions, normals]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#60a5fa" metalness={0.35} roughness={0.4} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function StlViewer({ positions, normals, className }: StlViewerProps) {
  return (
    <div className={className ?? "h-72 w-full rounded-xl bg-slate-900"}>
      <Canvas camera={{ position: [80, 60, 80], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[50, 80, 40]} intensity={1.1} />
        <directionalLight position={[-40, -20, -30]} intensity={0.35} />
        <Bounds fit clip observe margin={1.4}>
          <Center>
            <MeshFromBuffers positions={positions} normals={normals} />
          </Center>
        </Bounds>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
