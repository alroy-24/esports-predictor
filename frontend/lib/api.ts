import type {
  Health,
  Match,
  Metrics,
  Player,
  PredictRequest,
  Prediction,
  Team,
  TeamStats,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Thrown for any non-2xx response so callers can surface a friendly message. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, `Can't reach the API at ${BASE}. Is uvicorn running?`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      /* ignore non-JSON bodies */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<Health>("/health"),
  teams: () => request<Team[]>("/teams"),
  matches: (limit = 50) => request<Match[]>(`/matches?limit=${limit}`),
  predict: (body: PredictRequest) =>
    request<Prediction>("/predict", { method: "POST", body: JSON.stringify(body) }),
  teamStats: (name: string) =>
    request<TeamStats>(`/teams/${encodeURIComponent(name)}/stats`),
  metrics: () => request<Metrics>("/metrics"),
  players: () => request<Player[]>("/players"),
  teamPlayers: (name: string) =>
    request<Player[]>(`/teams/${encodeURIComponent(name)}/players`),
};

export { BASE as API_BASE };
