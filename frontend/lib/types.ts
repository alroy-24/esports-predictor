// Mirrors the Pydantic response models in backend/api.py.

export interface Team {
  id: number;
  name: string;
  region: string | null;
  elo: number;
  logo_url?: string | null;
  acronym?: string | null;
}

export interface Match {
  id: number;
  played_at: string;
  team_a: string;
  team_b: string;
  score_a: number;
  score_b: number;
  winner: "a" | "b";
  event_name: string | null;
  event_tier: string | null;
  best_of: number;
}

export interface Player {
  id: number;
  nickname: string;
  name: string | null;
  team: string;
  role: string | null;
  nationality: string | null;
  photo_url: string | null;
  age: number | null;
  rating: number | null;
  kd: number | null;
  adr: number | null;
  kast: number | null;
  hs_pct: number | null;
  maps_played: number | null;
}

export interface ShapItem {
  feature: string;
  value: number;
  shap: number;
}

export interface Prediction {
  team_a: string;
  team_b: string;
  prob_a: number;
  prob_b: number;
  favorite: string;
  elo_a: number;
  elo_b: number;
  explanation: ShapItem[];
}

export interface Health {
  status: string;
  model_loaded: boolean;
  history_loaded: boolean;
}

export interface TeamStats {
  name: string;
  region: string | null;
  elo: number;
  form: number;
  winrate_30d: number;
  winrate_90d: number;
  rest_days: number;
  matches_played: number;
}

export interface MetricSet {
  accuracy: number;
  log_loss: number;
  brier: number;
  auc: number;
  n: number;
}

export interface Metrics {
  model: MetricSet;
  baseline: MetricSet;
  reliability: { pred: number; obs: number }[];
  n_train: number;
  n_test: number;
  n_matches: number;
  n_features: number;
  trained_at: string;
}

export interface PredictRequest {
  team_a: string;
  team_b: string;
  event_tier?: string;
  is_lan: boolean;
  is_major: boolean;
  best_of: number;
}
