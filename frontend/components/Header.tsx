"use client";

import { motion } from "framer-motion";
import { Crosshair, Github } from "lucide-react";
import type { Health } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Header({ health }: { health: Health | null }) {
  const online = health?.status === "ok";
  const modelReady = !!health?.model_loaded;

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/60 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-teamA shadow-glow-accent">
            <Crosshair className="h-5 w-5 text-ink-950" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold tracking-tight text-white">
              Frag <span className="gradient-text">Forecast</span>
            </p>
            <p className="text-[0.65rem] text-slate-500">
              Calibrated XGBoost · live dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusPill
            online={online}
            label={
              !online ? "API offline" : modelReady ? "Model live" : "No model"
            }
            ok={online && modelReady}
          />
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg border border-white/10 p-2 text-slate-400 transition hover:text-white sm:block"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </motion.header>
  );
}

function StatusPill({
  online,
  ok,
  label,
}: {
  online: boolean;
  ok: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        ok
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
          : online
            ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
            : "border-rose-400/30 bg-rose-500/10 text-rose-300"
      )}
    >
      <span className="relative flex h-2 w-2">
        {ok && (
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            ok ? "bg-emerald-400" : online ? "bg-amber-400" : "bg-rose-400"
          )}
        />
      </span>
      {label}
    </span>
  );
}
