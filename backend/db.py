"""SQLAlchemy models for teams, matches, and ratings.

SQLite by default for dev — the same models work against Postgres for prod.
"""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Boolean,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/cs2.db")


class Base(DeclarativeBase):
    pass


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # External provider id (e.g. PandaScore) for idempotent upserts.
    pandascore_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    acronym: Mapped[str | None] = mapped_column(String(32), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    region: Mapped[str | None] = mapped_column(String(32), nullable=True)
    elo: Mapped[float] = mapped_column(Float, default=1500.0)

    matches_a = relationship("Match", foreign_keys="Match.team_a_id", back_populates="team_a")
    matches_b = relationship("Match", foreign_keys="Match.team_b_id", back_populates="team_b")
    players = relationship("Player", back_populates="team", cascade="all, delete-orphan")


class Player(Base):
    """A roster player with the per-player stats the dashboard compares."""

    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pandascore_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)

    nickname: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(2), nullable=True)  # ISO-2
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Core CS2 stats (HLTV-style). Nullable: real providers don't always expose
    # every figure, and we'd rather show "—" than a fabricated number.
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)   # HLTV 2.0 rating
    kd: Mapped[float | None] = mapped_column(Float, nullable=True)        # kill/death ratio
    adr: Mapped[float | None] = mapped_column(Float, nullable=True)       # avg damage / round
    kast: Mapped[float | None] = mapped_column(Float, nullable=True)      # % rounds w/ K/A/S/T
    hs_pct: Mapped[float | None] = mapped_column(Float, nullable=True)    # headshot %
    maps_played: Mapped[int | None] = mapped_column(Integer, nullable=True)

    team = relationship("Team", back_populates="players")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hltv_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True, index=True)
    pandascore_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True, index=True)
    played_at: Mapped[datetime] = mapped_column(DateTime, index=True)

    team_a_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)
    team_b_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)

    score_a: Mapped[int] = mapped_column(Integer)
    score_b: Mapped[int] = mapped_column(Integer)
    winner: Mapped[str] = mapped_column(String(1))  # 'a' | 'b'

    event_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    event_tier: Mapped[str | None] = mapped_column(String(8), nullable=True)  # 'S','A','B'
    is_lan: Mapped[bool] = mapped_column(Boolean, default=False)
    is_major: Mapped[bool] = mapped_column(Boolean, default=False)
    best_of: Mapped[int] = mapped_column(Integer, default=3)

    team_a = relationship("Team", foreign_keys=[team_a_id], back_populates="matches_a")
    team_b = relationship("Team", foreign_keys=[team_b_id], back_populates="matches_b")


def make_engine(url: str | None = None):
    url = url or DATABASE_URL
    if url.startswith("sqlite"):
        # ensure data/ exists
        Path("data").mkdir(parents=True, exist_ok=True)
    return create_engine(url, future=True)


def init_db(url: str | None = None):
    engine = make_engine(url)
    Base.metadata.create_all(engine)
    return engine


def reset_db(url: str | None = None):
    """Drop and recreate every table. Use when switching data sources, since
    create_all won't add newly-introduced columns to an existing table."""
    engine = make_engine(url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    return engine


SessionLocal = sessionmaker(bind=make_engine(), autoflush=False, autocommit=False, future=True)
