"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "@/lib/types";
import { cn, flagEmoji } from "@/lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";

interface Props {
  players: Player[];
  value: Player | null;
  onChange: (p: Player) => void;
  accent: "a" | "b";
  disabledId?: number;
}

/** Searchable player picker showing avatar, team, role and rating per row. */
export function PlayerSelect({
  players,
  value,
  onChange,
  accent,
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
    return players.filter(
      (p) =>
        !q ||
        p.nickname.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        (p.name ?? "").toLowerCase().includes(q)
    );
  }, [players, query]);

  const ring = accent === "a" ? "focus-within:border-teamA/50" : "focus-within:border-teamB/50";

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 text-left transition-colors",
          ring
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          {value ? (
            <>
              <PlayerAvatar
                nickname={value.nickname}
                photoUrl={value.photo_url}
                size={36}
                accent={accent}
              />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-white">
                  {value.nickname}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {value.team} · {value.role}
                </span>
              </span>
            </>
          ) : (
            <span className="px-1 text-slate-400">Select player</span>
          )}
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
                placeholder="Search players or teams…"
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto p-1.5">
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-slate-500">
                  No players found
                </li>
              )}
              {filtered.map((p) => {
                const selected = value?.id === p.id;
                const disabled = disabledId === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onChange(p);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors",
                        disabled ? "cursor-not-allowed opacity-30" : "hover:bg-white/5",
                        selected && "bg-white/5"
                      )}
                    >
                      <PlayerAvatar
                        nickname={p.nickname}
                        photoUrl={p.photo_url}
                        size={32}
                        accent={accent}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-white">
                            {p.nickname}
                          </span>
                          <span className="text-xs">{flagEmoji(p.nationality)}</span>
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {p.team} · {p.role}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-slate-400">
                        {p.rating != null ? p.rating.toFixed(2) : p.role || ""}
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-teamA" />}
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
