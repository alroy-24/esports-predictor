"""Data ingestion for the CS2 predictor.

Two ways to fill the database:

1. ``seed``  — generate a realistic *synthetic* match history. Teams get a
   latent skill; match outcomes are sampled from a logistic of the skill gap
   plus match-context noise. This lets the entire pipeline (features → train →
   backtest → API) run end-to-end with zero network access, which is what makes
   the project reproducible for anyone cloning it.

2. ``scrape`` — pull real results from HLTV.org. HLTV sits behind Cloudflare and
   rate-limits aggressively, so this is written to be *respectful*: a custom
   user-agent, a configurable delay between requests, and retry-with-backoff.
   It may require a residential IP / browser session to get past the bot wall;
   the synthetic seeder is the fallback that always works.

Usage::

    python ingest.py seed --teams 40 --days 365 --matches 4000
    python ingest.py scrape --pages 20
"""

from __future__ import annotations

import argparse
import os
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


def _utcnow() -> datetime:
    """Naive UTC `now`, matching the (tz-naive) timestamps stored in the DB."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

from sqlalchemy import select
from sqlalchemy.orm import Session

from db import Match, Team, init_db, make_engine

# --------------------------------------------------------------------------- #
# Synthetic generation
# --------------------------------------------------------------------------- #

REGIONS = ["EU", "NA", "SA", "CIS", "APAC", "OCE"]

# A pool of plausible-sounding org names so the dashboard isn't full of "Team 7".
TEAM_NAMES = [
    "Astralis", "NaVi", "FaZe", "Vitality", "G2", "Spirit", "MOUZ", "Heroic",
    "Liquid", "Cloud9", "NIP", "Complexity", "FURIA", "ENCE", "BIG", "Falcons",
    "Eternal Fire", "Apeks", "GamerLegion", "9z", "paiN", "MIBR", "Imperial",
    "Virtus.pro", "Outsiders", "fnatic", "OG", "Monte", "TheMongolz", "Lynn Vision",
    "Rare Atom", "FlyQuest", "Wildcard", "M80", "Nemiga", "Sangal", "AMKAL",
    "SAW", "BetBoom", "Aurora", "Passion UA", "Fluxo", "Legacy", "Sharks",
    "Metizport", "ECSTATIC", "Permitta", "Zero Tenacity", "Sashi", "Iberian Soul",
]

TIERS = ["S", "A", "B"]
TIER_WEIGHTS = [0.15, 0.35, 0.50]  # most matches are lower tier


@dataclass
class SyntheticConfig:
    n_teams: int = 40
    n_matches: int = 4000
    days: int = 365
    seed: int = 42
    # How strongly the latent skill gap drives the result. Higher = more
    # predictable matches. ~0.9 gives a realistic ~67% best-case accuracy.
    skill_scale: float = 0.9


def _sample_best_of(tier: str, is_major: bool, rng: random.Random) -> int:
    if is_major or tier == "S":
        return rng.choices([1, 3, 5], weights=[0.15, 0.7, 0.15])[0]
    return rng.choices([1, 3], weights=[0.55, 0.45])[0]


def _sample_score(best_of: int, a_wins: bool, rng: random.Random) -> tuple[int, int]:
    """Map a winner + bo-format to a plausible map score."""
    need = best_of // 2 + 1
    loser_maps = rng.randint(0, need - 1)
    return (need, loser_maps) if a_wins else (loser_maps, need)


def generate(cfg: SyntheticConfig, session: Session) -> int:
    """Populate the DB with synthetic teams + matches. Returns matches written."""
    rng = random.Random(cfg.seed)

    names = TEAM_NAMES[: cfg.n_teams]
    if len(names) < cfg.n_teams:  # pad if someone asks for >50 teams
        names += [f"Team {i}" for i in range(len(names), cfg.n_teams)]

    # Latent skill on the Elo-ish logit scale. Persisted nowhere — it only
    # drives outcome sampling, exactly like true team strength would.
    skills: dict[str, float] = {}
    teams: dict[str, Team] = {}
    for name in names:
        skill = rng.gauss(0.0, 1.0)
        skills[name] = skill
        team = Team(name=name, region=rng.choice(REGIONS), elo=1500.0)
        teams[name] = team
        session.add(team)
    session.flush()  # assign team ids

    start = _utcnow() - timedelta(days=cfg.days)
    seconds_span = cfg.days * 24 * 3600

    written = 0
    for i in range(cfg.n_matches):
        a_name, b_name = rng.sample(names, 2)
        ta, tb = teams[a_name], teams[b_name]

        played_at = start + timedelta(seconds=rng.randint(0, seconds_span))
        tier = rng.choices(TIERS, weights=TIER_WEIGHTS)[0]
        is_major = tier == "S" and rng.random() < 0.12
        is_lan = is_major or (tier == "S" and rng.random() < 0.5) or rng.random() < 0.15
        best_of = _sample_best_of(tier, is_major, rng)

        # Probability A wins, from the skill gap plus a little context noise.
        gap = cfg.skill_scale * (skills[a_name] - skills[b_name])
        gap += rng.gauss(0.0, 0.35)  # upsets happen
        p_a = 1.0 / (1.0 + 10 ** (-gap))
        a_wins = rng.random() < p_a

        score_a, score_b = _sample_score(best_of, a_wins, rng)
        match = Match(
            hltv_id=None,
            played_at=played_at,
            team_a_id=ta.id,
            team_b_id=tb.id,
            score_a=score_a,
            score_b=score_b,
            winner="a" if a_wins else "b",
            event_name=f"Synthetic {tier}-Tier Event",
            event_tier=tier,
            is_lan=is_lan,
            is_major=is_major,
            best_of=best_of,
        )
        session.add(match)
        written += 1

    session.commit()
    return written


# --------------------------------------------------------------------------- #
# Real HLTV scraping (best-effort, rate-limited)
# --------------------------------------------------------------------------- #


def scrape(pages: int, session: Session) -> int:
    """Scrape recent results from HLTV. Best-effort: returns rows written.

    Imports are local so the synthetic path has no hard dependency on the
    scraping stack being installed/working.
    """
    import httpx
    from bs4 import BeautifulSoup
    from tenacity import retry, stop_after_attempt, wait_exponential

    base = os.getenv("HLTV_BASE_URL", "https://www.hltv.org")
    ua = os.getenv("SCRAPER_USER_AGENT", "cs2-predictor-research/0.1")
    delay = float(os.getenv("SCRAPER_DELAY_SECONDS", "2.0"))

    headers = {"User-Agent": ua, "Accept-Language": "en-US,en;q=0.9"}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=30))
    def _get(client: httpx.Client, url: str) -> str:
        resp = client.get(url, timeout=30.0)
        resp.raise_for_status()
        return resp.text

    def _existing_ids() -> set[int]:
        rows = session.execute(select(Match.hltv_id).where(Match.hltv_id.is_not(None)))
        return {r[0] for r in rows}

    import time

    seen = _existing_ids()
    teams = {t.name: t for t in session.execute(select(Team)).scalars()}

    def _team(name: str) -> Team:
        t = teams.get(name)
        if t is None:
            t = Team(name=name, elo=1500.0)
            session.add(t)
            session.flush()
            teams[name] = t
        return t

    written = 0
    with httpx.Client(headers=headers, follow_redirects=True) as client:
        for page in range(pages):
            offset = page * 100
            url = f"{base}/results?offset={offset}"
            try:
                html = _get(client, url)
            except Exception as exc:  # noqa: BLE001 — log and stop politely
                print(f"[scrape] stopping at page {page}: {exc}")
                break

            soup = BeautifulSoup(html, "lxml")
            results = soup.select(".result-con")
            if not results:
                print(f"[scrape] no results on page {page} (likely bot-walled); stopping")
                break

            for con in results:
                hltv_id = _parse_match_id(con)
                if hltv_id is None or hltv_id in seen:
                    continue
                parsed = _parse_result_con(con)
                if parsed is None:
                    continue
                a_name, b_name, score_a, score_b = parsed
                ta, tb = _team(a_name), _team(b_name)
                session.add(
                    Match(
                        hltv_id=hltv_id,
                        played_at=_utcnow(),  # results page lacks exact time
                        team_a_id=ta.id,
                        team_b_id=tb.id,
                        score_a=score_a,
                        score_b=score_b,
                        winner="a" if score_a > score_b else "b",
                        best_of=3,
                    )
                )
                seen.add(hltv_id)
                written += 1

            session.commit()
            print(f"[scrape] page {page}: total written so far {written}")
            time.sleep(delay)

    return written


def _parse_match_id(con) -> int | None:
    link = con.find("a", href=True)
    if not link:
        return None
    parts = [p for p in link["href"].split("/") if p]
    for p in parts:
        if p.isdigit():
            return int(p)
    return None


def _parse_result_con(con):
    teams = con.select(".team")
    scores = con.select(".result-score .score-won, .result-score .score-lost")
    if len(teams) < 2 or len(scores) < 2:
        # fall back to a single combined score cell like "16 : 12"
        cell = con.select_one(".result-score")
        if len(teams) < 2 or cell is None:
            return None
        try:
            sa, sb = (int(x) for x in cell.get_text().replace(" ", "").split(":"))
        except ValueError:
            return None
        return teams[0].get_text(strip=True), teams[1].get_text(strip=True), sa, sb
    try:
        sa, sb = int(scores[0].get_text(strip=True)), int(scores[1].get_text(strip=True))
    except ValueError:
        return None
    return teams[0].get_text(strip=True), teams[1].get_text(strip=True), sa, sb


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest CS2 match data.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_seed = sub.add_parser("seed", help="generate synthetic match history")
    p_seed.add_argument("--teams", type=int, default=40)
    p_seed.add_argument("--matches", type=int, default=4000)
    p_seed.add_argument("--days", type=int, default=365)
    p_seed.add_argument("--seed", type=int, default=42)
    p_seed.add_argument("--reset", action="store_true", help="drop existing rows first")

    p_scrape = sub.add_parser("scrape", help="scrape real HLTV results")
    p_scrape.add_argument("--pages", type=int, default=10)

    args = parser.parse_args()

    engine = init_db()
    with Session(engine) as session:
        if args.cmd == "seed":
            if args.reset:
                session.query(Match).delete()
                session.query(Team).delete()
                session.commit()
            cfg = SyntheticConfig(
                n_teams=args.teams,
                n_matches=args.matches,
                days=args.days,
                seed=args.seed,
            )
            n = generate(cfg, session)
            print(f"[seed] wrote {n} matches across {args.teams} teams.")
        elif args.cmd == "scrape":
            n = scrape(args.pages, session)
            print(f"[scrape] wrote {n} new matches.")


if __name__ == "__main__":
    main()
