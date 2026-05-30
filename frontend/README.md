# 🎨 Frontend — Frag Forecast

The dashboard. Next.js 14 (App Router) + TypeScript + Tailwind, with an animated
3D hero, a live matchup simulator, SHAP explanations, a player "tale of the tape"
with real photos, an Elo leaderboard, and a model-reliability panel.

> For the project overview and metrics, see the [root README](../README.md).
> For the API it talks to, see the [backend README](../backend/README.md).

---

## Screenshots

See the **[Demo gallery in the root README](../README.md#-demo)** — the matchup
simulator, team radar, player comparison, Elo leaderboard, and live results feed.
Source images live in [`../screenshots/`](../screenshots/).

---

## Quickstart

```bash
npm install
cp .env.local.example .env.local      # optional; defaults to http://localhost:8000
npm run dev                            # http://localhost:3000
```

Make sure the [backend](../backend/README.md) is running on `:8000` (seeded + trained),
or the page shows a friendly "Can't reach the API" panel with the exact command to start it.

| Script          | Does                                  |
| --------------- | ------------------------------------- |
| `npm run dev`   | dev server with HMR                   |
| `npm run build` | production build (also type-checks)   |
| `npm run start` | serve the production build            |
| `npm run lint`  | Next.js lint                          |

### Environment

| Variable              | Purpose                | Default                 |
| --------------------- | ---------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | Base URL of the API    | `http://localhost:8000` |

---

## Structure

```
frontend/
├── app/
│   ├── layout.tsx        # fonts, aurora bg, smooth scroll, toaster
│   ├── page.tsx          # data fetch + section composition
│   └── globals.css       # Tailwind + glass/aurora/grid utilities
├── components/
│   ├── three/            # HeroScene (R3F), SceneCanvas (ssr:false wrapper)
│   ├── predict/          # PredictPanel, ProbabilityGauge, ShapExplanation
│   ├── players/          # PlayerCompare, PlayerSelect, PlayerAvatar
│   ├── charts/           # TeamRadar, ModelPerformance (Recharts)
│   ├── Header · Leaderboard · RecentMatches
│   └── ui/               # SectionCard, TeamSelect, TeamLogo, SegmentedControl,
│                         #   Toggle, AnimatedNumber, AuroraBackground, InfoTip,
│                         #   SmoothScroll
└── lib/
    ├── api.ts            # typed fetch client + ApiError
    ├── types.ts          # mirrors the backend Pydantic models
    ├── utils.ts          # cn(), feature labels, flags, formatting
    └── confetti.ts       # celebratory burst on a strong favorite
```

---

## How it talks to the API

`app/page.tsx` is a client component that fetches everything in parallel on mount —
`/health`, `/teams`, `/matches`, `/metrics`, `/players` — with graceful fallbacks
(`/metrics` and `/players` 404 cleanly before the first train/seed). Each section then
calls what it needs:

- **PredictPanel** → `POST /predict` (+ `/teams/{name}/stats` for the radar). Fires
  confetti + a toast on a strong favorite.
- **PlayerCompare** → `/teams/{name}/stats` for real team context per player.

Everything is typed against `lib/types.ts`, which mirrors the backend response models.

---

## Tech & conventions

- **Next.js 14 App Router** + **TypeScript** (strict).
- **Tailwind CSS** with a small custom theme (team-A cyan, team-B fuchsia, accent violet)
  and `glass` / `aurora` / `bg-grid` utilities in `globals.css`.
- **Framer Motion** for entrance, layout, and value animations.
- **React Three Fiber + drei + three** for the hero — loaded via
  `dynamic(() => import(...), { ssr: false })`, so three.js is a **lazy chunk**, not in
  the main bundle.
- **Recharts** for the radar + reliability diagram.
- **sonner** (toasts) · **lenis** (smooth scroll) · **canvas-confetti** ·
  **@radix-ui/react-tooltip** · **lucide-react** (icons).
- **Images** use a plain `<img>` with graceful fallbacks (initials for logos/avatars),
  so no `next/image` remote-domain config is required.
- **Accessibility:** honors `prefers-reduced-motion` — Lenis, confetti, and CSS
  animations all back off.

---

## Notes

- Real team **logos** and player **photos** come straight from the PandaScore CDN; if an
  image is missing or fails to load, components fall back to initials tiles.
- **Per-player stats** (Rating 2.0 / ADR / KAST) aren't available on PandaScore's free
  tier, so the player comparison transparently uses **real team context** (Elo / form /
  win-rate) and says so in the UI.
