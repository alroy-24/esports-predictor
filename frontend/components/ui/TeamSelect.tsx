"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Team } from "@/lib/types";
import { cn, regionClasses } from "@/lib/utils";
import { TeamLogo } from "./TeamLogo";

interface Props {
  teams: Team[];
  value: Team | null;
  onChange: (team: Team) => void;
  accent: "a" | "b";
  placeholder?: string;
  disabledId?: number; // prevent picking the same team on both sides
}

/** Searchable team picker with a glowing, animated dropdown. */
export function TeamSelect({
  teams,
  value,
  onChange,
  accent,
  placeholder = "Select team",
  disabledId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [teams, query]);

  const ring = accent === "a" ? "focus-within:border-teamA/50" : "focus-within:border-teamB/50";
  const dot = accent === "a" ? "bg-teamA shadow-glow-a" : "bg-teamB shadow-glow-b";

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 text-left transition-colors",
          ring
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dot)} />
          <span className="min-w-0">
            {value ? (
              <span className="block truncate text-base font-semibold text-white">
                {value.name}
              </span>
            ) : (
              <span className="text-slate-400">{placeholder}</span>
            )}
            {value && (
              <span className="block text-xs text-slate-400">
                {value.region ?? "—"} · {Math.round(value.elo)} Elo
              </span>
            )}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-850/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-2.5">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teams…"
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
            <ul className="max-h-64 overflow-y-auto p-1.5">
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-slate-500">
                  No teams found
                </li>
              )}
              {filtered.map((t) => {
                const selected = value?.id === t.id;
                const disabled = disabledId === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onChange(t);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                        disabled
                          ? "cursor-not-allowed opacity-30"
                          : "hover:bg-white/5",
                        selected && "bg-white/5"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <TeamLogo name={t.name} logoUrl={t.logo_url} size={20} />
                        <span className="truncate font-medium text-white">{t.name}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold",
                            regionClasses(t.region)
                          )}
                        >
                          {t.region ?? "—"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">
                          {Math.round(t.elo)}
                        </span>
                        {selected && <Check className="h-4 w-4 text-teamA" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
