"""Training pipeline: DB → features → calibrated XGBoost → metrics → model file.

Splits are **time-based**, never random. Shuffling match history would let the
model peek at the future (a team's later form leaking into an earlier match's
features), which inflates every metric. We sort by date and carve:

    [ ---- train 70% ---- | -- calibrate 15% -- | -- test 15% -- ]

We report accuracy, log loss, Brier score and AUC on the untouched test tail,
and compare against the pure-Elo baseline so the gain from feature engineering
is explicit.

Usage::

    python train.py                 # uses MODEL_PATH from env
    python train.py --out models/m.joblib --no-plot
"""

from __future__ import annotations

import argparse
import os

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    log_loss,
    roc_auc_score,
)
from sqlalchemy.orm import Session

from db import Team, init_db
from features import build_feature_table, fit_builder, FEATURE_COLUMNS
from predictor import Predictor


def time_split(df: pd.DataFrame, train_frac=0.70, cal_frac=0.15):
    """Chronological train / calibration / test split."""
    df = df.sort_values("played_at").reset_index(drop=True)
    n = len(df)
    i_train = int(n * train_frac)
    i_cal = int(n * (train_frac + cal_frac))
    return df.iloc[:i_train], df.iloc[i_train:i_cal], df.iloc[i_cal:]


def _metrics(y_true, p) -> dict[str, float]:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return {
        "accuracy": float(accuracy_score(y_true, (p >= 0.5).astype(int))),
        "log_loss": float(log_loss(y_true, p)),
        "brier": float(brier_score_loss(y_true, p)),
        "auc": float(roc_auc_score(y_true, p)) if len(set(y_true)) > 1 else float("nan"),
        "n": int(len(y_true)),
    }


def _print_metrics(title: str, m: dict[str, float]) -> None:
    print(
        f"{title:<22} acc={m['accuracy']:.3f}  logloss={m['log_loss']:.3f}  "
        f"brier={m['brier']:.3f}  auc={m['auc']:.3f}  (n={m['n']})"
    )


def _reliability_plot(y_true, p, out_path: str) -> None:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from sklearn.calibration import calibration_curve
    except Exception as exc:  # noqa: BLE001
        print(f"[plot] skipping reliability diagram: {exc}")
        return

    frac_pos, mean_pred = calibration_curve(y_true, p, n_bins=10, strategy="quantile")
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.plot([0, 1], [0, 1], "--", color="gray", label="perfect")
    ax.plot(mean_pred, frac_pos, "o-", label="model")
    ax.set_xlabel("Predicted P(team A wins)")
    ax.set_ylabel("Observed frequency")
    ax.set_title("Reliability diagram (test set)")
    ax.legend()
    fig.tight_layout()
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    fig.savefig(out_path, dpi=120)
    plt.close(fig)
    print(f"[plot] wrote reliability diagram -> {out_path}")


def update_team_elo(session: Session) -> None:
    """Persist final point-in-time Elo onto each team (for the dashboard)."""
    builder = fit_builder(session)
    teams = {t.id: t for t in session.query(Team).all()}
    for team_id, st in builder.state.items():
        if team_id in teams:
            teams[team_id].elo = round(st.elo, 1)
    session.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the CS2 predictor.")
    parser.add_argument(
        "--out",
        default=os.getenv("MODEL_PATH", "./models/xgb_calibrated.joblib"),
    )
    parser.add_argument("--no-plot", action="store_true")
    parser.add_argument("--calibration", default="isotonic", choices=["isotonic", "sigmoid"])
    args = parser.parse_args()

    engine = init_db()
    with Session(engine) as session:
        print("[train] building feature table...")
        df = build_feature_table(session)
        if len(df) < 200:
            raise SystemExit(
                f"Only {len(df)} matches in DB — run `python ingest.py seed` first."
            )
        print(f"[train] {len(df)} matches, {len(FEATURE_COLUMNS)} features.")

        train_df, cal_df, test_df = time_split(df)
        print(
            f"[train] split -> train={len(train_df)} cal={len(cal_df)} test={len(test_df)}"
        )

        predictor = Predictor()
        predictor.fit(
            train_df, train_df["target"],
            cal_df, cal_df["target"],
            method=args.calibration,
        )

        # Model vs. the Elo-only baseline on the held-out test tail.
        p_model = predictor.predict_proba(test_df)
        p_elo = test_df["elo_expected_a"].to_numpy()
        y_test = test_df["target"].to_numpy()

        print("\n=== Test-set performance ===")
        _print_metrics("Elo baseline", _metrics(y_test, p_elo))
        _print_metrics("XGBoost (calibrated)", _metrics(y_test, p_model))

        predictor.save(args.out)
        print(f"\n[train] saved model -> {args.out}")

        if not args.no_plot:
            _reliability_plot(
                y_test, p_model,
                os.path.join(os.path.dirname(args.out) or ".", "reliability.png"),
            )

        update_team_elo(session)
        print("[train] updated team Elo ratings in DB.")


if __name__ == "__main__":
    main()
