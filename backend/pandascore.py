"""Thin PandaScore API client for real CS2 data.

PandaScore (https://pandascore.co) exposes real Counter-Strike teams, players
(with official photos), and match results under the ``/csgo`` video-game slug.
Auth is a bearer token; the free developer tier is rate-limited, so this client
adds a polite inter-request delay and exponential backoff on 429/5xx.

Get a token at https://pandascore.co (free account) and put it in ``backend/.env``::

    PANDASCORE_TOKEN=your_token_here
"""

from __future__ import annotations

import os
import time
from typing import Any, Iterator

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)


class PandaScoreError(RuntimeError):
    pass


class _Retryable(Exception):
    """Internal marker so tenacity retries 429/5xx but not 4xx auth errors."""


class PandaScoreClient:
    def __init__(
        self,
        token: str | None = None,
        base_url: str | None = None,
        delay: float = 0.35,
    ) -> None:
        token = token or os.getenv("PANDASCORE_TOKEN")
        if not token:
            raise PandaScoreError(
                "No PandaScore token. Set PANDASCORE_TOKEN in backend/.env "
                "(free account at https://pandascore.co)."
            )
        self.base = (base_url or os.getenv("PANDASCORE_BASE_URL", "https://api.pandascore.co")).rstrip("/")
        self.delay = delay
        self._client = httpx.Client(
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            },
            timeout=30.0,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "PandaScoreClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    @retry(
        retry=retry_if_exception_type(_Retryable),
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=2, min=2, max=60),
        reraise=True,
    )
    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        resp = self._client.get(f"{self.base}{path}", params=params or {})
        if resp.status_code == 429 or resp.status_code >= 500:
            raise _Retryable(f"{resp.status_code} on {path}")
        if resp.status_code == 401:
            raise PandaScoreError("PandaScore rejected the token (401). Check PANDASCORE_TOKEN.")
        if resp.status_code >= 400:
            raise PandaScoreError(f"{resp.status_code} on {path}: {resp.text[:200]}")
        return resp.json()

    def paginate(
        self, path: str, params: dict[str, Any] | None = None, max_pages: int = 5, per_page: int = 100
    ) -> Iterator[dict]:
        """Yield items across pages until exhausted or ``max_pages`` reached."""
        params = dict(params or {})
        for page in range(1, max_pages + 1):
            batch = self._get(path, {**params, "page": page, "per_page": per_page})
            if not batch:
                break
            yield from batch
            if len(batch) < per_page:
                break
            time.sleep(self.delay)

    # -- domain helpers ----------------------------------------------------- #

    def past_matches(self, max_pages: int = 3) -> list[dict]:
        """Most recent finished CS2 matches (any tier), newest first."""
        return list(
            self.paginate(
                "/csgo/matches/past",
                {"filter[status]": "finished", "sort": "-end_at"},
                max_pages=max_pages,
            )
        )

    def tournaments_by_tier(self, tiers: str = "s,a", max_pages: int = 4) -> list[dict]:
        """Recent tournaments at the given tier(s), e.g. 's,a' for top events."""
        return list(
            self.paginate(
                "/csgo/tournaments",
                {"filter[tier]": tiers, "sort": "-end_at"},
                max_pages=max_pages,
            )
        )

    def matches_for_tournaments(
        self, tournament_ids: list[int], chunk: int = 25, max_matches: int = 2000
    ) -> list[dict]:
        """Finished matches across the given tournaments (id-filtered, chunked)."""
        out: list[dict] = []
        unique = list(dict.fromkeys(tournament_ids))
        for i in range(0, len(unique), chunk):
            group = unique[i : i + chunk]
            batch = self._get(
                "/csgo/matches",
                {
                    "filter[tournament_id]": ",".join(str(x) for x in group),
                    "filter[status]": "finished",
                    "sort": "-begin_at",
                    "per_page": 100,
                },
            )
            out.extend(batch)
            time.sleep(self.delay)
            if len(out) >= max_matches:
                break
        return out[:max_matches]

    def team(self, team_id: int) -> dict:
        """Full team record including its current roster (with photos)."""
        return self._get(f"/teams/{team_id}")

    def teams_by_ids(self, ids: list[int], chunk: int = 50) -> list[dict]:
        """Batch-fetch teams (with rosters + photos) using the id filter, which
        is far cheaper than one request per team."""
        out: list[dict] = []
        unique = list(dict.fromkeys(ids))
        for i in range(0, len(unique), chunk):
            group = unique[i : i + chunk]
            batch = self._get(
                "/csgo/teams",
                {"filter[id]": ",".join(str(x) for x in group), "per_page": chunk},
            )
            out.extend(batch)
            time.sleep(self.delay)
        return out

    def player_stats(self, player_id: int) -> dict:
        """Aggregate player stats (availability depends on plan)."""
        return self._get(f"/csgo/players/{player_id}/stats")
