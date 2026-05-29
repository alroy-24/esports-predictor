"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface Option<T extends string | number> {
  label: string;
  value: T;
}

interface Props<T extends string | number> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** iOS-style segmented control with a shared layout-animated highlight pill. */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: Props<T>) {
  const layoutId = useId();
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-white/10 bg-black/30 p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              active ? "text-white" : "text-slate-400 hover:text-slate-200"
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-accent/80 to-teamA/70 shadow-glow-accent"
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
