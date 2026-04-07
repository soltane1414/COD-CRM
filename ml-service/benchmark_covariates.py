"""
benchmark_covariates.py — Forecast model benchmark WITH covariate support

Compares covariate-capable models for COD e-commerce demand forecasting:
1. Chronos-T5-Small  (baseline, zero-shot, NO covariates)
2. Prophet + holidays (additive regressors for calendar events)
3. NeuralProphet + events (neural net with event effects)
4. LightGBM + lags + calendar features (ML-based approach)

All models evaluated on the same 30-day out-of-sample test set.

Usage:
    cd ml-service
    python benchmark_covariates.py
"""

import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import json
import logging
import time
import warnings
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
PREPARED_DIR = BASE_DIR / "data" / "prepared"
MODEL_DIR = BASE_DIR / "trained_models"


# ═══════════════════════════════════════════════════════════════
# CALENDAR / HOLIDAY FEATURES
# ═══════════════════════════════════════════════════════════════

def get_islamic_events(start_year: int, end_year: int) -> list[dict]:
    """Compute approximate dates for major Islamic events using hijri-converter.

    These events shift ~11 days earlier each Gregorian year.
    Returns list of {date, event_name} dicts.
    """
    events = []
    try:
        from hijri_converter import Hijri

        for greg_year in range(start_year, end_year + 1):
            # Estimate Hijri year for this Gregorian year
            # The Hijri year is roughly greg_year - 579
            hijri_year = greg_year - 579

            for hy in [hijri_year, hijri_year + 1]:
                try:
                    # Ramadan: month 9 (30 days)
                    ramadan_start = Hijri(hy, 9, 1).to_gregorian()
                    for day_offset in range(30):
                        d = ramadan_start + pd.Timedelta(days=day_offset)
                        if d.year in range(start_year, end_year + 1):
                            events.append({"date": d, "event": "ramadan"})

                    # Eid al-Fitr: month 10, days 1-3
                    eid_fitr_start = Hijri(hy, 10, 1).to_gregorian()
                    for day_offset in range(3):
                        d = eid_fitr_start + pd.Timedelta(days=day_offset)
                        if d.year in range(start_year, end_year + 1):
                            events.append({"date": d, "event": "eid_al_fitr"})

                    # Eid al-Adha: month 12, days 10-13
                    eid_adha_start = Hijri(hy, 12, 10).to_gregorian()
                    for day_offset in range(4):
                        d = eid_adha_start + pd.Timedelta(days=day_offset)
                        if d.year in range(start_year, end_year + 1):
                            events.append({"date": d, "event": "eid_al_adha"})

                    # Mawlid: month 3, day 12
                    mawlid = Hijri(hy, 3, 12).to_gregorian()
                    if mawlid.year in range(start_year, end_year + 1):
                        events.append({"date": mawlid, "event": "mawlid"})

                except (ValueError, OverflowError):
                    continue

    except ImportError:
        logger.warning("hijri-converter not installed — skipping Islamic events")

    # Deduplicate
    seen = set()
    unique = []
    for e in events:
        key = (e["date"], e["event"])
        if key not in seen:
            seen.add(key)
            unique.append(e)

    return unique


def add_calendar_features(df: pd.DataFrame, ds_col: str = "ds") -> pd.DataFrame:
    """Add calendar and Islamic event features to a dataframe with a date column."""
    df = df.copy()
    dt = pd.to_datetime(df[ds_col])

    # Basic calendar
    df["day_of_week"] = dt.dt.dayofweek
    df["month"] = dt.dt.month
    df["is_weekend"] = (dt.dt.dayofweek >= 5).astype(int)
    df["day_of_month"] = dt.dt.day
    df["week_of_year"] = dt.dt.isocalendar().week.astype(int)

    # Islamic events
    start_year = int(dt.min().year)
    end_year = int(dt.max().year) + 1  # +1 for forecast horizon
    events = get_islamic_events(start_year, end_year)

    # Create binary columns for each event type
    event_types = ["ramadan", "eid_al_fitr", "eid_al_adha", "mawlid"]
    for etype in event_types:
        event_dates = set()
        for e in events:
            if e["event"] == etype:
                event_dates.add(pd.Timestamp(e["date"]).normalize())
        df[etype] = dt.dt.normalize().isin(event_dates).astype(int)

    return df


# ═══════════════════════════════════════════════════════════════
# DATA LOADING
# ═══════════════════════════════════════════════════════════════

def load_time_series() -> pd.DataFrame:
    """Load the daily revenue time series from prepared data."""
    import joblib

    # Try loading from saved time series data
    ts_path = MODEL_DIR / "forecaster_models.joblib"
    if ts_path.exists():
        data = joblib.load(ts_path)
        if "all" in data:
            ts = data["all"]
            df = pd.DataFrame({
                "ds": pd.to_datetime(ts["dates"]),
                "y": ts["values"],
            })
            logger.info(f"Loaded time series: {len(df)} days from forecaster_models.joblib")
            return df

    # Fallback: rebuild from crm_orders.csv
    csv_path = PREPARED_DIR / "crm_orders.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"No data found at {ts_path} or {csv_path}")

    orders = pd.read_csv(csv_path)
    orders["order_date"] = pd.to_datetime(orders["order_date"])
    delivered = orders[orders["is_delivered"] == 1]

    daily = delivered.groupby(delivered["order_date"].dt.date).agg(
        y=("total_amount", "sum")
    ).reset_index()
    daily.columns = ["ds", "y"]
    daily["ds"] = pd.to_datetime(daily["ds"])

    full_range = pd.date_range(daily["ds"].min(), daily["ds"].max(), freq="D")
    daily = daily.set_index("ds").reindex(full_range, fill_value=0).reset_index()
    daily.columns = ["ds", "y"]

    logger.info(f"Loaded time series: {len(daily)} days from crm_orders.csv")
    return daily


# ═══════════════════════════════════════════════════════════════
# MODEL BENCHMARKS
# ═══════════════════════════════════════════════════════════════

def compute_metrics(actual: np.ndarray, predicted: np.ndarray) -> dict:
    """Compute MAE, RMSE, MAPE for forecast evaluation."""
    mae = float(np.abs(actual - predicted).mean())
    rmse = float(np.sqrt(((actual - predicted) ** 2).mean()))
    # MAPE with protection against zero
    nonzero_mask = actual != 0
    if nonzero_mask.sum() > 0:
        mape = float(np.abs((actual[nonzero_mask] - predicted[nonzero_mask]) / actual[nonzero_mask]).mean() * 100)
    else:
        mape = float("inf")
    return {"mae": round(mae, 2), "rmse": round(rmse, 2), "mape": round(mape, 2)}


def benchmark_moving_avg(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    """Moving Average (7-day) baseline."""
    t0 = time.time()
    ma7 = train["y"].iloc[-7:].mean()
    pred = np.full(len(test), ma7)
    elapsed = time.time() - t0

    metrics = compute_metrics(test["y"].values, pred)
    return {"model": "Moving Avg 7d (baseline)", "supports_covariates": False, **metrics, "time_sec": round(elapsed, 2)}


def benchmark_chronos(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    """Amazon Chronos T5-Small — zero-shot, no covariates."""
    t0 = time.time()
    try:
        import torch
        from chronos import ChronosPipeline

        pipeline = ChronosPipeline.from_pretrained(
            "amazon/chronos-t5-small",
            device_map="cpu",
            torch_dtype=torch.float32,
        )

        context = torch.tensor(train["y"].values, dtype=torch.float32).unsqueeze(0)
        forecast = pipeline.predict(context, prediction_length=len(test), num_samples=20)
        pred = torch.median(forecast.float(), dim=1).values.squeeze(0).numpy()
        pred = np.maximum(pred, 0)  # clip negatives

        elapsed = time.time() - t0
        metrics = compute_metrics(test["y"].values, pred)
        return {"model": "Chronos-T5-Small", "supports_covariates": False, **metrics, "time_sec": round(elapsed, 2)}

    except Exception as e:
        logger.error(f"Chronos failed: {e}")
        return {"model": "Chronos-T5-Small", "error": str(e)}


def benchmark_prophet(train: pd.DataFrame, test: pd.DataFrame, use_holidays: bool = True) -> dict:
    """Prophet with optional Islamic holiday regressors."""
    t0 = time.time()
    try:
        from prophet import Prophet

        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05,
        )

        train_df = train[["ds", "y"]].copy()
        future_df = test[["ds"]].copy()

        if use_holidays:
            # Add Islamic event regressors
            train_cal = add_calendar_features(train_df, "ds")
            future_cal = add_calendar_features(future_df, "ds")

            event_cols = ["ramadan", "eid_al_fitr", "eid_al_adha", "mawlid", "is_weekend"]
            for col in event_cols:
                model.add_regressor(col)

            train_df = train_cal[["ds", "y"] + event_cols]
            future_df = future_cal[["ds"] + event_cols]

        model.fit(train_df)
        forecast = model.predict(future_df)
        pred = np.maximum(forecast["yhat"].values, 0)

        elapsed = time.time() - t0
        metrics = compute_metrics(test["y"].values, pred)
        model_name = "Prophet + Islamic holidays" if use_holidays else "Prophet (no holidays)"
        return {"model": model_name, "supports_covariates": True, **metrics, "time_sec": round(elapsed, 2)}

    except Exception as e:
        logger.error(f"Prophet failed: {e}")
        return {"model": "Prophet + Islamic holidays", "error": str(e)}


def benchmark_neuralprophet(train: pd.DataFrame, test: pd.DataFrame, use_events: bool = True) -> dict:
    """NeuralProphet with Islamic event effects."""
    t0 = time.time()
    try:
        from neuralprophet import NeuralProphet, set_log_level
        set_log_level("ERROR")

        model = NeuralProphet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            n_changepoints=10,
            learning_rate=0.1,
            epochs=100,
            batch_size=64,
        )

        train_df = train[["ds", "y"]].copy()

        if use_events:
            # Build events dataframe
            start_year = int(train_df["ds"].min().year)
            end_year = int(test["ds"].max().year) + 1
            events_list = get_islamic_events(start_year, end_year)

            if events_list:
                events_df = pd.DataFrame(events_list)
                events_df["ds"] = pd.to_datetime(events_df["date"])
                events_df = events_df[["ds", "event"]].drop_duplicates()

                for event_name in events_df["event"].unique():
                    model.add_events(event_name)

                train_df = model.create_df_with_events(train_df, events_df)

        model.fit(train_df, freq="D")

        future = model.make_future_dataframe(train_df, periods=len(test))
        if use_events and events_list:
            future = model.create_df_with_events(future, events_df)

        forecast = model.predict(future)

        # NeuralProphet returns forecast for all data; take last N rows
        pred = forecast["yhat1"].values[-len(test):]
        pred = np.maximum(pred, 0)

        elapsed = time.time() - t0
        metrics = compute_metrics(test["y"].values, pred)
        model_name = "NeuralProphet + Islamic events" if use_events else "NeuralProphet (no events)"
        return {"model": model_name, "supports_covariates": True, **metrics, "time_sec": round(elapsed, 2)}

    except Exception as e:
        logger.error(f"NeuralProphet failed: {e}")
        return {"model": "NeuralProphet + Islamic events", "error": str(e)}


def _build_lgbm_features(df: pd.DataFrame, feature_cols: list[str]) -> pd.DataFrame:
    """Build lag + rolling + calendar features for LightGBM forecasting."""
    df = add_calendar_features(df, "ds")

    # Lag features
    for lag in [1, 7, 14, 28]:
        df[f"lag_{lag}"] = df["y"].shift(lag)

    # Rolling stats (shift by 1 to avoid leaking current day)
    for window in [7, 14, 28]:
        df[f"rolling_mean_{window}"] = df["y"].shift(1).rolling(window).mean()
        df[f"rolling_std_{window}"] = df["y"].shift(1).rolling(window).std()

    return df


LGBM_FEATURE_COLS = [
    "day_of_week", "month", "is_weekend", "day_of_month", "week_of_year",
    "ramadan", "eid_al_fitr", "eid_al_adha", "mawlid",
    "lag_1", "lag_7", "lag_14", "lag_28",
    "rolling_mean_7", "rolling_mean_14", "rolling_mean_28",
    "rolling_std_7", "rolling_std_14", "rolling_std_28",
]


def benchmark_lightgbm(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    """LightGBM with lag features + calendar + Islamic holidays.

    Uses RECURSIVE multi-step forecasting to avoid data leakage:
    predict day 1 → use prediction as lag_1 for day 2 → predict day 2 → etc.
    """
    t0 = time.time()
    try:
        from lightgbm import LGBMRegressor

        # Build training features (no leakage — only uses training data)
        train_feat = _build_lgbm_features(train.copy(), LGBM_FEATURE_COLS)
        train_feat = train_feat.dropna(subset=LGBM_FEATURE_COLS)

        X_train = train_feat[LGBM_FEATURE_COLS].values
        y_train_vals = train_feat["y"].values

        model = LGBMRegressor(
            n_estimators=300,
            max_depth=8,
            learning_rate=0.05,
            num_leaves=31,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            verbose=-1,
        )
        model.fit(X_train, y_train_vals)

        # ── Recursive multi-step forecasting ──
        # Keep a rolling list of recent values (train tail + predictions)
        history_values = list(train["y"].values)
        predictions = []

        # Pre-compute Islamic dates for test period
        start_year = int(test["ds"].min().year)
        end_year = int(test["ds"].max().year) + 1
        events = get_islamic_events(start_year, end_year)
        event_dates_by_type = {}
        for etype in ["ramadan", "eid_al_fitr", "eid_al_adha", "mawlid"]:
            event_dates_by_type[etype] = set(
                pd.Timestamp(e["date"]).normalize() for e in events if e["event"] == etype
            )

        for i in range(len(test)):
            dt = pd.Timestamp(test.iloc[i]["ds"])

            # Calendar features
            row = {
                "day_of_week": dt.dayofweek,
                "month": dt.month,
                "is_weekend": int(dt.dayofweek >= 5),
                "day_of_month": dt.day,
                "week_of_year": int(dt.isocalendar()[1]),
            }

            # Islamic events
            dt_normalized = dt.normalize()
            for etype in ["ramadan", "eid_al_fitr", "eid_al_adha", "mawlid"]:
                row[etype] = int(dt_normalized in event_dates_by_type.get(etype, set()))

            # Lag features (from history: actual train values + previous predictions)
            n = len(history_values)
            row["lag_1"] = history_values[n - 1]
            row["lag_7"] = history_values[n - 7] if n >= 7 else history_values[0]
            row["lag_14"] = history_values[n - 14] if n >= 14 else history_values[0]
            row["lag_28"] = history_values[n - 28] if n >= 28 else history_values[0]

            # Rolling stats (from previous values, excluding current)
            for window in [7, 14, 28]:
                recent = history_values[max(0, n - window):n]
                row[f"rolling_mean_{window}"] = float(np.mean(recent))
                row[f"rolling_std_{window}"] = float(np.std(recent)) if len(recent) > 1 else 0.0

            # Predict
            X_row = np.array([[row[c] for c in LGBM_FEATURE_COLS]])
            pred_val = max(0, float(model.predict(X_row)[0]))
            predictions.append(pred_val)
            history_values.append(pred_val)  # feed prediction back

        pred = np.array(predictions)
        elapsed = time.time() - t0
        metrics = compute_metrics(test["y"].values, pred)
        return {"model": "LightGBM + lags + holidays", "supports_covariates": True, **metrics, "time_sec": round(elapsed, 2)}

    except Exception as e:
        logger.error(f"LightGBM failed: {e}")
        return {"model": "LightGBM + lags + holidays", "error": str(e)}


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 70)
    print("  FORECASTING BENCHMARK — Covariate-Capable Models")
    print("=" * 70)

    # Load data
    daily = load_time_series()
    print(f"\n  Time series: {len(daily)} days")
    print(f"  Date range: {daily['ds'].min().date()} to {daily['ds'].max().date()}")
    print(f"  Avg daily revenue: {daily['y'].mean():,.0f} DZD")

    # Check Islamic events coverage
    start_year = int(daily["ds"].min().year)
    end_year = int(daily["ds"].max().year)
    events = get_islamic_events(start_year, end_year + 1)
    event_counts = {}
    for e in events:
        event_counts[e["event"]] = event_counts.get(e["event"], 0) + 1
    print(f"\n  Islamic calendar events detected:")
    for etype, count in sorted(event_counts.items()):
        print(f"    {etype}: {count} days")

    # Test horizon
    test_days = 30
    train = daily.iloc[:-test_days].copy()
    test = daily.iloc[-test_days:].copy()
    print(f"\n  Train: {len(train)} days | Test: {test_days} days (out-of-sample)")
    print(f"  Test period: {test['ds'].min().date()} to {test['ds'].max().date()}")

    # Run benchmarks
    results = []
    models_to_test = [
        ("Moving Avg 7d", benchmark_moving_avg),
        ("Chronos-T5-Small", benchmark_chronos),
        ("Prophet + holidays", lambda tr, te: benchmark_prophet(tr, te, use_holidays=True)),
        ("NeuralProphet + events", lambda tr, te: benchmark_neuralprophet(tr, te, use_events=True)),
        ("LightGBM + lags + holidays", benchmark_lightgbm),
    ]

    print(f"\n{'='*70}")
    print(f"  {'Model':<35} {'MAE':>12} {'RMSE':>12} {'MAPE':>8} {'Time':>6}")
    print(f"  {'-'*35} {'-'*12} {'-'*12} {'-'*8} {'-'*6}")

    for name, bench_fn in models_to_test:
        logger.info(f"Testing {name}...")
        result = bench_fn(train, test)
        results.append(result)

        if "error" in result:
            print(f"  {result['model']:<35} ERROR: {result['error']}")
        else:
            print(
                f"  {result['model']:<35} "
                f"{result['mae']:>12,.0f} "
                f"{result['rmse']:>12,.0f} "
                f"{result['mape']:>7.1f}% "
                f"{result['time_sec']:>5.1f}s"
            )

    print(f"{'='*70}")

    # Sort by MAE
    valid = [r for r in results if "error" not in r]
    valid.sort(key=lambda x: x["mae"])

    if valid:
        best = valid[0]
        baseline = next((r for r in valid if "baseline" in r["model"].lower()), valid[-1])

        print(f"\n  BEST MODEL: {best['model']}")
        print(f"    MAE:  {best['mae']:>12,.0f} DZD")
        print(f"    RMSE: {best['rmse']:>12,.0f} DZD")
        print(f"    MAPE: {best['mape']:>7.1f}%")

        if baseline["mae"] > 0:
            improvement = (1 - best["mae"] / baseline["mae"]) * 100
            print(f"    vs baseline: {improvement:+.1f}% MAE improvement")

        # Show covariate-capable ranking
        covariate_models = [r for r in valid if r.get("supports_covariates")]
        if covariate_models:
            covariate_models.sort(key=lambda x: x["mae"])
            print(f"\n  BEST COVARIATE-CAPABLE MODEL: {covariate_models[0]['model']}")
            print(f"    MAE:  {covariate_models[0]['mae']:>12,.0f} DZD")

    # Save results
    output_path = MODEL_DIR / "benchmark_covariates.json"
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n  Results saved to: {output_path}")
    print("=" * 70)


if __name__ == "__main__":
    main()
