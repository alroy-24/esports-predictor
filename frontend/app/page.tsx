"use client";

import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Gauge,
  ListOrdered,
  TriangleAlert,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import type { Health, Match, Metrics, Player, Team } from "@/lib/types";
import { Header } from "@/components/Header";
import { Leaderboard } from "@/components/Leaderboard";
import { RecentMatches } from "@/components/RecentMatches";
import { ModelPerformance } from "@/components/charts/ModelPerformance";
import { PlayerCompare } from "@/components/players/PlayerCompare";
import { PredictPanel } from "@/components/predict/PredictPanel";
import { SceneCanvas } from "@/components/three/SceneCanvas";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { SectionCard, SectionHeader } from "@/components/ui/SectionCard";

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [h, t, m, mx, pl] = await Promise.all([
          api.health().catch(() => null),
          api.teams(),
          api.matches(40),
          api.metrics().catch(() => null), // 404 before first train
          api.players().catch(() => []), // empty before first seed w/ rosters
        ]);
        if (!alive) return;
        setHealth(h);
        setTeams(t);
        setMatches(m);
        setMetrics(mx);
        setPlayers(pl);
      } catch {
        if (alive) setOffline(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <Header health={health} />

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:pt-14">
        <Hero teamCount={teams.length} matchCount={matches.length} />

        {offline ? (
          <OfflineNotice />
        ) : loading ? (
          <LoadingState />
        ) : (
          <div className="mt-10 space-y-6">
            <SectionCard>
              <SectionHeader
                eyebrow="Predict"
                title="Matchup simulator"
                icon={<BarChart3 className="h-5 w-5 text-accent" />}
              />
              <PredictPanel teams={teams} />
            </SectionCard>

            {players.length > 0 && (
              <SectionCard delay={0.05}>
                <SectionHeader
                  eyebrow="Players"
                  title="Tale of the tape"
                  icon={<Users className="h-5 w-5 text-teamB" />}
                  right={
                    <span className="hidden text-xs text-slate-500 sm:block">
                      {players.length} players · {teams.length} rosters
                    </span>
                  }
                />
                <PlayerCompare
                  players={players}
                  teamLogos={Object.fromEntries(teams.map((t) => [t.name, t.logo_url]))}
                />
              </SectionCard>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard delay={0.05}>
                <SectionHeader
                  eyebrow="Rankings"
                  title="Elo leaderboard"
                  icon={<Trophy className="h-5 w-5 text-amber-300" />}
                />
                <Leaderboard teams={teams} />
              </SectionCard>

              <SectionCard delay={0.1}>
                <SectionHeader
                  eyebrow="Live feed"
                  title="Recent results"
                  icon={<ListOrdered className="h-5 w-5 text-teamA" />}
                />
                <RecentMatches
                  matches={matches}
                  teamLogos={Object.fromEntries(teams.map((t) => [t.name, t.logo_url]))}
                />
              </SectionCard>
            </div>

            {metrics && (
              <SectionCard delay={0.05}>
                <SectionHeader
                  eyebrow="Trust"
                  title="Model performance"
                  icon={<Gauge className="h-5 w-5 text-emerald-300" />}
                  right={
                    <span className="hidden text-xs text-slate-500 sm:block">
                      {metrics.n_matches.toLocaleString()} matches ·{" "}
                      {metrics.n_test.toLocaleString()} held out
                    </span>
                  }
                />
                <ModelPerformance metrics={metrics} />
              </SectionCard>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Hero({ teamCount, matchCount }: { teamCount: number; matchCount: number }) {
  return (
    <section className="relative text-center">
      {/* Interactive 3D backdrop, sized to sit behind the headline. */}
      <SceneCanvas className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[min(640px,90vw)] -translate-x-1/2 -translate-y-[55%] opacity-80" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-3xl"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-slate-300">
          <Activity className="h-3.5 w-3.5 text-teamA" />
          Calibrated probabilities · not just accuracy
        </span>
        <h1 className="mt-6 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
          Who wins the next <span className="gradient-text">CS2</span> match?
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-base text-slate-400 sm:text-lg">
          An XGBoost model trained on team Elo, recent form, head-to-head and
          match context — with SHAP explanations for every call.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.12 }}
        className="mx-auto mt-9 flex max-w-md items-center justify-center gap-3"
      >
        <StatChip label="Teams" value={teamCount} />
        <StatChip label="Matches" value={matchCount} suffix="+" />
        <StatChip label="Features" value={15} />
      </motion.div>
    </section>
  );
}

function StatChip({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="glass-soft flex-1 px-4 py-3">
      <div className="font-display text-2xl font-bold text-white">
        <AnimatedNumber value={value} suffix={suffix} />
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function OfflineNotice() {
  return (
    <div className="glass mt-10 flex flex-col items-center gap-3 p-10 text-center">
      <TriangleAlert className="h-9 w-9 text-amber-400" />
      <h3 className="text-lg font-semibold text-white">Can&apos;t reach the API</h3>
      <p className="max-w-md text-sm text-slate-400">
        The dashboard expects the FastAPI backend at{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5 text-teamA">{API_BASE}</code>.
        Start it with{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5 text-slate-200">
          uvicorn api:app --reload --port 8000
        </code>{" "}
        from the <code className="text-slate-200">backend/</code> folder (after
        seeding and training).
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-10 space-y-6">
      <div className="glass h-[360px] animate-pulse" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass h-80 animate-pulse" />
        <div className="glass h-80 animate-pulse" />
      </div>
    </div>
  );
}
