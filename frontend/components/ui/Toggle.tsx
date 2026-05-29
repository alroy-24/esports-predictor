"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon?: React.ReactNode;
}

/** Animated switch with an icon + label, used for LAN / Major flags. */
export function Toggle({ checked, onChange, label, icon }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors",
        checked
          ? "border-accent/40 bg-accent/10 text-white shadow-glow-accent"
          : "border-white/10 bg-black/20 text-slate-400 hover:text-slate-200"
      )}
    >
      <span
        className={cn(
          "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-accent/80" : "bg-white/15"
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow",
            checked ? "ml-auto" : ""
          )}
        />
      </span>
      {icon}
      {label}
    </button>
  );
}
