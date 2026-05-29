"use client";

/**
 * Ambient animated backdrop: three drifting aurora blobs behind a faint grid.
 * Purely decorative and pointer-events-none so it never blocks interaction.
 */
export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-grid" />
      <div className="absolute -left-[10%] top-[-15%] h-[55vh] w-[55vh] rounded-full bg-teamA/25 blur-[120px] animate-aurora" />
      <div className="absolute right-[-10%] top-[5%] h-[50vh] w-[50vh] rounded-full bg-accent/25 blur-[120px] animate-aurora-slow" />
      <div className="absolute bottom-[-20%] left-[35%] h-[55vh] w-[55vh] rounded-full bg-teamB/20 blur-[130px] animate-aurora" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink-950" />
    </div>
  );
}
