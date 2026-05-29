# ⚙️ Backend — Frag Forecast

FastAPI service + ML pipeline that turns raw CS2 match data into **calibrated**
win probabilities with **SHAP** explanations. Pure Python, SQLite by default,
Postgres-ready.

> For the project overview, screenshots, and the headline metrics, see the
> [root README](../README.md).

---

## Layout

| File             | Responsibility                                                            |
| ---------------- | ------------------------------------------------------------------------- |
| `db.py`          | SQLAlchemy 2.0 models — `Team`, `Player`, `Match` — + engine helpers       |
| `pandascore.py`  | Real CS2 data client (bearer auth, pagination, 429/5xx backoff)            |
| `ingest.py`      | CLI: PandaScore ingest · synthetic seeder · HLTV scraper                   |
| `elo.py`         | Pure, I/O-free Elo rating system (per-event K-factors)                     |
| `features.py`    | Point-in-time, **leakage-free** feature engineering (16 features)          |
| `predictor.py`   | XGBoost + Platt calibration + SHAP, with `save()` / `load()`               |
| `train.py`       | Time-split training, metrics vs Elo baseline, reliability diagram          |
| `api.py`         | FastAPI app (lifespan loads model + replays history for live features)     |

---

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows  ·  source .venv/bin/activate elsewhere
pip install -r requirements.txt
copy ..\.env.example ..\.env      # then edit
```

### Environment (`../.env`)

| Variable               | Purpose                                       | Default                          |
| ---------------------- | --------------------------------------------- | -------------------------------- |
| `DATABASE_URL`         | SQLAlchemy URL (swap to `postgres://` in prod)| `sqlite:///./data/cs2.db`        |
| `PANDASCORE_TOKEN`     | Real-data API token (free account)            | _(unset)_                        |
| `PANDASCORE_BASE_URL`  | API base                                      | `https://api.pandascore.co`      |
| `MODEL_PATH`           | Where the trained model is saved/loaded       | `./models/xgb_calibrated.joblib` |
| `ALLOWED_ORIGINS`      | CORS origins for the dashboard                | `http://localhost:3000`          |

---

## Data ingestion (`ingest.py`)

Three sources, one CLI:

```bash
# 🟣 Real top-tier CS2 data from PandaScore (needs PANDASCORE_TOKEN)
python ingest.py pandascore --fresh --tier s,a --pages 4
#   --fresh       drop & recreate tables (recommended when switching sources)
#   --tier s,a    tournament tier(s); "all" uses the raw recent-finished feed
#   --pages N     pages of tournaments to scan (100/page)
#   --with-stats  also try per-player stats (requires a paid PandaScore tier)

# 🟢 Synthetic data — fully offline, no account
python ingest.py seed --teams 40 --matches 4000 --days 365 --reset

# 🔴 HLTV scraper (best-effort; Cloudflare-walled, rate-limited, ToS-sensitive)
python ingest.py scrape --pages 10
```

**How the real path works:** find recent S/A-tier tournaments → pull their finished
matches → resolve the teams that appear → batch-fetch each team (roster + photos come
with the team object) → upsert teams, players, and matches. Everything is idempotent
via `pandascore_id`, so re-running tops up rather than duplicates.

---

## Training (`train.py`)

```bash
python train.py                       # defaults: sigmoid calibration, full data
python train.py --min-history 10      # train/eval only where both teams have ≥10 prior games
python train.py --calibration isotonic --no-plot
```

What it does:

1. Builds the feature table by **replaying matches in chronological order**
   (state is snapshotted _before_ each match, then updated — no leakage).
2. Splits **by time**: `train 70% · calibrate 15% · test 15%` (never shuffled).
3. Fits XGBoost, then calibrates it on the held-out calibration slice.
4. Reports **accuracy / log-loss / Brier / AUC** on the test tail, **next to the
   Elo-only baseline**.
5. Writes `models/xgb_calibrated.joblib`, `models/metrics.json` (consumed by the
   `/metrics` endpoint), and `models/reliability.png`.
6. Persists each team's final Elo back to the DB for the leaderboard.

### The 16 features

```
elo_diff · elo_expected_a · winrate_{10,30,90}d_diff · form_diff ·
map_margin_form_diff · h2h_diff · rest_days_{a,b} · matches_played_{a,b} ·
tier_ordinal · is_lan · is_major · best_of
```

`map_margin_form_diff` (recency-weighted average map-score margin — _quality_ of wins,
not just win/loss) is what pulled the model to parity-on-accuracy and an AUC edge over Elo.

---

## Serving (`api.py`)

```bash
uvicorn api:app --reload --port 8000
```

On startup the lifespan handler loads the model from `MODEL_PATH` and **replays the
full match history** into a `FeatureBuilder`, so live `/predict` calls see each team's
current Elo, form, rest, and head-to-head. If no model is trained yet, prediction
endpoints return `503` with a hint rather than crashing.

| Method | Endpoint                | Notes                                            |
| ------ | ----------------------- | ------------------------------------------------ |
| `GET`  | `/health`               | status + model/history loaded flags              |
| `GET`  | `/teams`                | Elo, region, logo                                |
| `GET`  | `/teams/{name}/players` | roster: photo, role, nationality, age            |
| `GET`  | `/teams/{name}/stats`   | rolling team profile                             |
| `GET`  | `/players`              | all players + team + photo                       |
| `GET`  | `/matches?limit=N`      | recent results                                   |
| `GET`  | `/metrics`              | model vs baseline + reliability curve            |
| `POST` | `/predict`              | calibrated probs + favorite + SHAP               |

Interactive docs at **http://localhost:8000/docs**.

---

## Design notes

- **Calibration over confidence.** An uncalibrated booster can say 77% and be right 65%
  of the time — useless for a betting backtest. We Platt-scale on a held-out slice and
  ship the reliability diagram so the probabilities are auditable.
- **Elo is the baseline to beat**, not an afterthought. Every metric is reported beside it.
- **Honesty:** per-player performance stats are nullable — when a data source doesn't
  expose them, we store `null` and the UI shows "—" rather than fabricating numbers.

---

## Tests / sanity checks

`elo.py` and `features.py` are pure and import-light — ideal unit-test targets
(Elo expected-score symmetry, and the leakage guarantee that a match never sees its
own result). Quick smoke check:

```bash
python -c "import db, elo, features, predictor, ingest, pandascore, api; print('imports OK')"
```
