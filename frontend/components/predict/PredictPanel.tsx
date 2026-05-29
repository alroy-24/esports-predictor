"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Radar, Sparkles, Swords, TriangleAlert, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { celebrate } from "@/lib/confetti";
import type { Prediction, Team, TeamStats } from "@/lib/types";
import { TeamRadar } from "@/components/charts/TeamRadar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { TeamSelect } from "@/components/ui/TeamSelect";
import { ProbabilityGauge } from "./ProbabilityGauge";
import { ShapExplanation } from "./ShapExplanation";

const STRONG_FAVORITE = 0.7;

export function PredictPanel({ teams }: { teams: Team[] }) {
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [tier, setTier] = useState<string>("A");
  const [bestOf, setBestOf] = useState<number>(3);
  const [lan, setLan] = useState(false);
  const [major, setMajor] = useState(false);

  const [pred, setPred] = useState<Prediction | null>(null);
  const [stats, setStats] = useState<{ a: TeamStats; b: TeamStats } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sensible default matchup: the two highest-Elo teams.
  useEffect(() => {
    if (teams.length >= 2 && !teamA && !teamB) {
      const sorted = [...teams].sort((a, b) => b.elo - a.elo);
      setTeamA(sorted[0]);
      setTeamB(sorted[1]);
    }
  }, [teams, teamA, teamB]);

  async function runPredict() {
    if (!teamA || !teamB) return;
    setLoading(true);
    setError(null);
    try {
      const [result, statsA, statsB] = await Promise.all([
        api.predict({
          team_a: teamA.name,
          team_b: teamB.name,
          event_tier: tier,
          is_lan: lan,
          is_major: major,
          best_of: bestOf,
        }),
        api.teamStats(teamA.name),
        api.teamStats(teamB.name),
      ]);
      setPred(result);
      setStats({ a: statsA, b: statsB });

      const top = Math.max(result.prob_a, result.prob_b);
      const side = result.prob_a >= result.prob_b ? "a" : "b";
      if (top >= STRONG_FAVORITE) {
        celebrate(side);
        toast.success(`${result.favorite} is a strong favorite`, {
          description: `${(top * 100).toFixed(1)}% win probability`,
        });
      } else {
        toast(`Close one: ${result.favorite} edges it`, {
          description: `${(top * 100).toFixed(1)}% to ${(100 - top * 100).toFixed(1)}%`,
        });
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Prediction failed.";
      setError(msg);
      setPred(null);
      setStats(null);
      toast.error("Couldn't run prediction", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  function swap() {
    setTeamA(teamB);
    setTeamB(teamA);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
      {/* ---- Controls ---- */}
      <div className="space-y-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamSelect
            teams={teams}
            value={teamA}
            onChange={setTeamA}
            accent="a"
            disabledId={teamB?.id}
          />
          <button
            type="button"
            onClick={swap}
            aria-label="Swap teams"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:rotate-180 hover:border-accent/40 hover:text-white"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <TeamSelect
            teams={teams}
            value={teamB}
            onChange={setTeamB}
            accent="b"
            disabledId={teamA?.id}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="eyebrow mb-2">Event tier</p>
            <SegmentedControl
              value={tier}
              onChange={setTier}
              options={[
                { label: "S", value: "S" },
                { label: "A", value: "A" },
                { label: "B", value: "B" },
              ]}
            />
          </div>
          <div>
            <p className="eyebrow mb-2">Best of</p>
            <SegmentedControl
              value={bestOf}
              onChange={setBestOf}
              options={[
                { label: "Bo1", value: 1 },
                { label: "Bo3", value: 3 },
                { label: "Bo5", value: 5 },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Toggle
            checked={lan}
            onChange={setLan}
            label="LAN"
            icon={<Wifi className="h-4 w-4" />}
          />
          <Toggle
            checked={major}
            onChange={setMajor}
            label="Major"
            icon={<Sparkles className="h-4 w-4" />}
          />
        </div>

        <motion.button
          type="button"
          onClick={runPredict}
          disabled={loading || !teamA || !teamB}
          whileTap={{ scale: 0.98 }}
          className="group relative w-full overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-r from-accent/80 via-violet-500/70 to-teamA/70 px-6 py-4 text-base font-semibold text-white shadow-glow-accent transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-0" />
          <span className="relative flex items-center justify-center gap-2">
            {loading ? (
              <>
                <Spinner /> Crunching the matchup…
              </>
            ) : (
              <>
                <Swords className="h-5 w-5" /> Predict outcome
              </>
            )}
          </span>
        </motion.button>
      </div>

      {/* ---- Result ---- */}
      <div className="glass-soft min-h-[320px] p-6">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center gap-3 text-center"
            >
              <TriangleAlert className="h-8 w-8 text-amber-400" />
              <p className="max-w-xs text-sm text-slate-400">{error}</p>
            </motion.div>
          ) : pred ? (
            <motion.div
              key={`${pred.team_a}-${pred.team_b}-${pred.prob_a}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="space-y-7"
            >
              <ProbabilityGauge
                pred={pred}
                logoA={teams.find((t) => t.name === pred.team_a)?.logo_url}
                logoB={teams.find((t) => t.name === pred.team_b)?.logo_url}
              />
              <div className="h-px w-full bg-white/10" />
              <ShapExplanation items={pred.explanation} />
              {stats && (
                <>
                  <div className="h-px w-full bg-white/10" />
                  <div>
                    <p className="eyebrow mb-1 flex items-center gap-1.5">
                      <Radar className="h-3.5 w-3.5" /> Team profile
                    </p>
                    <TeamRadar a={stats.a} b={stats.b} />
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-500"
            >
              <div className="relative">
                <Swords className="h-10 w-10 text-slate-600" />
                <span className="absolute inset-0 -z-10 rounded-full bg-accent/30 blur-xl" />
              </div>
              <p className="max-w-xs text-sm">
                Pick two teams and hit <span className="text-slate-300">Predict</span> to
                see calibrated win probabilities and a SHAP breakdown.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  );
}
