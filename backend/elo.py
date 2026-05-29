"""Elo rating system for CS2 teams.

Standard Elo with a configurable K-factor. Higher-tier events (LAN majors)
should move ratings more, so we expose K per-event.

This file is intentionally tiny and pure — no DB, no I/O — so it's easy to
unit test and call from both the training pipeline and the API.
"""

from __future__ import annotations

from dataclasses import dataclass

DEFAULT_RATING = 1500.0


@dataclass(frozen=True)
class EloConfig:
    k_online: float = 24.0
    k_lan: float = 32.0
    k_major: float = 48.0

    def k_for(self, *, is_lan: bool, is_major: bool) -> float:
        if is_major:
            return self.k_major
        if is_lan:
            return self.k_lan
        return self.k_online


def expected_score(rating_a: float, rating_b: float) -> float:
    """Probability team A beats team B given Elo ratings."""
    return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400.0))


def update(
    rating_a: float,
    rating_b: float,
    score_a: float,
    k: float = 32.0,
) -> tuple[float, float]:
    """Return (new_a, new_b) after a match with `score_a` in {0, 0.5, 1}."""
    expected_a = expected_score(rating_a, rating_b)
    new_a = rating_a + k * (score_a - expected_a)
    new_b = rating_b + k * ((1.0 - score_a) - (1.0 - expected_a))
    return new_a, new_b


def replay_history(matches, config: EloConfig | None = None) -> dict[str, float]:
    """Replay a chronological iterable of matches and return final ratings.

    Each match must expose: team_a, team_b, winner ('a' | 'b'), is_lan, is_major.
    """
    cfg = config or EloConfig()
    ratings: dict[str, float] = {}

    for m in matches:
        a, b = m.team_a, m.team_b
        ra = ratings.get(a, DEFAULT_RATING)
        rb = ratings.get(b, DEFAULT_RATING)
        k = cfg.k_for(is_lan=m.is_lan, is_major=m.is_major)
        score_a = 1.0 if m.winner == "a" else 0.0
        ratings[a], ratings[b] = update(ra, rb, score_a, k=k)

    return ratings
