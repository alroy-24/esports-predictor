"use client";

import { useEffect, useState } from "react";
import { cn, initials } from "@/lib/utils";

interface Props {
  nickname: string;
  photoUrl: string | null;
  size?: number;
  className?: string;
  accent?: "a" | "b";
}

/**
 * Player portrait. Uses a plain <img> (avatars are tiny and external, so
 * next/image domain config isn't worth it) and falls back to a tinted initials
 * tile if the photo 404s or the network is unavailable.
 */
export function PlayerAvatar({
  nickname,
  photoUrl,
  size = 96,
  className,
  accent = "a",
}: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoUrl]);

  const ring = accent === "a" ? "ring-teamA/40" : "ring-teamB/40";
  const grad =
    accent === "a"
      ? "from-teamA/30 to-accent/20 text-teamA"
      : "from-teamB/30 to-accent/20 text-teamB";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl ring-2",
        ring,
        className
      )}
      style={{ width: size, height: size }}
    >
      {photoUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={nickname}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-gradient-to-br font-display text-xl font-bold",
            grad
          )}
        >
          {initials(nickname)}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
    </div>
  );
}
