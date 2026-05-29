import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette: team A = cyan, team B = fuchsia, accent = violet.
        ink: {
          950: "#05060c",
          900: "#0a0c16",
          850: "#0e1120",
          800: "#13172a",
        },
        teamA: {
          DEFAULT: "#22d3ee",
          glow: "#06b6d4",
        },
        teamB: {
          DEFAULT: "#f472b6",
          glow: "#ec4899",
        },
        accent: {
          DEFAULT: "#a78bfa",
          glow: "#8b5cf6",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "glow-a": "0 0 40px -8px rgba(34,211,238,0.55)",
        "glow-b": "0 0 40px -8px rgba(244,114,182,0.55)",
        "glow-accent": "0 0 50px -10px rgba(167,139,250,0.5)",
        glass: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 24px 60px -24px rgba(0,0,0,0.8)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to right, rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.06) 1px, transparent 1px)",
      },
      keyframes: {
        aurora: {
          "0%, 100%": { transform: "translate(0,0) scale(1)", opacity: "0.55" },
          "33%": { transform: "translate(8%,-6%) scale(1.15)", opacity: "0.75" },
          "66%": { transform: "translate(-6%,8%) scale(0.95)", opacity: "0.6" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.7" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        aurora: "aurora 18s ease-in-out infinite",
        "aurora-slow": "aurora 26s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.215,0.61,0.355,1) infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
