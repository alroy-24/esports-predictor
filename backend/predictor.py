"""XGBoost match-outcome model with probability calibration and SHAP.

Why calibration matters here: an uncalibrated gradient-boosted model can be
77% confident and only right 65% of the time. For a betting backtest that gap
is the difference between profit and ruin, so we wrap the booster in an
isotonic calibrator fit on a held-out slice and ship reliability diagrams.

The class keeps two models:

* ``base``       — the raw ``XGBClassifier``, used for SHAP attributions.
* ``calibrated`` — ``CalibratedClassifierCV(cv="prefit")`` wrapping ``base``,
  used for every probability we actually report.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from xgboost import XGBClassifier

from features import FEATURE_COLUMNS


@dataclass
class Predictor:
    feature_columns: list[str] = field(default_factory=lambda: list(FEATURE_COLUMNS))
    params: dict[str, Any] = field(
        default_factory=lambda: dict(
            n_estimators=400,
            max_depth=4,
            learning_rate=0.03,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=3,
            reg_lambda=1.0,
            objective="binary:logistic",
            eval_metric="logloss",
            n_jobs=-1,
            random_state=42,
        )
    )
    base: XGBClassifier | None = None
    calibrated: CalibratedClassifierCV | None = None

    # -- training ----------------------------------------------------------- #

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_cal: pd.DataFrame,
        y_cal: pd.Series,
        method: str = "isotonic",
    ) -> "Predictor":
        """Fit the booster on train, then calibrate on a held-out slice."""
        self.base = XGBClassifier(**self.params)
        self.base.fit(X_train[self.feature_columns], y_train)

        # Calibrate the *already-fitted* booster on a held-out slice. sklearn
        # >=1.6 dropped cv="prefit" in favour of wrapping in FrozenEstimator;
        # fall back to the old API on older installs.
        try:
            from sklearn.frozen import FrozenEstimator

            self.calibrated = CalibratedClassifierCV(
                FrozenEstimator(self.base), method=method
            )
        except ImportError:
            self.calibrated = CalibratedClassifierCV(self.base, method=method, cv="prefit")
        self.calibrated.fit(X_cal[self.feature_columns], y_cal)
        return self

    # -- inference ---------------------------------------------------------- #

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Calibrated probability that team A wins, shape (n,)."""
        if self.calibrated is None:
            raise RuntimeError("Predictor is not fitted/loaded.")
        return self.calibrated.predict_proba(X[self.feature_columns])[:, 1]

    def predict_one(self, features: dict[str, float]) -> float:
        row = pd.DataFrame([features])[self.feature_columns]
        return float(self.predict_proba(row)[0])

    def explain_one(self, features: dict[str, float], top_k: int = 6) -> list[dict]:
        """SHAP attributions for a single prediction, largest magnitude first.

        Returns ``[{feature, value, shap}, ...]``. Uses the raw booster because
        SHAP's TreeExplainer needs the tree model, not the calibration wrapper.
        """
        import shap

        if self.base is None:
            raise RuntimeError("Predictor is not fitted/loaded.")
        row = pd.DataFrame([features])[self.feature_columns]
        explainer = shap.TreeExplainer(self.base)
        values = np.asarray(explainer.shap_values(row))
        if values.ndim == 3:  # some shap/xgb combos return (n, features, classes)
            values = values[..., -1]
        contribs = values[0]

        ranked = sorted(
            (
                {"feature": col, "value": float(row.iloc[0][col]), "shap": float(sv)}
                for col, sv in zip(self.feature_columns, contribs)
            ),
            key=lambda d: abs(d["shap"]),
            reverse=True,
        )
        return ranked[:top_k]

    # -- persistence -------------------------------------------------------- #

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "feature_columns": self.feature_columns,
                "params": self.params,
                "base": self.base,
                "calibrated": self.calibrated,
            },
            path,
        )

    @classmethod
    def load(cls, path: str | Path) -> "Predictor":
        blob = joblib.load(path)
        obj = cls(feature_columns=blob["feature_columns"], params=blob["params"])
        obj.base = blob["base"]
        obj.calibrated = blob["calibrated"]
        return obj
