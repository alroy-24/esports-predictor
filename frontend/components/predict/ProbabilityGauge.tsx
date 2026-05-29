"use client";

import { motion } from "framer-motion";
import type { Prediction } from "@/lib/types";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { TeamLogo } from "@/components/ui/TeamLogo";

/**
 * The hero result visual: two team names flanking a split bar that fills to the
 * win probability, plus large count-up percentages and Elo chips. The bar width
 * springs whenever a new prediction arrives.
 */
export function ProbabilityGauge({
  pred,
  logoA,
  logoB,
}: {
  pred: Prediction;
  logoA?: string | null;
  logoB?: string | null;
}) {
  const pctA = pred.prob_a * 100;
  const pctB = pred.prob_b * 100;
  const aFav = pred.prob_a >= pred.prob_b;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <TeamHead
          name={pred.team_a}
          elo={pred.elo_a}
          pct={pctA}
          favorite={aFav}
          side="a"
          logoUrl={logoA}
        />
        <div className="pb-1 text-center">
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
            win prob
          </div>
          <div className="font-display text-sm text-slate-400">vs</div>
        </div>
        <TeamHead
          name={pred.team_b}
          elo={pred.elo_b}
          pct={pctB}
          favorite={!aFav}
          side="b"
          alignRight
          logoUrl={logoB}
        />
      </div>

      {/* Split probability bar */}
      <div className="relative h-5 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-teamA/90 to-teamA"
          initial={{ width: 0 }}
          animate={{ width: `${pctA}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
        <motion.div
          className="absolute inset-y-0 right-0 bg-gradient-to-l from-teamB/90 to-teamB"
          initial={{ width: 0 }}
          animate={{ width: `${pctB}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
        {/* moving sheen */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/20 blur-md animate-shimmer" />
        </div>
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/30" />
      </div>

      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm">
          <span className="text-slate-400">Favorite</span>
          <span
            className={`font-semibold ${aFav ? "text-teamA" : "text-teamB"}`}
          >
            {pred.favorite}
          </span>
        </div>
      </div>
    </div>
  );
}

function TeamHead({
  name,
  elo,
  pct,
  favorite,
  side,
  alignRight,
  logoUrl,
}: {
  name: string;
  elo: number;
  pct: number;
  favorite: boolean;
  side: "a" | "b";
  alignRight?: boolean;
  logoUrl?: string | null;
}) {
  const color = side === "a" ? "text-teamA" : "text-teamB";
  return (
    <div className={`min-w-0 flex-1 ${alignRight ? "text-right" : ""}`}>
      <div
        className={`flex items-center gap-2 ${alignRight ? "flex-row-reverse" : ""}`}
      >
        <TeamLogo name={name} logoUrl={logoUrl} size={26} />
        <div
          className={`truncate text-lg font-semibold ${
            favorite ? "text-white" : "text-slate-300"
          }`}
          title={name}
        >
          {name}
        </div>
      </div>
      <div
        className={`font-display text-4xl font-bold transition-all sm:text-5xl ${color} ${
          favorite ? "" : "opacity-70"
        }`}
        style={
          favorite
            ? {
                textShadow:
                  side === "a"
                    ? "0 0 28px rgba(34,211,238,0.55)"
                    : "0 0 28px rgba(244,114,182,0.55)",
              }
            : undefined
        }
      >
        <AnimatedNumber value={pct} decimals={1} suffix="%" />
      </div>
      <div className="font-mono text-xs text-slate-500">
        <AnimatedNumber value={elo} decimals={0} /> Elo
      </div>
    </div>
  );
}
