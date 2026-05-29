import confetti from "canvas-confetti";

/**
 * Celebratory burst fired when the model is highly confident in a favorite.
 * Tinted to the winning side (cyan = team A, fuchsia = team B). No-op on the
 * server; only ever called from client event handlers.
 */
export function celebrate(side: "a" | "b") {
  const colors =
    side === "a" ? ["#22d3ee", "#06b6d4", "#a78bfa"] : ["#f472b6", "#ec4899", "#a78bfa"];

  const fire = (particleRatio: number, opts: confetti.Options) =>
    confetti({
      origin: { y: 0.7 },
      colors,
      disableForReducedMotion: true,
      particleCount: Math.floor(180 * particleRatio),
      ...opts,
    });

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}
