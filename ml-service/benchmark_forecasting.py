"""
benchmark_forecasting.py — Comprehensive Time Series Model Benchmark

Tests multiple SOTA forecasting models on the COD-CRM daily revenue data
with PROPER out-of-sample evaluation (no data leakage).
"""
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import json
import time
import traceback
import warnings
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import joblib

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parent / "trained_models"


def load_time_series():
    """Load the daily revenue time series."""
    data = joblib.load(MODEL_DIR / "forecaster_models.joblib")
    ts = data["all"]
    values = np.array(ts["values"], dtype=np.float64)
    dates = pd.to_datetime(ts["dates"])
    logger.info(f"Loaded time series: {len(values)} days, mean={values.mean():,.0f} DZD")
    return values, dates


def compute_metrics(actual, predicted):
    """Compute MAE, RMSE, MAPE."""
    actual = np.asarray(actual, dtype=np.float64)
    predicted = np.asarray(predicted, dtype=np.float64)
    errors = actual - predicted
    mae = np.mean(np.abs(errors))
    rmse = np.sqrt(np.mean(errors ** 2))
    nonzero = np.abs(actual) > 1e-6
    if nonzero.sum() > 0:
        mape = np.mean(np.abs(errors[nonzero] / actual[nonzero])) * 100
    else:
        mape = 0.0
    return float(mae), float(rmse), float(mape)


def run_benchmark(values, dates, test_days):
    """Run all models for a given test horizon."""
    train_vals = values[:-test_days].copy()
    test_vals = values[-test_days:].copy()
    train_dates = dates[:-test_days].copy()
    test_dates = dates[-test_days:].copy()
    n_test = len(test_vals)

    results = []

    def record(name, predicted, elapsed):
        predicted = np.asarray(predicted, dtype=np.float64).flatten()
        mae, rmse, mape = compute_metrics(test_vals, predicted)
        results.append({
            "model": name, "horizon": test_days,
            "mae": round(mae, 2), "rmse": round(rmse, 2), "mape": round(mape, 2),
            "time_sec": round(elapsed, 2),
        })
        logger.info(f"  {name:32s} MAE={mae:>12,.0f}  RMSE={rmse:>12,.0f}  MAPE={mape:>6.1f}%  Time={elapsed:.1f}s")

    # ── 1. Naive (last value) ──
    try:
        t0 = time.time()
        pred = np.full(n_test, train_vals[-1])
        record("Naive (last value)", pred, time.time() - t0)
    except Exception as e:
        logger.error(f"  Naive FAILED: {e}")

    # ── 2. Seasonal Naive (7-day) ──
    try:
        t0 = time.time()
        last_week = train_vals[-7:]
        pred = np.tile(last_week, n_test // 7 + 1)[:n_test]
        record("Seasonal Naive (7d)", pred, time.time() - t0)
    except Exception as e:
        logger.error(f"  Seasonal Naive FAILED: {e}")

    # ── 3. Moving Average 7d ──
    try:
        t0 = time.time()
        pred = np.full(n_test, float(train_vals[-7:].mean()))
        record("Moving Avg (7d)", pred, time.time() - t0)
    except Exception as e:
        logger.error(f"  MA7 FAILED: {e}")

    # ── 4. Moving Average 30d ──
    try:
        t0 = time.time()
        pred = np.full(n_test, float(train_vals[-30:].mean()))
        record("Moving Avg (30d)", pred, time.time() - t0)
    except Exception as e:
        logger.error(f"  MA30 FAILED: {e}")

    # ── 5. Exponential Smoothing (Holt-Winters) ──
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        t0 = time.time()
        model = ExponentialSmoothing(
            train_vals, seasonal_periods=7, trend="add", seasonal="add",
            use_boxcox=False, initialization_method="estimated"
        ).fit(optimized=True)
        pred = model.forecast(n_test)
        pred = np.maximum(pred, 0)
        record("Holt-Winters (ETS)", pred, time.time() - t0)
    except Exception as e:
        logger.error(f"  ETS FAILED: {e}\n{traceback.format_exc()}")

    # ── 6. SARIMAX ──
    try:
        from statsmodels.tsa.statespace.sarimax import SARIMAX
        t0 = time.time()
        model = SARIMAX(train_vals, order=(1, 1, 1), seasonal_order=(1, 1, 1, 7),
                        enforce_stationarity=False, enforce_invertibility=False)
        result = model.fit(disp=False, maxiter=200)
        pred = result.forecast(n_test)
        pred = np.maximum(pred, 0)
        record("SARIMAX (1,1,1)(1,1,1,7)", pred, time.time() - t0)
    except Exception as e:
        logger.error(f"  SARIMAX FAILED: {e}")

    # ── 7. Prophet (properly out-of-sample) ──
    try:
        from prophet import Prophet
        t0 = time.time()
        df_train = pd.DataFrame({"ds": train_dates, "y": train_vals})
        m = Prophet(
            yearly_seasonality=True, weekly_seasonality=True,
            daily_seasonality=False, changepoint_prior_scale=0.05,
            seasonality_mode="multiplicative",
        )
        m.fit(df_train)
        future = pd.DataFrame({"ds": test_dates})
        forecast = m.predict(future)
        pred = np.maximum(forecast["yhat"].values, 0)
        record("Prophet", pred, time.time() - t0)
    except Exception as e:
        logger.error(f"  Prophet FAILED: {e}\n{traceback.format_exc()}")

    # ── 8. Chronos-T5-Small ──
    try:
        import torch
        from chronos import ChronosPipeline
        t0 = time.time()
        pipeline = ChronosPipeline.from_pretrained(
            "amazon/chronos-t5-small", device_map="cpu", torch_dtype=torch.float32
        )
        context = torch.tensor(train_vals, dtype=torch.float32).unsqueeze(0)
        f_tensor = pipeline.predict(context, prediction_length=n_test, num_samples=100)
        pred = torch.median(f_tensor.float(), dim=1).values.squeeze(0).numpy()
        pred = np.maximum(pred, 0)
        record("Chronos-T5-Small", pred, time.time() - t0)
    except Exception as e:
        logger.error(f"  Chronos FAILED: {e}\n{traceback.format_exc()}")

    return results


def main():
    values, dates = load_time_series()
    all_results = []

    for test_days in [14, 30, 60]:
        logger.info(f"\n{'='*60}")
        logger.info(f"  EVALUATION: {test_days}-DAY FORECAST HORIZON")
        logger.info(f"{'='*60}")
        results = run_benchmark(values, dates, test_days)
        all_results.extend(results)

    # Save
    out_path = MODEL_DIR / "benchmark_results.json"
    with open(out_path, "w") as f:
        json.dump(all_results, f, indent=2)
    logger.info(f"\nResults saved to {out_path}")

    # Print summary
    print(f"\n{'='*90}")
    print(f"  BENCHMARK RESULTS SUMMARY")
    print(f"{'='*90}")

    for horizon in [14, 30, 60]:
        hr = [r for r in all_results if r["horizon"] == horizon]
        if not hr:
            continue
        hr.sort(key=lambda x: x["mae"])
        baseline_mae = next((r["mae"] for r in hr if r["model"] == "Moving Avg (7d)"), hr[-1]["mae"])

        print(f"\n  {horizon}-Day Forecast Horizon:")
        print(f"  {'Model':32s} {'MAE (DZD)':>14s} {'RMSE (DZD)':>14s} {'MAPE':>8s} {'vs MA7':>10s} {'Time':>8s}")
        print(f"  {'-'*88}")
        for i, r in enumerate(hr):
            imp = round((1 - r["mae"] / baseline_mae) * 100, 1) if baseline_mae > 0 else 0
            marker = " <-- BEST" if i == 0 else ""
            print(
                f"  {r['model']:32s} {r['mae']:>14,.0f} {r['rmse']:>14,.0f} "
                f"{r['mape']:>7.1f}% {imp:>+9.1f}% {r['time_sec']:>7.1f}s{marker}"
            )

    # Overall winner
    r30 = [r for r in all_results if r["horizon"] == 30]
    if r30:
        best = min(r30, key=lambda x: x["mae"])
        print(f"\n  WINNER (30-day): {best['model']} — MAE = {best['mae']:,.0f} DZD")

    print(f"\n{'='*90}")


if __name__ == "__main__":
    main()
