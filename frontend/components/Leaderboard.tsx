"use client";

import { motion } from "framer-motion";
import type { Team } from "@/lib/types";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { cn, regionClasses } from "@/lib/utils";

/** Elo leaderboard with bars scaled between the min and max rating on screen. */
export function Leaderboard({ teams, limit = 12 }: { teams: Team[]; limit?: number }) {
  const ranked = [...teams].sort((a, b) => b.elo - a.elo).slice(0, limit);
  if (ranked.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No teams yet.</p>;
  }

  const max = ranked[0].elo;
  const min = Math.min(...ranked.map((t) => t.elo));
  const span = Math.max(max - min, 1);

  return (
    <ol className="space-y-2">
      {ranked.map((t, i) => {
        const frac = 0.25 + 0.75 * ((t.elo - min) / span); // keep small bars visible
        const top3 = i < 3;
        return (
          <motion.li
            key={t.id}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            className="group relative flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]"
          >
            <span
              className={cn(
                "w-6 text-center font-mono text-sm",
                top3 ? "font-bold text-accent" : "text-slate-500"
              )}
            >
              {i + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <TeamLogo name={t.name} logoUrl={t.logo_url} size={20} />
                  <span className="truncate text-sm font-semibold text-white">
                    {t.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-1.5 py-0.5 text-[0.6rem] font-semibold",
                      regionClasses(t.region)
                    )}
                  >
                    {t.region ?? "—"}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm text-slate-300">
                  <AnimatedNumber value={t.elo} decimals={0} />
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/30">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    top3
                      ? "bg-gradient-to-r from-accent to-teamA"
                      : "bg-gradient-to-r from-slate-600 to-slate-400"
                  )}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${frac * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
                />
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
