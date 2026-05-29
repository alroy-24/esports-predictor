"""FastAPI service for the CS2 predictor.

On startup we (1) load the calibrated model from ``MODEL_PATH`` and (2) replay
the full match history into a :class:`FeatureBuilder` so live predictions see
each team's *current* Elo, form, rest days and head-to-head. Both live in app
state; if the model file is missing the prediction endpoints return 503 with a
hint to run ``train.py`` rather than crashing the whole service.

Run::

    uvicorn api:app --reload --port 8000
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone


def _utcnow() -> datetime:
    """Naive UTC `now`, matching the (tz-naive) timestamps stored in the DB."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import Match, Team, init_db
from features import FeatureBuilder, fit_builder
from predictor import Predictor

MODEL_PATH = os.getenv("MODEL_PATH", "./models/xgb_calibrated.joblib")


class AppState:
    engine = None
    predictor: Predictor | None = None
    builder: FeatureBuilder | None = None
    teams_by_name: dict[str, Team] = {}


state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    state.engine = init_db()
    with Session(state.engine) as session:
        state.teams_by_name = {
            t.name.lower(): t for t in session.execute(select(Team)).scalars()
        }
        if session.query(Match).count() > 0:
            state.builder = fit_builder(session)
    if os.path.exists(MODEL_PATH):
        state.predictor = Predictor.load(MODEL_PATH)
        print(f"[api] loaded model from {MODEL_PATH}")
    else:
        print(f"[api] WARNING: no model at {MODEL_PATH}; /predict will 503")
    yield


app = FastAPI(title="CS2 Match Predictor", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #


class PredictRequest(BaseModel):
    team_a: str
    team_b: str
    event_tier: str | None = Field(default="A")
    is_lan: bool = False
    is_major: bool = False
    best_of: int = 3


class ShapItem(BaseModel):
    feature: str
    value: float
    shap: float


class PredictResponse(BaseModel):
    team_a: str
    team_b: str
    prob_a: float
    prob_b: float
    favorite: str
    elo_a: float
    elo_b: float
    explanation: list[ShapItem]


class TeamOut(BaseModel):
    id: int
    name: str
    region: str | None
    elo: float


class MatchOut(BaseModel):
    id: int
    played_at: datetime
    team_a: str
    team_b: str
    score_a: int
    score_b: int
    winner: str
    event_name: str | None
    event_tier: str | None
    best_of: int


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model_loaded": state.predictor is not None,
        "history_loaded": state.builder is not None,
    }


@app.get("/teams", response_model=list[TeamOut])
def list_teams() -> list[TeamOut]:
    with Session(state.engine) as session:
        teams = session.execute(select(Team).order_by(Team.elo.desc())).scalars()
        return [
            TeamOut(id=t.id, name=t.name, region=t.region, elo=t.elo) for t in teams
        ]


@app.get("/matches", response_model=list[MatchOut])
def list_matches(limit: int = 50) -> list[MatchOut]:
    limit = max(1, min(limit, 500))
    with Session(state.engine) as session:
        names = {t.id: t.name for t in session.execute(select(Team)).scalars()}
        rows = session.execute(
            select(Match).order_by(Match.played_at.desc()).limit(limit)
        ).scalars()
        return [
            MatchOut(
                id=m.id,
                played_at=m.played_at,
                team_a=names.get(m.team_a_id, "?"),
                team_b=names.get(m.team_b_id, "?"),
                score_a=m.score_a,
                score_b=m.score_b,
                winner=m.winner,
                event_name=m.event_name,
                event_tier=m.event_tier,
                best_of=m.best_of,
            )
            for m in rows
        ]


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    if state.predictor is None:
        raise HTTPException(503, "Model not trained yet. Run train.py first.")
    if state.builder is None:
        raise HTTPException(503, "No match history loaded. Seed and train first.")

    ta = state.teams_by_name.get(req.team_a.lower())
    tb = state.teams_by_name.get(req.team_b.lower())
    if ta is None or tb is None:
        missing = req.team_a if ta is None else req.team_b
        raise HTTPException(404, f"Unknown team: {missing!r}")

    features = state.builder.feature_row(
        ta.id,
        tb.id,
        _utcnow(),
        event_tier=req.event_tier,
        is_lan=req.is_lan,
        is_major=req.is_major,
        best_of=req.best_of,
    )
    prob_a = state.predictor.predict_one(features)
    explanation = state.predictor.explain_one(features)

    return PredictResponse(
        team_a=ta.name,
        team_b=tb.name,
        prob_a=round(prob_a, 4),
        prob_b=round(1.0 - prob_a, 4),
        favorite=ta.name if prob_a >= 0.5 else tb.name,
        elo_a=round(state.builder.state[ta.id].elo, 1),
        elo_b=round(state.builder.state[tb.id].elo, 1),
        explanation=[ShapItem(**item) for item in explanation],
    )
