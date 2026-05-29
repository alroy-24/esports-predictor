"use client";

import { motion } from "framer-motion";
import { Info } from "lucide-react";
import type { ShapItem } from "@/lib/types";
import { InfoTip } from "@/components/ui/InfoTip";
import { featureHint, featureLabel } from "@/lib/utils";

/**
 * SHAP attribution chart. Each feature gets a bar growing left (favors team B,
 * fuchsia) or right (favors team A, cyan) from a center axis, scaled to the
 * largest-magnitude contribution. Bars stagger in on mount.
 */
export function ShapExplanation({ items }: { items: ShapItem[] }) {
  const max = Math.max(...items.map((i) => Math.abs(i.shap)), 1e-6);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Why the model picked this
        </span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teamB" /> favors {/* B */}B
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teamA" /> favors A
          </span>
        </span>
      </div>

      <ul className="space-y-2.5">
        {items.map((item, i) => {
          const frac = (Math.abs(item.shap) / max) * 50; // half-width %
          const toA = item.shap >= 0;
          return (
            <li key={item.feature} className="group">
              <div className="mb-1 flex items-center justify-between text-xs">
                <InfoTip label={featureHint(item.feature)}>
                  <span className="cursor-help font-medium text-slate-300 underline decoration-dotted decoration-slate-600 underline-offset-4">
                    {featureLabel(item.feature)}
                  </span>
                </InfoTip>
                <span
                  className={`font-mono ${toA ? "text-teamA" : "text-teamB"}`}
                >
                  {toA ? "+" : ""}
                  {item.shap.toFixed(3)}
                </span>
              </div>
              <div className="relative h-2.5 w-full rounded-full bg-black/40">
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
                <motion.div
                  className={`absolute inset-y-0 rounded-full ${
                    toA
                      ? "left-1/2 bg-gradient-to-r from-teamA/70 to-teamA"
                      : "right-1/2 bg-gradient-to-l from-teamB/70 to-teamB"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${frac}%` }}
                  transition={{
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.1 + i * 0.06,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
