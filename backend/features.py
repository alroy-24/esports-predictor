"""Feature engineering for the CS2 predictor.

The cardinal rule here is **no leakage**: every feature for a match must be
computable from information available *strictly before that match started*. We
guarantee this by replaying matches in chronological order and maintaining
rolling state (Elo, recent form, head-to-head, rest days). For each match we
first snapshot the current state into a feature row, *then* fold the match
result into the state.

The same :class:`FeatureBuilder` is reused at inference time: we replay the full
history once, then ask for a feature row for a hypothetical matchup using the
latest state.
"""

from __future__ import annotations

import math
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import Match, Team
from elo import DEFAULT_RATING, EloConfig, expected_score, update as elo_update

# Windows (in days) for rolling win-rate features.
WINRATE_WINDOWS = (10, 30, 90)
# Half-life (days) for the recency-weighted form score.
FORM_HALFLIFE_DAYS = 30.0

# The exact columns the model consumes, in order. Keeping this explicit means
# training and inference can never silently disagree on column layout.
FEATURE_COLUMNS = [
    "elo_diff",
    "elo_expected_a",
    "winrate_10d_diff",
    "winrate_30d_diff",
    "winrate_90d_diff",
    "form_diff",
    "map_margin_form_diff",
    "h2h_diff",
    "rest_days_a",
    "rest_days_b",
    "matches_played_a",
    "matches_played_b",
    "tier_ordinal",
    "is_lan",
    "is_major",
    "best_of",
]

_TIER_ORDINAL = {"S": 3, "A": 2, "B": 1, None: 1}


@dataclass
class _TeamState:
    elo: float = DEFAULT_RATING
    last_played: datetime | None = None
    n_matches: int = 0
    # (played_at, won, map_margin) capped to the longest window we care about.
    # map_margin is this team's map score minus the opponent's (e.g. a 2-1
    # bo3 win is +1, a 0-2 loss is -2) — a "quality of result" signal.
    history: deque = field(default_factory=lambda: deque(maxlen=400))


class FeatureBuilder:
    """Replays match history to produce leakage-free feature rows."""

    def __init__(self, config: EloConfig | None = None) -> None:
        self.cfg = config or EloConfig()
        self.state: dict[int, _TeamState] = defaultdict(_TeamState)
        # directional head-to-head wins: h2h[(winner_id, loser_id)] -> count
        self.h2h: dict[tuple[int, int], int] = defaultdict(int)

    # -- rolling helpers ---------------------------------------------------- #

    def _winrate(self, st: _TeamState, asof: datetime, window_days: int) -> float:
        wins = total = 0
        for played_at, won, _margin in st.history:
            age = (asof - played_at).total_seconds() / 86400.0
            if 0 <= age <= window_days:
                total += 1
                wins += 1 if won else 0
        return wins / total if total else 0.5  # neutral prior when no history

    def _form(self, st: _TeamState, asof: datetime) -> float:
        """Recency-weighted win share; exponential decay by half-life."""
        num = den = 0.0
        for played_at, won, _margin in st.history:
            age = (asof - played_at).total_seconds() / 86400.0
            if age < 0:
                continue
            w = 0.5 ** (age / FORM_HALFLIFE_DAYS)
            num += w * (1.0 if won else 0.0)
            den += w
        return num / den if den else 0.5

    def _map_margin_form(self, st: _TeamState, asof: datetime) -> float:
        """Recency-weighted average map-score margin (quality of recent results)."""
        num = den = 0.0
        for played_at, _won, margin in st.history:
            age = (asof - played_at).total_seconds() / 86400.0
            if age < 0:
                continue
            w = 0.5 ** (age / FORM_HALFLIFE_DAYS)
            num += w * margin
            den += w
        return num / den if den else 0.0

    def _rest_days(self, st: _TeamState, asof: datetime) -> float:
        if st.last_played is None:
            return 30.0  # treat a debut as well-rested
        return (asof - st.last_played).total_seconds() / 86400.0

    # -- public API --------------------------------------------------------- #

    def feature_row(
        self,
        team_a_id: int,
        team_b_id: int,
        played_at: datetime,
        *,
        event_tier: str | None = None,
        is_lan: bool = False,
        is_major: bool = False,
        best_of: int = 3,
    ) -> dict[str, float]:
        """Snapshot current state into a feature dict for an A-vs-B matchup."""
        sa, sb = self.state[team_a_id], self.state[team_b_id]

        row: dict[str, float] = {
            "elo_diff": sa.elo - sb.elo,
            "elo_expected_a": expected_score(sa.elo, sb.elo),
            "form_diff": self._form(sa, played_at) - self._form(sb, played_at),
            "map_margin_form_diff": self._map_margin_form(sa, played_at)
            - self._map_margin_form(sb, played_at),
            "h2h_diff": float(
                self.h2h[(team_a_id, team_b_id)] - self.h2h[(team_b_id, team_a_id)]
            ),
            "rest_days_a": self._rest_days(sa, played_at),
            "rest_days_b": self._rest_days(sb, played_at),
            "matches_played_a": float(sa.n_matches),
            "matches_played_b": float(sb.n_matches),
            "tier_ordinal": float(_TIER_ORDINAL.get(event_tier, 1)),
            "is_lan": float(is_lan),
            "is_major": float(is_major),
            "best_of": float(best_of),
        }
        for w in WINRATE_WINDOWS:
            row[f"winrate_{w}d_diff"] = self._winrate(sa, played_at, w) - self._winrate(
                sb, played_at, w
            )
        return row

    def team_profile(self, team_id: int, asof: datetime) -> dict[str, float]:
        """Current rolling snapshot for one team (powers the compare radar)."""
        st = self.state[team_id]
        return {
            "elo": round(st.elo, 1),
            "form": round(self._form(st, asof), 4),
            "winrate_30d": round(self._winrate(st, asof, 30), 4),
            "winrate_90d": round(self._winrate(st, asof, 90), 4),
            "rest_days": round(self._rest_days(st, asof), 2),
            "matches_played": float(st.n_matches),
        }

    def observe(
        self,
        team_a_id: int,
        team_b_id: int,
        winner: str,
        played_at: datetime,
        *,
        is_lan: bool = False,
        is_major: bool = False,
        score_a: int | None = None,
        score_b: int | None = None,
    ) -> None:
        """Fold a finished match into the rolling state."""
        sa, sb = self.state[team_a_id], self.state[team_b_id]
        a_won = winner == "a"

        k = self.cfg.k_for(is_lan=is_lan, is_major=is_major)
        sa.elo, sb.elo = elo_update(sa.elo, sb.elo, 1.0 if a_won else 0.0, k=k)

        # Map margin from A's perspective; fall back to +/-1 if scores unknown.
        if score_a is not None and score_b is not None:
            margin_a = float(score_a - score_b)
        else:
            margin_a = 1.0 if a_won else -1.0

        sa.history.append((played_at, a_won, margin_a))
        sb.history.append((played_at, not a_won, -margin_a))
        sa.last_played = sb.last_played = played_at
        sa.n_matches += 1
        sb.n_matches += 1
        winner_id, loser_id = (
            (team_a_id, team_b_id) if a_won else (team_b_id, team_a_id)
        )
        self.h2h[(winner_id, loser_id)] += 1


def _ordered_matches(session: Session) -> list[Match]:
    return list(
        session.execute(select(Match).order_by(Match.played_at.asc())).scalars()
    )


def build_feature_table(session: Session) -> pd.DataFrame:
    """Return a DataFrame of leakage-free features + target for all matches.

    Columns: FEATURE_COLUMNS + ['target', 'played_at', 'match_id',
    'team_a_id', 'team_b_id']. ``target`` is 1 when team A won.
    """
    builder = FeatureBuilder()
    rows: list[dict] = []

    for m in _ordered_matches(session):
        row = builder.feature_row(
            m.team_a_id,
            m.team_b_id,
            m.played_at,
            event_tier=m.event_tier,
            is_lan=m.is_lan,
            is_major=m.is_major,
            best_of=m.best_of,
        )
        row["target"] = 1 if m.winner == "a" else 0
        row["played_at"] = m.played_at
        row["match_id"] = m.id
        row["team_a_id"] = m.team_a_id
        row["team_b_id"] = m.team_b_id
        rows.append(row)

        builder.observe(
            m.team_a_id,
            m.team_b_id,
            m.winner,
            m.played_at,
            is_lan=m.is_lan,
            is_major=m.is_major,
            score_a=m.score_a,
            score_b=m.score_b,
        )

    df = pd.DataFrame(rows)
    if not df.empty:
        df = df[FEATURE_COLUMNS + ["target", "played_at", "match_id", "team_a_id", "team_b_id"]]
    return df


def fit_builder(session: Session) -> FeatureBuilder:
    """Replay the whole history and return the builder with up-to-date state.

    Used at inference time so a live prediction sees each team's current Elo,
    form, rest, and head-to-head.
    """
    builder = FeatureBuilder()
    for m in _ordered_matches(session):
        builder.observe(
            m.team_a_id, m.team_b_id, m.winner, m.played_at,
            is_lan=m.is_lan, is_major=m.is_major,
            score_a=m.score_a, score_b=m.score_b,
        )
    return builder
