"use client";

import { motion } from "framer-motion";
import type { Match } from "@/lib/types";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { cn, tierClasses, timeAgo } from "@/lib/utils";

/** Scrollable feed of recent results; the winning team + score are highlighted. */
export function RecentMatches({
  matches,
  teamLogos = {},
}: {
  matches: Match[];
  teamLogos?: Record<string, string | null | undefined>;
}) {
  if (matches.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No matches yet.</p>;
  }

  return (
    <ul className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
      {matches.map((m, i) => {
        const aWon = m.winner === "a";
        return (
          <motion.li
            key={m.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.4) }}
            className="glass-soft flex items-center gap-3 px-3.5 py-2.5"
          >
            <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
              <span
                className={cn(
                  "flex min-w-0 items-center justify-end gap-1.5 text-sm font-medium",
                  aWon ? "text-white" : "text-slate-500"
                )}
              >
                <span className="truncate">{m.team_a}</span>
                <TeamLogo name={m.team_a} logoUrl={teamLogos[m.team_a]} size={18} />
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1 font-mono text-sm">
                <span className={aWon ? "font-bold text-teamA" : "text-slate-500"}>
                  {m.score_a}
                </span>
                <span className="text-slate-600">:</span>
                <span className={!aWon ? "font-bold text-teamB" : "text-slate-500"}>
                  {m.score_b}
                </span>
              </span>
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1.5 text-sm font-medium",
                  !aWon ? "text-white" : "text-slate-500"
                )}
              >
                <TeamLogo name={m.team_b} logoUrl={teamLogos[m.team_b]} size={18} />
                <span className="truncate">{m.team_b}</span>
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[0.6rem] font-semibold",
                  tierClasses(m.event_tier)
                )}
              >
                {m.event_tier ?? "—"}
              </span>
              <span className="hidden w-14 text-right font-mono text-[0.65rem] text-slate-500 sm:block">
                {timeAgo(m.played_at)}
              </span>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
