"""LightGBM-based demand forecaster with Algerian calendar events.

Replaces the previous Chronos (zero-shot) approach with a trained LightGBM
model that supports covariates:
  - Lag features (1, 7, 14, 28 days)
  - Rolling statistics (mean/std over 7, 14, 28 day windows)
  - Calendar features (day-of-week, month, weekend/holiday, etc.)
  - Islamic events (Ramadan, Eid al-Fitr, Eid al-Adha, Mawlid)
  - Algerian national holidays (New Year, Yennayer, Labour Day, Independence, Revolution)

Selected after benchmarking 5 models (see benchmark_covariates.py):
  LightGBM MAE 318,741 DZD (+12.2% vs baseline, +5.8% vs Chronos)
"""

import logging
from typing import Optional
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app.config import settings

logger = logging.getLogger(__name__)

# ── Algerian national holidays (fixed Gregorian dates) ──────────
ALGERIAN_NATIONAL_HOLIDAYS = [
    (1, 1),    # New Year's Day
    (1, 12),   # Yennayer (Berber New Year)
    (5, 1),    # Labour Day
    (7, 5),    # Independence Day
    (11, 1),   # Revolution Day
]


# ── Islamic & Algerian calendar events ──────────────────────────

def get_islamic_events(start_year: int, end_year: int) -> list[dict]:
    """Compute dates for major Islamic events using hijri-converter.

    Events shift ~11 days earlier each Gregorian year.
    Also includes fixed Algerian national holidays.
    """
    events = []
    try:
        from hijri_converter import Hijri

        for greg_year in range(start_year, end_year + 1):
            hijri_year = greg_year - 579

            for hy in [hijri_year, hijri_year + 1]:
                try:
                    # Ramadan: month 9 (30 days)
                    ramadan_start = Hijri(hy, 9, 1).to_gregorian()
                    for d_off in range(30):
                        d = ramadan_start + pd.Timedelta(days=d_off)
                        if d.year in range(start_year, end_year + 1):
                            events.append({"date": d, "event": "ramadan"})

                    # Eid al-Fitr: month 10, days 1-3 (3 days)
                    eid_fitr = Hijri(hy, 10, 1).to_gregorian()
                    for d_off in range(3):
                        d = eid_fitr + pd.Timedelta(days=d_off)
                        if d.year in range(start_year, end_year + 1):
                            events.append({"date": d, "event": "eid_al_fitr"})

                    # Eid al-Adha: month 12, days 10-12 (3 days)
                    eid_adha = Hijri(hy, 12, 10).to_gregorian()
                    for d_off in range(3):
                        d = eid_adha + pd.Timedelta(days=d_off)
                        if d.year in range(start_year, end_year + 1):
                            events.append({"date": d, "event": "eid_al_adha"})

                    # Mawlid: month 3, day 12
                    mawlid = Hijri(hy, 3, 12).to_gregorian()
                    if mawlid.year in range(start_year, end_year + 1):
                        events.append({"date": mawlid, "event": "mawlid"})

                except (ValueError, OverflowError):
                    continue
    except ImportError:
        logger.warning("hijri-converter not installed — Islamic events disabled")

    # Add Algerian national holidays for each year
    for greg_year in range(start_year, end_year + 1):
        for month, day in ALGERIAN_NATIONAL_HOLIDAYS:
            try:
                d = pd.Timestamp(year=greg_year, month=month, day=day)
                events.append({"date": d, "event": "algerian_holiday"})
            except ValueError:
                continue

    # Deduplicate
    seen = set()
    unique = []
    for e in events:
        key = (e["date"], e["event"])
        if key not in seen:
            seen.add(key)
            unique.append(e)
    return unique


FEATURE_COLS = [
    "day_of_week", "month", "is_weekend", "day_of_month", "week_of_year",
    "ramadan", "eid_al_fitr", "eid_al_adha", "mawlid",
    "algerian_holiday",
    "lag_1", "lag_7", "lag_14", "lag_28",
    "rolling_mean_7", "rolling_mean_14", "rolling_mean_28",
    "rolling_std_7", "rolling_std_14", "rolling_std_28",
]

EVENT_TYPES = ["ramadan", "eid_al_fitr", "eid_al_adha", "mawlid", "algerian_holiday"]


class DemandForecaster:
    """LightGBM demand forecaster with Islamic calendar covariates."""

    def __init__(self):
        self.time_series_data: dict[str, dict] = {}
        self.models: dict[str, object] = {}  # per-category LightGBM models
        self.residual_std: dict[str, float] = {}  # for confidence intervals
        self._loaded = False

    def load(self, model_dir: Optional[Path] = None) -> bool:
        """Load saved time series data and LightGBM models."""
        model_dir = model_dir or settings.MODEL_DIR

        # Load time series history
        ts_path = model_dir / "forecaster_models.joblib"
        if not ts_path.exists():
            return False

        try:
            data = joblib.load(ts_path)
        except Exception as e:
            logger.warning("Could not load forecaster data: %s", e)
            return False

        # Accept new format (dict of date/value lists) or legacy Prophet format
        first_val = next(iter(data.values()), None)
        if first_val is None:
            return False

        if isinstance(first_val, dict) and "values" in first_val:
            self.time_series_data = data
        else:
            if not self._extract_from_prophet(data):
                return False

        # Load LightGBM models
        lgbm_path = model_dir / "forecaster_lgbm.joblib"
        if lgbm_path.exists():
            try:
                saved = joblib.load(lgbm_path)
                self.models = saved.get("models", {})
                self.residual_std = saved.get("residual_std", {})
                logger.info(
                    "LightGBM forecaster loaded (%d categories)", len(self.models)
                )
            except Exception as e:
                logger.warning("Could not load LightGBM models: %s", e)

        self._loaded = True
        return True

    def _extract_from_prophet(self, models: dict) -> bool:
        """Extract time series data from legacy Prophet model objects."""
        try:
            for key, model in models.items():
                if hasattr(model, "history"):
                    history = model.history
                    self.time_series_data[key] = {
                        "dates": history["ds"].dt.strftime("%Y-%m-%d").tolist(),
                        "values": history["y"].tolist(),
                    }
            return bool(self.time_series_data)
        except Exception as e:
            logger.warning("Could not extract data from Prophet models: %s", e)
            return False

    # ── Public API ────────────────────────────────────────────

    def prepare_time_series(
        self, orders_df: pd.DataFrame, category: Optional[str] = None
    ) -> pd.DataFrame:
        """Prepare daily time series from orders data."""
        df = orders_df.copy()
        df["order_date"] = pd.to_datetime(df["order_date"])
        df["ds"] = df["order_date"].dt.date

        if category and "product_category" in df.columns:
            df = df[df["product_category"] == category]

        daily = (
            df.groupby("ds")
            .agg(y=("total_amount", "sum"), order_count=("total_amount", "count"))
            .reset_index()
        )
        daily["ds"] = pd.to_datetime(daily["ds"])

        full_range = pd.date_range(daily["ds"].min(), daily["ds"].max(), freq="D")
        daily = daily.set_index("ds").reindex(full_range, fill_value=0).reset_index()
        daily.columns = ["ds", "y", "order_count"]
        return daily

    def forecast(self, category: str = "all", periods: int = 30) -> dict:
        """Generate demand forecast for a category."""
        if not self._loaded:
            raise RuntimeError("Models not loaded. Call load() first.")

        model_key = category if category in self.time_series_data else "all"
        if model_key not in self.time_series_data:
            raise ValueError(f"No data found for category: {category}")

        ts = self.time_series_data[model_key]
        values = np.array(ts["values"], dtype=np.float64)
        dates = pd.to_datetime(ts["dates"])
        last_date = dates.max()

        # Use LightGBM if available, else statistical fallback
        lgbm_model = self.models.get(model_key)
        if lgbm_model is not None:
            return self._forecast_lgbm(
                lgbm_model, values, last_date, category, periods, model_key
            )
        return self._forecast_statistical(values, last_date, category, periods)

    def get_available_categories(self) -> list[str]:
        """Return list of categories with available time series data."""
        return list(self.time_series_data.keys())

    # ── LightGBM Forecasting (recursive multi-step) ───────────

    def _forecast_lgbm(
        self, model, values: np.ndarray, last_date, category: str,
        periods: int, model_key: str,
    ) -> dict:
        """Forecast using trained LightGBM with recursive multi-step prediction."""
        history_values = list(values)
        predictions = []

        # Pre-compute Islamic event dates for the forecast horizon
        start_year = int(last_date.year)
        end_year = start_year + 2
        events = get_islamic_events(start_year, end_year)
        event_dates_by_type = {}
        for etype in EVENT_TYPES:
            event_dates_by_type[etype] = set(
                pd.Timestamp(e["date"]).normalize()
                for e in events
                if e["event"] == etype
            )

        future_dates = pd.date_range(
            start=last_date + pd.Timedelta(days=1), periods=periods, freq="D"
        )

        for i in range(periods):
            dt = future_dates[i]
            row = self._build_features_for_date(
                dt, history_values, event_dates_by_type
            )
            X_row = np.array([[row[c] for c in FEATURE_COLS]])
            pred_val = max(0, float(model.predict(X_row)[0]))
            predictions.append(pred_val)
            history_values.append(pred_val)

        # Confidence intervals from training residual std
        std = self.residual_std.get(model_key, np.std(values[-30:]) * 0.3)
        pred_arr = np.array(predictions)

        results = []
        for i in range(periods):
            # Wider CI as horizon grows (uncertainty accumulates)
            ci_factor = 1.28 * (1 + i * 0.02)  # ~80% CI, growing with horizon
            results.append({
                "ds": future_dates[i].strftime("%Y-%m-%d"),
                "yhat": round(float(pred_arr[i]), 2),
                "yhat_lower": round(max(0, float(pred_arr[i] - std * ci_factor)), 2),
                "yhat_upper": round(float(pred_arr[i] + std * ci_factor), 2),
            })

        # Build event annotations for chart reference lines
        _ALGERIAN_HOLIDAY_NAMES = {
            (1, 1): "Nouvel An",
            (1, 12): "Yennayer",
            (5, 1): "Fête du Travail",
            (7, 5): "Indépendance",
            (11, 1): "Révolution",
        }
        _ISLAMIC_EVENT_LABELS = {
            "eid_al_fitr": "Aïd el-Fitr",
            "eid_al_adha": "Aïd el-Adha",
            "mawlid": "Mawlid",
        }
        event_annotations = []
        seen_annotation_keys = set()
        prev_ramadan = False
        for i in range(periods):
            dt = future_dates[i]
            dt_norm = dt.normalize()
            date_str = dt.strftime("%Y-%m-%d")

            # Ramadan start (first day of Ramadan in forecast window)
            is_ramadan = dt_norm in event_dates_by_type.get("ramadan", set())
            if is_ramadan and not prev_ramadan:
                event_annotations.append({
                    "date": date_str, "event": "ramadan_start", "label": "Début Ramadan"
                })
            prev_ramadan = is_ramadan

            # Islamic holidays (only first day of each event)
            for etype, label in _ISLAMIC_EVENT_LABELS.items():
                if dt_norm in event_dates_by_type.get(etype, set()) and etype not in seen_annotation_keys:
                    event_annotations.append({"date": date_str, "event": etype, "label": label})
                    seen_annotation_keys.add(etype)

            # Algerian national holidays
            md = (dt.month, dt.day)
            if dt_norm in event_dates_by_type.get("algerian_holiday", set()):
                name = _ALGERIAN_HOLIDAY_NAMES.get(md, "Jour Férié")
                key = f"algerian_{md}"
                if key not in seen_annotation_keys:
                    event_annotations.append({
                        "date": date_str, "event": "algerian_holiday", "label": name
                    })
                    seen_annotation_keys.add(key)

        return {
            "category": category,
            "periods": periods,
            "method": "lightgbm",
            "predictions": results,
            "event_annotations": event_annotations,
        }

    @staticmethod
    def _build_features_for_date(
        dt: pd.Timestamp,
        history_values: list[float],
        event_dates_by_type: dict[str, set],
    ) -> dict:
        """Build feature dict for a single prediction date."""
        # Check if date is an Algerian off-day (Fri-Sat weekend, national + Islamic holidays)
        dt_norm = dt.normalize()
        is_off = int(dt.dayofweek in (4, 5))  # Friday=4, Saturday=5
        if not is_off:
            md = (dt.month, dt.day)
            if md in [(1, 1), (1, 12), (5, 1), (7, 5), (11, 1)]:
                is_off = 1
            elif dt_norm in event_dates_by_type.get("eid_al_fitr", set()):
                is_off = 1
            elif dt_norm in event_dates_by_type.get("eid_al_adha", set()):
                is_off = 1
            elif dt_norm in event_dates_by_type.get("mawlid", set()):
                is_off = 1
            elif dt_norm in event_dates_by_type.get("algerian_holiday", set()):
                is_off = 1

        row = {
            "day_of_week": dt.dayofweek,
            "month": dt.month,
            "is_weekend": is_off,
            "day_of_month": dt.day,
            "week_of_year": int(dt.isocalendar()[1]),
        }

        # Islamic & Algerian event flags
        for etype in EVENT_TYPES:
            row[etype] = int(dt_norm in event_dates_by_type.get(etype, set()))

        # Lag features
        n = len(history_values)
        row["lag_1"] = history_values[n - 1]
        row["lag_7"] = history_values[n - 7] if n >= 7 else history_values[0]
        row["lag_14"] = history_values[n - 14] if n >= 14 else history_values[0]
        row["lag_28"] = history_values[n - 28] if n >= 28 else history_values[0]

        # Rolling stats
        for window in [7, 14, 28]:
            recent = history_values[max(0, n - window) : n]
            row[f"rolling_mean_{window}"] = float(np.mean(recent))
            row[f"rolling_std_{window}"] = (
                float(np.std(recent, ddof=1)) if len(recent) > 1 else 0.0
            )

        return row

    # ── Statistical Fallback ──────────────────────────────────

    def _forecast_statistical(
        self, values: np.ndarray, last_date, category: str, periods: int
    ) -> dict:
        """Simple moving-average forecast when LightGBM model not available."""
        if len(values) < 7:
            raise ValueError("Not enough data for forecasting (need at least 7 days)")

        ma7 = float(values[-7:].mean())
        ma30 = float(values[-30:].mean()) if len(values) >= 30 else ma7

        predictions = []
        for i in range(1, periods + 1):
            date = last_date + pd.Timedelta(days=i)
            predicted = ma7 * 0.6 + ma30 * 0.4
            predictions.append({
                "ds": date.strftime("%Y-%m-%d"),
                "yhat": round(max(0, predicted), 2),
                "yhat_lower": round(max(0, predicted * 0.7), 2),
                "yhat_upper": round(max(0, predicted * 1.3), 2),
            })

        return {
            "category": category,
            "periods": periods,
            "method": "moving_average",
            "predictions": predictions,
        }
