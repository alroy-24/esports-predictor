import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-readable labels + descriptions for the raw model feature names. */
export const FEATURE_META: Record<string, { label: string; hint: string }> = {
  elo_diff: { label: "Elo gap", hint: "Difference in Elo rating" },
  elo_expected_a: { label: "Elo win expectancy", hint: "Elo-implied P(A wins)" },
  winrate_10d_diff: { label: "Form (10d)", hint: "Win-rate gap, last 10 days" },
  winrate_30d_diff: { label: "Form (30d)", hint: "Win-rate gap, last 30 days" },
  winrate_90d_diff: { label: "Form (90d)", hint: "Win-rate gap, last 90 days" },
  form_diff: { label: "Recency form", hint: "Recency-weighted win share gap" },
  map_margin_form_diff: {
    label: "Map-margin form",
    hint: "Recency-weighted average map-score margin gap (quality of wins)",
  },
  h2h_diff: { label: "Head-to-head", hint: "Historical H2H record gap" },
  rest_days_a: { label: "A rest days", hint: "Days since A last played" },
  rest_days_b: { label: "B rest days", hint: "Days since B last played" },
  matches_played_a: { label: "A experience", hint: "Matches A has played" },
  matches_played_b: { label: "B experience", hint: "Matches B has played" },
  tier_ordinal: { label: "Event tier", hint: "S=3, A=2, B=1" },
  is_lan: { label: "LAN", hint: "Played on LAN" },
  is_major: { label: "Major", hint: "Major championship" },
  best_of: { label: "Best-of", hint: "Series format" },
};

export function featureLabel(name: string): string {
  return FEATURE_META[name]?.label ?? name;
}

export function featureHint(name: string): string {
  return FEATURE_META[name]?.hint ?? name;
}

const REGION_COLORS: Record<string, string> = {
  EU: "text-sky-300 bg-sky-500/10 border-sky-400/20",
  NA: "text-rose-300 bg-rose-500/10 border-rose-400/20",
  SA: "text-amber-300 bg-amber-500/10 border-amber-400/20",
  CIS: "text-violet-300 bg-violet-500/10 border-violet-400/20",
  APAC: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20",
  OCE: "text-teal-300 bg-teal-500/10 border-teal-400/20",
};

export function regionClasses(region: string | null): string {
  return region && REGION_COLORS[region]
    ? REGION_COLORS[region]
    : "text-slate-300 bg-slate-500/10 border-slate-400/20";
}

const TIER_COLORS: Record<string, string> = {
  S: "text-amber-300 bg-amber-500/10 border-amber-400/30",
  A: "text-violet-300 bg-violet-500/10 border-violet-400/30",
  B: "text-slate-300 bg-slate-500/10 border-slate-400/20",
};

export function tierClasses(tier: string | null): string {
  return tier && TIER_COLORS[tier]
    ? TIER_COLORS[tier]
    : "text-slate-300 bg-slate-500/10 border-slate-400/20";
}

/** ISO-2 country code -> emoji flag (regional indicator letters). */
export function flagEmoji(code: string | null): string {
  if (!code || code.length !== 2) return "🏳️";
  const base = 0x1f1e6;
  const cc = code.toUpperCase();
  return String.fromCodePoint(
    base + (cc.charCodeAt(0) - 65),
    base + (cc.charCodeAt(1) - 65)
  );
}

/** Initials fallback used when a player photo fails to load. */
export function initials(nick: string): string {
  return nick.slice(0, 2).toUpperCase();
}

/** Stats shown in the player tale-of-the-tape, with display metadata. */
export const PLAYER_STATS = [
  { key: "rating", label: "Rating 2.0", decimals: 2, suffix: "", higherBetter: true },
  { key: "kd", label: "K/D", decimals: 2, suffix: "", higherBetter: true },
  { key: "adr", label: "ADR", decimals: 1, suffix: "", higherBetter: true },
  { key: "kast", label: "KAST", decimals: 1, suffix: "%", higherBetter: true },
  { key: "hs_pct", label: "Headshot %", decimals: 1, suffix: "%", higherBetter: true },
  {
    key: "maps_played",
    label: "Maps played",
    decimals: 0,
    suffix: "",
    higherBetter: true,
  },
] as const;

/** Compact relative time, e.g. "3d ago", "2h ago". */
export function timeAgo(iso: string): string {
  const then = new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime();
  const secs = Math.max(0, (Date.now() - then) / 1000);
  const units: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [30, "d"],
    [12, "mo"],
  ];
  let value = secs;
  let unit = "s";
  for (const [step, label] of units) {
    if (value < step) {
      unit = label;
      break;
    }
    value /= step;
    unit = label;
  }
  return `${Math.floor(value)}${unit} ago`;
}
