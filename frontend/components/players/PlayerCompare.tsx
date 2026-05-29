"use client";

import { motion } from "framer-motion";
import { ArrowLeftRight, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Player, TeamStats } from "@/lib/types";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { cn, flagEmoji } from "@/lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";
import { PlayerSelect } from "./PlayerSelect";

interface Row {
  label: string;
  aVal: number;
  bVal: number;
  decimals: number;
  suffix: string;
}

// Per-player performance stats that may exist if a paid data tier is connected.
const PERF_STATS: { key: keyof Player; label: string; decimals: number; suffix: string }[] = [
  { key: "rating", label: "Rating 2.0", decimals: 2, suffix: "" },
  { key: "kd", label: "K/D", decimals: 2, suffix: "" },
  { key: "adr", label: "ADR", decimals: 1, suffix: "" },
  { key: "kast", label: "KAST", decimals: 1, suffix: "%" },
  { key: "hs_pct", label: "Headshot %", decimals: 1, suffix: "%" },
];

export function PlayerCompare({
  players,
  teamLogos = {},
}: {
  players: Player[];
  teamLogos?: Record<string, string | null | undefined>;
}) {
  const [a, setA] = useState<Player | null>(null);
  const [b, setB] = useState<Player | null>(null);
  const [teamStats, setTeamStats] = useState<Record<string, TeamStats>>({});

  // Default to two players from different teams, oldest rosters first feel real.
  useEffect(() => {
    if (players.length >= 2 && !a && !b) {
      const first = players[0];
      const second = players.find((p) => p.team !== first.team) ?? players[1];
      setA(first);
      setB(second);
    }
  }, [players, a, b]);

  // Fetch the real team-context stats (Elo/form/win-rate from real matches).
  useEffect(() => {
    for (const team of [a?.team, b?.team]) {
      if (team && !teamStats[team]) {
        api
          .teamStats(team)
          .then((s) => setTeamStats((prev) => ({ ...prev, [team]: s })))
          .catch(() => {});
      }
    }
  }, [a, b, teamStats]);

  const tsA = a ? teamStats[a.team] : undefined;
  const tsB = b ? teamStats[b.team] : undefined;

  // Build comparison rows: real per-player perf stats if present, otherwise the
  // real team-context numbers derived from match history.
  const { rows, hasPerf } = useMemo(() => {
    if (!a || !b) return { rows: [] as Row[], hasPerf: false };
    const out: Row[] = [];

    let perf = false;
    for (const s of PERF_STATS) {
      const av = a[s.key];
      const bv = b[s.key];
      if (typeof av === "number" && typeof bv === "number") {
        perf = true;
        out.push({ label: s.label, aVal: av, bVal: bv, decimals: s.decimals, suffix: s.suffix });
      }
    }

    if (tsA && tsB) {
      out.push({ label: "Team Elo", aVal: tsA.elo, bVal: tsB.elo, decimals: 0, suffix: "" });
      out.push({
        label: "Team form",
        aVal: tsA.form * 100,
        bVal: tsB.form * 100,
        decimals: 0,
        suffix: "%",
      });
      out.push({
        label: "Team win% (90d)",
        aVal: tsA.winrate_90d * 100,
        bVal: tsB.winrate_90d * 100,
        decimals: 0,
        suffix: "%",
      });
    }
    return { rows: out, hasPerf: perf };
  }, [a, b, tsA, tsB]);

  const edges = useMemo(() => {
    let ca = 0;
    let cb = 0;
    for (const r of rows) {
      if (r.aVal > r.bVal) ca++;
      else if (r.bVal > r.aVal) cb++;
    }
    return { a: ca, b: cb };
  }, [rows]);

  function swap() {
    setA(b);
    setB(a);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <PlayerSelect players={players} value={a} onChange={setA} accent="a" disabledId={b?.id} />
        <button
          type="button"
          onClick={swap}
          aria-label="Swap players"
          className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:rotate-180 hover:border-accent/40 hover:text-white"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <PlayerSelect players={players} value={b} onChange={setB} accent="b" disabledId={a?.id} />
      </div>

      {a && b && (
        <motion.div
          key={`${a.id}-${b.id}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-5"
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <PlayerHeader player={a} accent="a" edge={edges.a} other={edges.b} logoUrl={teamLogos[a.team]} />
            <div className="self-center text-center font-display text-2xl font-bold text-slate-500">
              VS
            </div>
            <PlayerHeader
              player={b}
              accent="b"
              edge={edges.b}
              other={edges.a}
              logoUrl={teamLogos[b.team]}
              alignRight
            />
          </div>

          {!hasPerf && (
            <p className="flex items-start gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Per-player stats (Rating 2.0 / ADR / KAST) require a paid data tier — comparing on
              real <span className="text-slate-300">team context</span> from match history instead.
            </p>
          )}

          <div className="space-y-3.5 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
            {rows.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">Loading team context…</p>
            ) : (
              rows.map((r, i) => <StatRow key={r.label} {...r} delay={i * 0.05} />)
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function PlayerHeader({
  player,
  accent,
  edge,
  other,
  logoUrl,
  alignRight,
}: {
  player: Player;
  accent: "a" | "b";
  edge: number;
  other: number;
  logoUrl?: string | null;
  alignRight?: boolean;
}) {
  const color = accent === "a" ? "text-teamA" : "text-teamB";
  const winning = edge > other;
  return (
    <div className={cn("flex items-center gap-3", alignRight && "flex-row-reverse text-right")}>
      <PlayerAvatar nickname={player.nickname} photoUrl={player.photo_url} size={76} accent={accent} />
      <div className="min-w-0">
        <div className={cn("flex items-center gap-1.5", alignRight && "flex-row-reverse")}>
          <span className={cn("truncate text-lg font-bold", color)}>{player.nickname}</span>
          <span className="text-base">{flagEmoji(player.nationality)}</span>
        </div>
        {player.name && <div className="truncate text-xs text-slate-400">{player.name}</div>}
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1.5 text-xs text-slate-500",
            alignRight && "flex-row-reverse"
          )}
        >
          <TeamLogo name={player.team} logoUrl={logoUrl} size={14} />
          <span className="truncate">
            {player.team}
            {player.role ? ` · ${player.role}` : ""}
            {player.age ? ` · ${player.age}y` : ""}
          </span>
        </div>
        <div
          className={cn(
            "mt-1 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold",
            winning
              ? accent === "a"
                ? "border-teamA/40 bg-teamA/10 text-teamA"
                : "border-teamB/40 bg-teamB/10 text-teamB"
              : "border-white/10 bg-white/5 text-slate-400"
          )}
        >
          {edge} {edge === 1 ? "category" : "categories"} won
        </div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  aVal,
  bVal,
  decimals,
  suffix,
  delay,
}: Row & { delay: number }) {
  const total = aVal + bVal || 1;
  const aPct = (aVal / total) * 100;
  const bPct = (bVal / total) * 100;
  const aWins = aVal > bVal;
  const bWins = bVal > aVal;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className={cn("font-mono font-semibold tabular-nums", aWins ? "text-teamA" : "text-slate-400")}>
          <AnimatedNumber value={aVal} decimals={decimals} suffix={suffix} />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className={cn("font-mono font-semibold tabular-nums", bWins ? "text-teamB" : "text-slate-400")}>
          <AnimatedNumber value={bVal} decimals={decimals} suffix={suffix} />
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-black/40">
        <motion.div
          className={cn(
            "absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-teamA/70 to-teamA",
            aWins && "shadow-glow-a"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${aPct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20, delay }}
        />
        <motion.div
          className={cn(
            "absolute inset-y-0 right-0 rounded-r-full bg-gradient-to-l from-teamB/70 to-teamB",
            bWins && "shadow-glow-b"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${bPct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20, delay }}
        />
      </div>
    </div>
  );
}
