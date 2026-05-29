# CS2 Match Outcome Predictor

A machine-learning project that predicts winners of professional Counter-Strike 2
matches, with a live Next.js dashboard for browsing predictions and a FastAPI
backend serving an XGBoost model.

## Why this project

Most "ML portfolio projects" stop at a notebook with `accuracy_score`. This one
ships the full pipeline: scraping → feature engineering → calibrated model →
API → dashboard → backtest. The result is a predictor whose probabilities you
can actually trust, plus a write-up showing whether it would have made money
against bookmaker odds.

## Stack

- **Data:** HLTV.org match history (scraped) + Kaggle CS:GO datasets for bootstrap
- **Storage:** SQLite (dev) / Postgres (prod-ready)
- **Modeling:** scikit-learn, XGBoost, LightGBM, SHAP
- **Backend:** FastAPI + Uvicorn
- **Frontend:** Next.js 14 (App Router) + TypeScript
- **Notebooks:** Jupyter for EDA and experimentation

## Repo layout

```
esports-predictor/
├── backend/
│   ├── api.py            # FastAPI app
│   ├── elo.py            # Elo rating system
│   ├── predictor.py      # XGBoost wrapper + calibration
│   ├── features.py       # Feature engineering
│   ├── ingest.py         # HLTV scraper + DB loader
│   ├── train.py          # Training pipeline
│   ├── db.py             # SQLAlchemy models / schema
│   └── notebooks/        # Jupyter EDA
├── frontend/             # Next.js dashboard
├── data/                 # SQLite DB + CSVs (gitignored)
└── README.md
```

## Roadmap

| Week | Deliverable |
|------|-------------|
| 1 | Ingest 1y of HLTV matches → SQLite, baseline Elo model (~60% acc) |
| 2 | Engineered features + XGBoost ensemble (~67% acc), calibration |
| 3 | FastAPI endpoints, Next.js dashboard, SHAP explanations |
| 4 | Backtest vs bookmaker odds, write-up, deploy |

## Quickstart

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy ..\.env.example ..\.env
uvicorn api:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

## Features used by the model

**Team-level**
- Elo rating (computed in-repo, not borrowed)
- Win rate over last 10 / 30 / 90 days
- Recency-weighted form score
- Head-to-head record
- Map-pool win rates

**Match context**
- Tournament tier (S / A / B)
- LAN vs online
- Best-of format (1 / 3 / 5)
- Days since last match
- Roster changes in the last 30 days

**Player-level (phase 2)**
- Avg HLTV rating of starting five
- Star-player KDA trend
- Matches played in last 7 days (fatigue)

## What makes this portfolio-worthy

1. **Calibration**, not just accuracy — reliability diagrams included
2. **Backtest** against bookmaker odds (simulated ROI)
3. **SHAP** feature attributions for every prediction
4. **Live dashboard** that ingests new matches and tracks drift
5. **Honest write-up** of what worked and what didn't

## Data sources

- HLTV.org match results (scraped, respectful rate limits)
- Kaggle: ["CS:GO Professional Matches"](https://www.kaggle.com/datasets) for bootstrapping
- Bookmaker odds (optional): collected manually or via odds-API for backtest

## License

MIT.
