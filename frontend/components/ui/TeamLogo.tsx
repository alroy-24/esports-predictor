"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Team logo with a graceful initials fallback (PandaScore logos can be null). */
export function TeamLogo({
  name,
  logoUrl,
  size = 24,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logoUrl]);

  if (logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("shrink-0 object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md bg-white/10 font-display text-[0.6rem] font-bold text-slate-300",
        className
      )}
      style={{ width: size, height: size }}
    >
      {name.slice(0, 3).toUpperCase()}
    </span>
  );
}
