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
from urllib.parse import quote


def _utcnow() -> datetime:
    """Naive UTC `now`, matching the (tz-naive) timestamps stored in the DB."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

from sqlalchemy import select
from sqlalchemy.orm import Session

from db import Match, Player, Team, init_db, make_engine

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

# Every roster has the same five-role shape. The AWPer and one "star" rifler
# tend to carry a higher rating.
ROLES = ["IGL", "AWPer", "Entry", "Support", "Lurker"]

# Region -> plausible ISO-2 nationalities, so a team's roster looks coherent.
REGION_NATIONS = {
    "EU": ["FR", "DK", "SE", "DE", "PL", "FI", "NO", "BA", "SK", "ES"],
    "NA": ["US", "CA"],
    "SA": ["BR", "AR", "CL", "UY"],
    "CIS": ["RU", "UA", "KZ", "BY"],
    "APAC": ["CN", "KR", "MN", "ID", "TH"],
    "OCE": ["AU", "NZ"],
}

# Syllable bank for generating distinct, plausible esports nicknames.
_NICK_HEAD = [
    "zy", "ax", "no", "ka", "ru", "sh", "vex", "kr", "bl", "fl", "sn", "tw",
    "gl", "ze", "qu", "dr", "fr", "sp", "ji", "lo", "mi", "ne", "pa", "ry",
]
_NICK_TAIL = [
    "ko", "den", "zer", "ix", "ron", "lo", "px", "qo", "sy", "th", "ne", "vo",
    "zen", "ax", "er", "us", "io", "ka", "el", "or", "ix", "an", "ow", "yn",
]
_FIRST = [
    "Lukas", "Mathias", "Oleksandr", "Robin", "Nikolaj", "Andre", "Felipe",
    "Ivan", "Kim", "Wei", "Daniel", "Marcus", "Pavel", "Gabriel", "Hampus",
    "Aleksi", "Owen", "Liam", "Bruno", "Yuki", "Emil", "Jaime", "Sergey",
]
_LAST = [
    "Andersen", "Petrov", "Costa", "Nguyen", "Kovac", "Hansen", "Silva",
    "Ivanov", "Park", "Zhang", "Olsen", "Reyes", "Novak", "Lindgren", "Schmidt",
    "Moreau", "Souza", "Tanaka", "Volkov", "Murphy", "Kowalski", "Berg",
]


def _make_nick(rng: random.Random, used: set[str]) -> str:
    for _ in range(40):
        nick = rng.choice(_NICK_HEAD) + rng.choice(_NICK_TAIL)
        nick = nick.capitalize() if rng.random() < 0.5 else nick
        if nick not in used:
            used.add(nick)
            return nick
    # extremely unlikely fallback
    nick = f"player{len(used)}"
    used.add(nick)
    return nick


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _make_roster(
    team: Team, team_skill: float, region: str, rng: random.Random, used_nicks: set[str]
) -> list[Player]:
    """Build a 5-player roster whose stats correlate with team strength."""
    nations = REGION_NATIONS.get(region, ["EU"])
    star_idx = rng.randint(0, 4)  # one stand-out player
    players: list[Player] = []

    for i, role in enumerate(ROLES):
        # Player skill ~ team skill + individual variation, with role/star nudges.
        ps = team_skill + rng.gauss(0.0, 0.55)
        if role == "AWPer":
            ps += 0.25
        if i == star_idx:
            ps += 0.5

        rating = round(_clamp(1.05 + 0.11 * ps + rng.gauss(0, 0.03), 0.78, 1.42), 2)
        kd = round(_clamp(0.85 + (rating - 1.0) * 1.15 + rng.gauss(0, 0.04), 0.7, 1.55), 2)
        adr = round(_clamp(75 + (rating - 1.05) * 95 + rng.gauss(0, 3.5), 55, 105), 1)
        kast = round(_clamp(72 + (rating - 1.05) * 32 + rng.gauss(0, 1.8), 62, 82), 1)
        hs = round(_clamp(48 + rng.gauss(0, 7), 28, 70), 1)

        nick = _make_nick(rng, used_nicks)
        photo = f"https://i.pravatar.cc/240?u={quote(nick + team.name)}"

        players.append(
            Player(
                team=team,
                nickname=nick,
                name=f"{rng.choice(_FIRST)} {rng.choice(_LAST)}",
                role=role,
                nationality=rng.choice(nations),
                photo_url=photo,
                age=rng.randint(17, 33),
                rating=rating,
                kd=kd,
                adr=adr,
                kast=kast,
                hs_pct=hs,
                maps_played=rng.randint(150, 1300),
            )
        )
    return players


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
    used_nicks: set[str] = set()
    for name in names:
        skill = rng.gauss(0.0, 1.0)
        skills[name] = skill
        region = rng.choice(REGIONS)
        team = Team(name=name, region=region, elo=1500.0)
        teams[name] = team
        session.add(team)
        # SQLAlchemy 2.0 doesn't cascade through the backref, so add explicitly.
        session.add_all(_make_roster(team, skill, region, rng, used_nicks))
    session.flush()  # assign team + player ids

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


# --------------------------------------------------------------------------- #
# PandaScore ingestion (real CS2 data)
# --------------------------------------------------------------------------- #

_PS_TIER = {"s": "S", "a": "A", "b": "B", "c": "B", "d": "B"}


def _parse_iso(ts: str | None) -> datetime:
    if not ts:
        return _utcnow()
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)


def _ps_stat(stats: dict, *keys: str) -> float | None:
    """Pull the first present numeric stat from a PandaScore stats payload,
    tolerating both flat keys and an 'averages'/'stats' nested block."""
    pools = [stats, stats.get("averages") or {}, stats.get("stats") or {}]
    for pool in pools:
        for k in keys:
            v = pool.get(k)
            if isinstance(v, (int, float)):
                return float(v)
    return None


def ingest_pandascore(
    session: Session,
    match_pages: int = 4,
    with_stats: bool = False,
    tiers: str = "s,a",
) -> tuple[int, int, int]:
    """Pull real matches -> their teams + rosters -> matches into the DB.

    With ``tiers`` set (default top-tier "s,a"), it pulls matches from recent
    tournaments at those tiers — recognizable teams with real player photos.
    Pass ``tiers="all"`` to use the raw recent-finished feed instead.

    Returns (teams, players, matches) written. Idempotent via *_pandascore_id.
    """
    from pandascore import PandaScoreClient

    teams_by_ps: dict[int, Team] = {
        t.pandascore_id: t
        for t in session.execute(select(Team).where(Team.pandascore_id.is_not(None))).scalars()
    }
    seen_matches = {
        m.pandascore_id
        for m in session.execute(
            select(Match).where(Match.pandascore_id.is_not(None))
        ).scalars()
    }

    n_teams = n_players = n_matches = 0

    with PandaScoreClient() as client:
        if tiers and tiers.lower() != "all":
            print(f"[pandascore] finding tier [{tiers}] tournaments…")
            tournaments = client.tournaments_by_tier(tiers, max_pages=match_pages)
            tids = [t["id"] for t in tournaments if t.get("id")]
            print(f"[pandascore] {len(tids)} tournaments; fetching their matches…")
            matches = client.matches_for_tournaments(tids)
        else:
            print(f"[pandascore] fetching up to {match_pages} pages of recent matches…")
            matches = client.past_matches(max_pages=match_pages)
        print(f"[pandascore] got {len(matches)} matches; resolving teams…")

        # Collect the team ids that actually appear in these matches.
        team_ids: list[int] = []
        for m in matches:
            for opp in m.get("opponents", []):
                tid = (opp.get("opponent") or {}).get("id")
                if tid and tid not in teams_by_ps:
                    team_ids.append(tid)

        # Batch-fetch those teams (rosters + photos come with the team object).
        for data in client.teams_by_ids(team_ids):
            tid = data.get("id")
            if tid is None or tid in teams_by_ps:
                continue
            team = Team(
                pandascore_id=tid,
                name=data.get("name") or f"Team {tid}",
                acronym=data.get("acronym"),
                logo_url=data.get("image_url"),
                region=data.get("location") or None,
                elo=1500.0,
            )
            session.add(team)
            session.flush()
            teams_by_ps[tid] = team
            n_teams += 1

            for p in data.get("players", []) or []:
                # Per-player performance stats need a paid PandaScore plan
                # (free tier 403s), so they stay null — we never fabricate them.
                stats_vals: dict[str, float | None] = {}
                if with_stats and p.get("id"):
                    try:
                        st = client.player_stats(p["id"])
                        stats_vals = {
                            "kd": _ps_stat(st, "kd_ratio", "kills_deaths"),
                            "adr": _ps_stat(st, "adr", "average_damage_per_round"),
                            "kast": _ps_stat(st, "kast"),
                            "hs_pct": _ps_stat(st, "headshots", "hs_percentage"),
                            "rating": _ps_stat(st, "rating"),
                        }
                    except Exception as exc:  # noqa: BLE001
                        print(f"[pandascore] no stats for player {p.get('id')}: {exc}")
                nat = (p.get("nationality") or "").upper()[:2] or None
                full = " ".join(filter(None, [p.get("first_name"), p.get("last_name")])) or None
                session.add(
                    Player(
                        pandascore_id=p.get("id"),
                        team=team,
                        nickname=p.get("name") or "?",
                        name=full,
                        role=p.get("role"),
                        nationality=nat,
                        photo_url=p.get("image_url"),
                        age=p.get("age"),
                        **stats_vals,
                    )
                )
                n_players += 1

        session.commit()
        print(f"[pandascore] teams={n_teams} players={n_players}; writing matches…")

        # Upsert the matches themselves.
        for m in matches:
            mid = m.get("id")
            if mid in seen_matches:
                continue
            # Only real, completed, non-forfeit matches with a known start time.
            if m.get("status") != "finished" or m.get("forfeit"):
                continue
            if not (m.get("begin_at") or m.get("scheduled_at")):
                continue
            opps = m.get("opponents", [])
            if len(opps) != 2:
                continue
            ta_id = (opps[0].get("opponent") or {}).get("id")
            tb_id = (opps[1].get("opponent") or {}).get("id")
            ta, tb = teams_by_ps.get(ta_id), teams_by_ps.get(tb_id)
            if not ta or not tb or m.get("winner_id") is None:
                continue

            scores = {r.get("team_id"): r.get("score", 0) for r in m.get("results", [])}
            score_a = int(scores.get(ta_id, 0))
            score_b = int(scores.get(tb_id, 0))
            if score_a == 0 and score_b == 0:  # walkover / no maps played
                continue
            winner = "a" if m["winner_id"] == ta_id else "b"

            tournament = m.get("tournament") or {}
            serie = m.get("serie") or {}
            league = m.get("league") or {}
            name_blob = " ".join(
                str(x) for x in [league.get("name"), serie.get("full_name"), tournament.get("name")] if x
            )
            tier = _PS_TIER.get(str(tournament.get("tier") or "").lower(), "B")
            is_major = "major" in name_blob.lower()

            played_at = _parse_iso(
                m.get("begin_at")
                or m.get("end_at")
                or m.get("scheduled_at")
                or m.get("modified_at")
            )
            session.add(
                Match(
                    pandascore_id=mid,
                    played_at=played_at,
                    team_a_id=ta.id,
                    team_b_id=tb.id,
                    score_a=score_a,
                    score_b=score_b,
                    winner=winner,
                    event_name=name_blob[:256] or None,
                    event_tier=tier,
                    is_lan=False,  # PandaScore doesn't reliably flag LAN
                    is_major=is_major,
                    best_of=int(m.get("number_of_games") or 3),
                )
            )
            seen_matches.add(mid)
            n_matches += 1

        session.commit()

    return n_teams, n_players, n_matches


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
    # Load tokens/config from .env (backend/.env first, then project-root .env).
    try:
        from dotenv import load_dotenv

        load_dotenv()
        load_dotenv(os.path.join("..", ".env"))
    except ImportError:
        pass

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

    p_ps = sub.add_parser("pandascore", help="ingest real CS2 data from PandaScore")
    p_ps.add_argument(
        "--pages", type=int, default=4,
        help="pages to scan (tournaments when --tier set, else matches); 100/page",
    )
    p_ps.add_argument(
        "--tier", default="s,a",
        help="tournament tier(s) to pull, e.g. 's,a' (default) or 'all' for the raw feed",
    )
    p_ps.add_argument("--with-stats", action="store_true", help="also try per-player stats (paid tier)")
    p_ps.add_argument(
        "--fresh",
        action="store_true",
        help="drop & recreate all tables first (recommended when switching to real data)",
    )

    args = parser.parse_args()

    if args.cmd == "pandascore" and args.fresh:
        from db import reset_db

        reset_db()
        print("[pandascore] dropped & recreated all tables.")

    engine = init_db()
    with Session(engine) as session:
        if args.cmd == "seed":
            if args.reset:
                session.query(Match).delete()
                session.query(Player).delete()
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
        elif args.cmd == "pandascore":
            t, p, mt = ingest_pandascore(
                session, match_pages=args.pages, with_stats=args.with_stats, tiers=args.tier
            )
            print(f"[pandascore] wrote {t} teams, {p} players, {mt} matches.")


if __name__ == "__main__":
    main()
