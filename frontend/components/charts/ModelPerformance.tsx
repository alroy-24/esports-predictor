"use client";

import { motion } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Metrics } from "@/lib/types";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

/**
 * Two-part performance panel:
 *  - reliability diagram (predicted vs. observed win frequency) vs. the perfect
 *    diagonal — the headline "calibration" story.
 *  - metric cards comparing the calibrated model against the Elo baseline.
 */
export function ModelPerformance({ metrics }: { metrics: Metrics }) {
  const data = metrics.reliability.map((d) => ({
    pred: +(d.pred * 100).toFixed(1),
    obs: +(d.obs * 100).toFixed(1),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="eyebrow mb-3">Reliability diagram · test set</p>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 12, bottom: 4, left: -16 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis
                dataKey="pred"
                type="number"
                domain={[0, 100]}
                tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: "Predicted",
                  position: "insideBottom",
                  offset: -2,
                  fill: "rgba(148,163,184,0.6)",
                  fontSize: 11,
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              {/* Perfect-calibration diagonal for reference. */}
              <ReferenceLine
                segment={[
                  { x: 0, y: 0 },
                  { x: 100, y: 100 },
                ]}
                stroke="rgba(148,163,184,0.4)"
                strokeDasharray="4 4"
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(14,17,32,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v}%`, "observed"]}
                labelFormatter={(v) => `predicted ${v}%`}
              />
              <Line
                type="monotone"
                dataKey="obs"
                stroke="#a78bfa"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#22d3ee" }}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={900}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Points hugging the dashed line mean the model&apos;s 70% really happens
          ~70% of the time.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 self-center">
        <MetricCard
          label="Accuracy"
          model={metrics.model.accuracy}
          baseline={metrics.baseline.accuracy}
          pct
          higherBetter
        />
        <MetricCard
          label="AUC"
          model={metrics.model.auc}
          baseline={metrics.baseline.auc}
          decimals={3}
          higherBetter
        />
        <MetricCard
          label="Log loss"
          model={metrics.model.log_loss}
          baseline={metrics.baseline.log_loss}
          decimals={3}
          higherBetter={false}
        />
        <MetricCard
          label="Brier"
          model={metrics.model.brier}
          baseline={metrics.baseline.brier}
          decimals={3}
          higherBetter={false}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  model,
  baseline,
  decimals = 0,
  pct = false,
  higherBetter,
}: {
  label: string;
  model: number;
  baseline: number;
  decimals?: number;
  pct?: boolean;
  higherBetter: boolean;
}) {
  const better = higherBetter ? model >= baseline : model <= baseline;
  const shown = pct ? model * 100 : model;
  const delta = (higherBetter ? model - baseline : baseline - model) * (pct ? 100 : 1);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="glass-soft p-4"
    >
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-white">
        <AnimatedNumber value={shown} decimals={pct ? 1 : decimals} suffix={pct ? "%" : ""} />
      </div>
      <div
        className={`mt-1 text-[0.7rem] font-medium ${
          better ? "text-emerald-300" : "text-slate-500"
        }`}
      >
        {delta >= 0 ? "▲ +" : "▼ "}
        {delta.toFixed(pct ? 1 : decimals)} vs Elo
      </div>
    </motion.div>
  );
}
