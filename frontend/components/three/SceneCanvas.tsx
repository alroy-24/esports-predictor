"use client";

import dynamic from "next/dynamic";

// WebGL can't render on the server, so the scene is client-only. A lightweight
// blurred placeholder holds the layout while three.js + the scene chunk load.
const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full">
      <div className="mx-auto mt-8 h-48 w-48 animate-pulse rounded-full bg-accent/20 blur-2xl" />
    </div>
  ),
});

export function SceneCanvas({ className }: { className?: string }) {
  return (
    <div className={className}>
      <HeroScene />
    </div>
  );
}
