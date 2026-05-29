"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { TeamStats } from "@/lib/types";

/**
 * Normalised feature-profile radar comparing the two selected teams. Each axis
 * is scaled 0–100 so wildly different units (Elo vs. win-rate vs. rest days)
 * sit on one chart. Driven by the real /teams/{name}/stats endpoint.
 */
function normalize(a: TeamStats, b: TeamStats) {
  // Elo: map a sensible pro range (1200–2100) onto 0–100.
  const elo = (v: number) => clamp(((v - 1200) / 900) * 100);
  // Rest: more rest is "fresher", saturating around 14 days.
  const rest = (v: number) => clamp((Math.min(v, 14) / 14) * 100);
  // Experience: saturate around 250 matches.
  const exp = (v: number) => clamp((Math.min(v, 250) / 250) * 100);
  const pct = (v: number) => clamp(v * 100);

  return [
    { axis: "Elo", a: elo(a.elo), b: elo(b.elo) },
    { axis: "Form", a: pct(a.form), b: pct(b.form) },
    { axis: "WR 30d", a: pct(a.winrate_30d), b: pct(b.winrate_30d) },
    { axis: "WR 90d", a: pct(a.winrate_90d), b: pct(b.winrate_90d) },
    { axis: "Freshness", a: rest(a.rest_days), b: rest(b.rest_days) },
    { axis: "Experience", a: exp(a.matches_played), b: exp(b.matches_played) },
  ];
}

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function TeamRadar({ a, b }: { a: TeamStats; b: TeamStats }) {
  const data = normalize(a, b);
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgba(148,163,184,0.18)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "rgba(203,213,225,0.7)", fontSize: 11 }}
          />
          <Radar
            name={a.name}
            dataKey="a"
            stroke="#22d3ee"
            fill="#22d3ee"
            fillOpacity={0.28}
            strokeWidth={2}
            isAnimationActive
          />
          <Radar
            name={b.name}
            dataKey="b"
            stroke="#f472b6"
            fill="#f472b6"
            fillOpacity={0.22}
            strokeWidth={2}
            isAnimationActive
          />
          <Tooltip
            contentStyle={{
              background: "rgba(14,17,32,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e2e8f0" }}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center justify-center gap-5 text-xs">
        <Legend color="#22d3ee" label={a.name} />
        <Legend color="#f472b6" label={b.name} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-300">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
