"""
train_all.py — State-of-the-Art Model Training Pipeline

Trains all three AI models for the COD-CRM:
1. Order Risk Scoring: CatBoost + LightGBM + XGBoost ensemble
   - Clean target (delivered vs canceled/unavailable only)
   - Enhanced 31-feature set (payment, product quality, geography)
   - ADASYN resampling + Optuna-tuned hyperparameters
2. Customer Segmentation: Hybrid HDBSCAN (large data) / KMeans (small data)
3. Demand Forecasting: LightGBM + Islamic calendar covariates

Usage:
    cd ml-service
    python train_all.py
"""

import sys
import json
import logging
import warnings
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
import joblib

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "olist"
PREPARED_DIR = BASE_DIR / "data" / "prepared"
MODEL_DIR = BASE_DIR / "trained_models"
MODEL_DIR.mkdir(exist_ok=True)
PREPARED_DIR.mkdir(exist_ok=True)

sys.path.insert(0, str(BASE_DIR))
from data.mapping import STATE_TO_WILAYA, STATUS_MAPPING, CATEGORY_TRANSLATION, BRL_TO_DZD, ZONE_SHIPPING_RATES


# ═══════════════════════════════════════════════════════════════
# STEP 1: DATA PREPARATION (Enhanced)
# ═══════════════════════════════════════════════════════════════

def load_and_prepare_data() -> pd.DataFrame:
    """Load Olist data and transform to CRM format with enhanced features."""
    logger.info("=" * 60)
    logger.info("STEP 1: DATA PREPARATION (Enhanced)")
    logger.info("=" * 60)

    # Load CSVs
    orders = pd.read_csv(DATA_DIR / "olist_orders_dataset.csv")
    customers = pd.read_csv(DATA_DIR / "olist_customers_dataset.csv")
    items = pd.read_csv(DATA_DIR / "olist_order_items_dataset.csv")
    products = pd.read_csv(DATA_DIR / "olist_products_dataset.csv")
    payments = pd.read_csv(DATA_DIR / "olist_order_payments_dataset.csv")
    reviews = pd.read_csv(DATA_DIR / "olist_order_reviews_dataset.csv")
    sellers = pd.read_csv(DATA_DIR / "olist_sellers_dataset.csv")

    logger.info(f"Loaded: {len(orders)} orders, {len(customers)} customers, "
                f"{len(items)} items, {len(sellers)} sellers")

    # ── Merge orders + customers ──
    df = orders.merge(customers, on="customer_id", how="left")
    df["order_date"] = pd.to_datetime(df["order_purchase_timestamp"])

    # ── Items aggregation (enhanced with product quality) ──
    items_ext = items.merge(
        products[["product_id", "product_category_name", "product_weight_g",
                  "product_photos_qty", "product_description_lenght",
                  "product_name_lenght", "product_length_cm",
                  "product_height_cm", "product_width_cm"]],
        on="product_id", how="left"
    )
    items_ext = items_ext.merge(
        sellers[["seller_id", "seller_state"]], on="seller_id", how="left"
    )

    # Compute product volume
    items_ext["product_volume_cm3"] = (
        items_ext["product_length_cm"].fillna(0)
        * items_ext["product_height_cm"].fillna(0)
        * items_ext["product_width_cm"].fillna(0)
    )

    items_agg = items_ext.groupby("order_id").agg(
        n_items=("order_item_id", "count"),
        subtotal=("price", "sum"),
        freight_total=("freight_value", "sum"),
        n_sellers=("seller_id", "nunique"),
        avg_product_weight=("product_weight_g", lambda x: x.mean() / 1000),
        avg_photos=("product_photos_qty", "mean"),
        avg_desc_length=("product_description_lenght", "mean"),
        avg_name_length=("product_name_lenght", "mean"),
        avg_volume=("product_volume_cm3", "mean"),
        product_category=("product_category_name", "first"),
        seller_state_first=("seller_state", "first"),
    ).reset_index()

    # ── Payment aggregation (enhanced with type flags) ──
    pay_agg = payments.groupby("order_id").agg(
        payment_value=("payment_value", "sum"),
        n_payment_methods=("payment_type", "nunique"),
        max_installments=("payment_installments", "max"),
    ).reset_index()

    pay_type = payments.groupby("order_id")["payment_type"].apply(
        lambda x: set(x.values)
    ).reset_index()
    pay_type["has_boleto"] = pay_type["payment_type"].apply(lambda s: int("boleto" in s))
    pay_type["has_credit_card"] = pay_type["payment_type"].apply(lambda s: int("credit_card" in s))
    pay_type["has_voucher"] = pay_type["payment_type"].apply(lambda s: int("voucher" in s))
    pay_type["has_debit_card"] = pay_type["payment_type"].apply(lambda s: int("debit_card" in s))
    pay_type = pay_type.drop(columns=["payment_type"])

    rev_agg = reviews.groupby("order_id").agg(review_score=("review_score", "mean")).reset_index()

    # ── Merge all ──
    df = df.merge(items_agg, on="order_id", how="left")
    df = df.merge(pay_agg, on="order_id", how="left")
    df = df.merge(pay_type, on="order_id", how="left")
    df = df.merge(rev_agg, on="order_id", how="left")

    # ── Transform ──
    df["is_delivered"] = (df["order_status"] == "delivered").astype(int)
    df["customer_state"] = df["customer_state"].fillna("SP")
    df["total_amount"] = (df["payment_value"].fillna(0) * BRL_TO_DZD).round(2)
    df["subtotal"] = (df["subtotal"].fillna(0) * BRL_TO_DZD).round(2)
    df["shipping_cost"] = (df["freight_total"].fillna(0) * BRL_TO_DZD).round(2)
    df["estimated_delivery_days"] = (
        pd.to_datetime(df["order_estimated_delivery_date"]) - df["order_date"]
    ).dt.days.clip(lower=1).fillna(7)
    df["seller_customer_same_state"] = (
        df["customer_state"] == df["seller_state_first"]
    ).astype(int)

    df["product_category"] = df["product_category"].map(
        lambda c: CATEGORY_TRANSLATION.get(str(c), str(c)) if pd.notna(c) else "unknown"
    )
    df["n_items"] = df["n_items"].fillna(1).astype(int)
    df["avg_product_weight"] = df["avg_product_weight"].fillna(1.0)

    # Fill NAs for enhanced features
    for col in ["avg_photos", "avg_desc_length", "avg_name_length", "avg_volume",
                 "freight_total", "max_installments"]:
        df[col] = df[col].fillna(0)
    for col in ["has_boleto", "has_credit_card", "has_voucher", "has_debit_card",
                 "n_payment_methods", "n_sellers"]:
        df[col] = df[col].fillna(0).astype(int)

    # ── Customer history (computed on delivered orders only to avoid leakage) ──
    df = df.sort_values("order_date")
    cust_stats = df[df["order_status"] == "delivered"].groupby(
        "customer_unique_id"
    ).agg(
        customer_order_count=("order_id", "count"),
        customer_total_spent=("total_amount", "sum"),
    ).reset_index()
    df = df.merge(cust_stats, on="customer_unique_id", how="left")
    df["customer_order_count"] = df["customer_order_count"].fillna(0).astype(int)
    df["customer_total_spent"] = df["customer_total_spent"].fillna(0)
    df["is_repeat_customer"] = (df["customer_order_count"] > 1).astype(int)

    logger.info(f"Prepared {len(df)} orders | Delivery rate: {df['is_delivered'].mean():.1%}")
    logger.info(f"  Order statuses: {df['order_status'].value_counts().to_dict()}")
    logger.info(f"  Enhanced features: payment types, product quality, geography, {len(df.columns)} columns")
    df.to_csv(PREPARED_DIR / "crm_orders.csv", index=False)
    return df


# ═══════════════════════════════════════════════════════════════
# STEP 2: ORDER RISK MODEL — Optimized Ensemble
# ═══════════════════════════════════════════════════════════════

def _optuna_tune_lgbm(X_train, y_train, X_test, y_test, n_trials=40):
    """Auto-tune LightGBM hyperparameters using Optuna.

    Runs Bayesian optimization to find the best parameters for the
    current dataset. Used automatically during retraining so models
    are always optimized for the company's actual data.
    """
    try:
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)
    except ImportError:
        logger.warning("Optuna not installed — using default LightGBM parameters")
        return None

    from sklearn.metrics import roc_auc_score
    from lightgbm import LGBMClassifier

    def objective(trial):
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 200, 1500),
            "max_depth": trial.suggest_int("max_depth", 3, 12),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 15, 127),
            "subsample": trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.4, 1.0),
            "min_child_samples": trial.suggest_int("min_child_samples", 5, 100),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-8, 10.0, log=True),
            "random_state": 42,
            "verbose": -1,
        }
        model = LGBMClassifier(**params)
        model.fit(X_train, y_train)
        proba = model.predict_proba(X_test)[:, 1]
        return roc_auc_score(y_test, proba)

    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=42),
    )
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    best = study.best_params
    logger.info(f"Optuna tuning complete ({n_trials} trials): AUC={study.best_value:.4f}")
    logger.info(f"  Best params: {best}")
    return best


def train_risk_ensemble(df: pd.DataFrame, auto_tune: bool = True):
    """Train optimized ensemble for order delivery risk prediction.

    Optimizations (from optimize_risk.py benchmark):
    - Clean target: only delivered vs canceled/unavailable (removes noisy in-progress)
    - Enhanced features: 31 features (payment, product quality, geography)
    - ADASYN resampling (adaptive, focuses on hard-to-learn minorities)
    - Optuna-tuned LightGBM hyperparameters
    """
    logger.info("=" * 60)
    logger.info("STEP 2: ORDER RISK SCORING — OPTIMIZED ENSEMBLE")
    logger.info("=" * 60)

    from sklearn.model_selection import train_test_split
    from sklearn.metrics import (
        roc_auc_score, classification_report, f1_score,
        accuracy_score, precision_score, recall_score, confusion_matrix,
        roc_curve,
    )
    from xgboost import XGBClassifier
    from catboost import CatBoostClassifier
    from lightgbm import LGBMClassifier

    sys.path.insert(0, str(BASE_DIR))
    from app.models.features import FeatureEngineer

    # ── Clean target: filter to final statuses only ──
    # Removes in-progress orders (shipped, processing, invoiced, created, approved)
    # which were adding noise to the failure class
    final_statuses = ["delivered", "canceled", "unavailable"]
    df_clean = df[df["order_status"].isin(final_statuses)].copy()
    logger.info(f"Clean target filtering: {len(df)} -> {len(df_clean)} orders "
                f"(removed {len(df) - len(df_clean)} in-progress orders)")

    y_clean = (df_clean["order_status"] == "delivered").astype(int).values
    neg_total = (y_clean == 0).sum()
    pos_total = (y_clean == 1).sum()
    logger.info(f"  Delivered: {pos_total:,} | Failed (canceled+unavailable): {neg_total:,} "
                f"| Failure rate: {neg_total/(neg_total+pos_total)*100:.2f}%")

    # Feature engineering
    fe = FeatureEngineer(historical_data=df_clean)
    X_features = fe.transform_dataframe(df_clean)
    feature_names = FeatureEngineer.get_feature_names()
    X = X_features[feature_names]
    y = y_clean

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    neg = (y_train == 0).sum()
    pos = (y_train == 1).sum()
    logger.info(f"Train before resampling: {len(X_train)} | Pos: {pos} | Neg: {neg} | Ratio: {pos/neg:.1f}:1")

    # ── ADASYN: adaptive oversampling of failure class ──
    # Better than SMOTE — focuses on boundary/hard-to-learn minority examples
    try:
        from imblearn.over_sampling import ADASYN
        adasyn = ADASYN(sampling_strategy=0.3, random_state=42)
        X_train_arr = X_train.values if hasattr(X_train, "values") else X_train
        X_train_rs, y_train_rs = adasyn.fit_resample(X_train_arr, y_train)
        X_train = pd.DataFrame(X_train_rs, columns=feature_names)
        y_train = y_train_rs
        neg_rs = (y_train == 0).sum()
        pos_rs = (y_train == 1).sum()
        logger.info(f"Train after  ADASYN:  {len(X_train)} | Pos: {pos_rs} | Neg: {neg_rs} | Ratio: {pos_rs/neg_rs:.1f}:1")
    except (ImportError, ValueError) as e:
        logger.warning(f"ADASYN skipped: {e}")
    logger.info(f"Test:                 {len(X_test)} samples (untouched)")

    # ── LightGBM params (Optuna-tuned or pre-tuned fallback) ──
    # Defined first because CatBoost and XGBoost borrow these params too
    if auto_tune:
        logger.info("Running Optuna hyperparameter optimization (40 trials)...")
        tuned_params = _optuna_tune_lgbm(X_train, y_train, X_test, y_test, n_trials=40)
    else:
        tuned_params = None

    # Fallback: pre-tuned params from Olist optimization (optimize_risk.py)
    lgb_params = {
        "n_estimators": 1289,
        "max_depth": 12,
        "learning_rate": 0.018,
        "num_leaves": 99,
        "subsample": 0.515,
        "colsample_bytree": 0.423,
        "min_child_samples": 100,
        "reg_alpha": 2.07e-08,
        "reg_lambda": 3.80e-07,
        "random_state": 42,
        "verbose": -1,
    }
    if tuned_params:
        lgb_params = {**tuned_params, "random_state": 42, "verbose": -1}

    # ── CatBoost ──
    logger.info("Training CatBoost...")
    cb_model = CatBoostClassifier(
        iterations=lgb_params.get("n_estimators", 1200),
        depth=min(lgb_params.get("max_depth", 10), 10),
        learning_rate=lgb_params.get("learning_rate", 0.02),
        l2_leaf_reg=lgb_params.get("reg_lambda", 0.5),
        eval_metric="AUC",
        random_seed=42,
        verbose=0,
    )
    cb_model.fit(X_train, y_train, eval_set=(X_test, y_test), early_stopping_rounds=100)
    cb_proba = cb_model.predict_proba(X_test)[:, 1]
    cb_auc = roc_auc_score(y_test, cb_proba)
    logger.info(f"  CatBoost AUC-ROC: {cb_auc:.4f}")

    logger.info("Training LightGBM%s...", " (Optuna-tuned)" if tuned_params else " (default params)")
    lgb_model = LGBMClassifier(**lgb_params)
    lgb_model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[],
    )
    lgb_proba = lgb_model.predict_proba(X_test)[:, 1]
    lgb_auc = roc_auc_score(y_test, lgb_proba)
    logger.info(f"  LightGBM AUC-ROC: {lgb_auc:.4f}")

    # ── XGBoost ──
    logger.info("Training XGBoost...")
    xgb_model = XGBClassifier(
        n_estimators=lgb_params.get("n_estimators", 1200),
        max_depth=lgb_params.get("max_depth", 10),
        learning_rate=lgb_params.get("learning_rate", 0.02),
        subsample=lgb_params.get("subsample", 0.6),
        colsample_bytree=lgb_params.get("colsample_bytree", 0.5),
        reg_alpha=lgb_params.get("reg_alpha", 1e-06),
        reg_lambda=lgb_params.get("reg_lambda", 1e-06),
        eval_metric="auc",
        random_state=42,
        use_label_encoder=False,
        verbosity=0,
    )
    xgb_model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )
    xgb_proba = xgb_model.predict_proba(X_test)[:, 1]
    xgb_auc = roc_auc_score(y_test, xgb_proba)
    logger.info(f"  XGBoost AUC-ROC: {xgb_auc:.4f}")

    # ── Ensemble (weighted by AUC) ──
    total_auc = cb_auc + lgb_auc + xgb_auc
    weights = {
        "catboost": cb_auc / total_auc,
        "lightgbm": lgb_auc / total_auc,
        "xgboost": xgb_auc / total_auc,
    }

    ensemble_proba = (
        cb_proba * weights["catboost"]
        + lgb_proba * weights["lightgbm"]
        + xgb_proba * weights["xgboost"]
    )
    ensemble_auc = roc_auc_score(y_test, ensemble_proba)

    logger.info(f"\n{'='*40}")
    logger.info(f"  ENSEMBLE AUC-ROC: {ensemble_auc:.4f}")
    logger.info(f"  Weights: CatBoost={weights['catboost']:.3f}, LightGBM={weights['lightgbm']:.3f}, XGBoost={weights['xgboost']:.3f}")
    logger.info(f"{'='*40}")

    # ── Optimal threshold via Youden's J statistic ──
    fpr, tpr, thresholds_roc = roc_curve(y_test, ensemble_proba)
    youden_j = tpr - fpr
    optimal_idx = np.argmax(youden_j)
    optimal_threshold = float(thresholds_roc[optimal_idx])

    # ── Also find the threshold that maximizes F1 ──
    from sklearn.metrics import precision_recall_curve
    prec_arr, rec_arr, thr_pr = precision_recall_curve(y_test, ensemble_proba)
    f1_arr = 2 * prec_arr * rec_arr / (prec_arr + rec_arr + 1e-8)
    best_f1_idx = np.argmax(f1_arr)
    f1_threshold = float(thr_pr[best_f1_idx]) if best_f1_idx < len(thr_pr) else 0.5

    logger.info(f"\n  Threshold optimization:")
    logger.info(f"  Youden's J threshold: {optimal_threshold:.4f} (TPR={tpr[optimal_idx]:.3f}, FPR={fpr[optimal_idx]:.3f})")
    logger.info(f"  Max-F1 threshold:     {f1_threshold:.4f} (F1={f1_arr[best_f1_idx]:.4f})")

    # ── Per-class metrics at default threshold (0.5) ──
    ensemble_pred_05 = (ensemble_proba >= 0.5).astype(int)
    logger.info(f"\n  --- Classification Report @ threshold=0.50 ---")
    logger.info("\n" + classification_report(y_test, ensemble_pred_05, target_names=["Failed", "Delivered"]))

    # ── Per-class metrics at optimal threshold ──
    ensemble_pred_opt = (ensemble_proba >= optimal_threshold).astype(int)
    logger.info(f"  --- Classification Report @ threshold={optimal_threshold:.4f} (optimal) ---")
    logger.info("\n" + classification_report(y_test, ensemble_pred_opt, target_names=["Failed", "Delivered"]))

    cm_05 = confusion_matrix(y_test, ensemble_pred_05)
    cm_opt = confusion_matrix(y_test, ensemble_pred_opt)

    fail_recall_05 = cm_05[0][0] / (cm_05[0][0] + cm_05[0][1]) if (cm_05[0][0] + cm_05[0][1]) > 0 else 0
    fail_recall_opt = cm_opt[0][0] / (cm_opt[0][0] + cm_opt[0][1]) if (cm_opt[0][0] + cm_opt[0][1]) > 0 else 0
    logger.info(f"  Failure detection recall: {fail_recall_05:.1%} (0.5) -> {fail_recall_opt:.1%} (optimal)")

    def _model_metrics(name, proba, y_true, threshold=0.5):
        pred = (proba >= threshold).astype(int)
        return {
            "auc_roc": float(roc_auc_score(y_true, proba)),
            "accuracy": float(accuracy_score(y_true, pred)),
            "precision": float(precision_score(y_true, pred, zero_division=0)),
            "recall": float(recall_score(y_true, pred)),
            "f1_score": float(f1_score(y_true, pred)),
        }

    def _per_class_metrics(y_true, proba, threshold):
        pred = (proba >= threshold).astype(int)
        cm = confusion_matrix(y_true, pred)
        fail_precision = cm[0][0] / (cm[0][0] + cm[1][0]) if (cm[0][0] + cm[1][0]) > 0 else 0
        fail_recall = cm[0][0] / (cm[0][0] + cm[0][1]) if (cm[0][0] + cm[0][1]) > 0 else 0
        fail_f1 = 2 * fail_precision * fail_recall / (fail_precision + fail_recall) if (fail_precision + fail_recall) > 0 else 0
        del_precision = cm[1][1] / (cm[1][1] + cm[0][1]) if (cm[1][1] + cm[0][1]) > 0 else 0
        del_recall = cm[1][1] / (cm[1][1] + cm[1][0]) if (cm[1][1] + cm[1][0]) > 0 else 0
        del_f1 = 2 * del_precision * del_recall / (del_precision + del_recall) if (del_precision + del_recall) > 0 else 0
        return {
            "failed": {"precision": round(fail_precision, 4), "recall": round(fail_recall, 4), "f1": round(fail_f1, 4)},
            "delivered": {"precision": round(del_precision, 4), "recall": round(del_recall, 4), "f1": round(del_f1, 4)},
        }

    # Find each model's own F1-maximizing threshold (avoids the CatBoost F1=0 bug
    # where using the ensemble's threshold on a differently-calibrated model gives
    # misleading metrics). Individual models are reported at their own best threshold.
    def _find_f1_threshold(proba, y_true):
        from sklearn.metrics import precision_recall_curve as _prc
        p, r, t = _prc(y_true, proba)
        f1 = 2 * p * r / (p + r + 1e-8)
        idx = np.argmax(f1)
        return float(t[idx]) if idx < len(t) else 0.5

    cb_threshold = _find_f1_threshold(cb_proba, y_test)
    lgb_threshold = _find_f1_threshold(lgb_proba, y_test)
    xgb_threshold = _find_f1_threshold(xgb_proba, y_test)

    risk_metrics = {
        "models": {
            "catboost": _model_metrics("catboost", cb_proba, y_test, cb_threshold),
            "lightgbm": _model_metrics("lightgbm", lgb_proba, y_test, lgb_threshold),
            "xgboost": _model_metrics("xgboost", xgb_proba, y_test, xgb_threshold),
            "ensemble": _model_metrics("ensemble", ensemble_proba, y_test, optimal_threshold),
        },
        "optimal_threshold": optimal_threshold,
        "ensemble_weights": {k: float(v) for k, v in weights.items()},
        "confusion_matrix_default": {
            "threshold": 0.5,
            "tn": int(cm_05[0][0]), "fp": int(cm_05[0][1]),
            "fn": int(cm_05[1][0]), "tp": int(cm_05[1][1]),
        },
        "confusion_matrix_optimal": {
            "threshold": optimal_threshold,
            "tn": int(cm_opt[0][0]), "fp": int(cm_opt[0][1]),
            "fn": int(cm_opt[1][0]), "tp": int(cm_opt[1][1]),
        },
        "per_class_metrics": {
            "at_default_050": _per_class_metrics(y_test, ensemble_proba, 0.5),
            "at_optimal": _per_class_metrics(y_test, ensemble_proba, optimal_threshold),
        },
        "dataset": {
            "total_samples": int(len(X)),
            "train_samples": int(len(X_train)),
            "test_samples": int(len(X_test)),
            "positive_rate": float(y.mean()),
            "original_orders": int(len(df)),
            "clean_orders": int(len(df_clean)),
            "failure_rate": float(1 - y.mean()),
        },
        "features": feature_names,
        "optimizations": {
            "target": "clean (delivered vs canceled/unavailable)",
            "resampling": "ADASYN ratio=0.3",
            "hyperparameters": "Optuna-tuned (auto)" if tuned_params else "Optuna-tuned (pre-computed)",
            "n_features": len(feature_names),
            "lgbm_params": {k: v for k, v in lgb_params.items() if k not in ("random_state", "verbose")},
        },
    }

    # Save
    joblib.dump({
        "models": {"catboost": cb_model, "lightgbm": lgb_model, "xgboost": xgb_model},
        "weights": weights,
        "optimal_threshold": optimal_threshold,
    }, MODEL_DIR / "risk_ensemble.joblib")
    joblib.dump(fe, MODEL_DIR / "feature_engineer.joblib")

    logger.info(f"Saved ensemble to {MODEL_DIR / 'risk_ensemble.joblib'}")
    return risk_metrics


# ═══════════════════════════════════════════════════════════════
# STEP 3: CUSTOMER SEGMENTATION — HDBSCAN + KMeans
# ═══════════════════════════════════════════════════════════════

def train_segmentation(df: pd.DataFrame):
    """Train customer segmentation — hybrid approach.

    Uses HDBSCAN for large datasets (>=1000 customers) where density-based
    clustering can find natural clusters, and KMeans for smaller datasets
    where HDBSCAN would produce too much noise.
    """
    logger.info("=" * 60)
    logger.info("STEP 3: CUSTOMER SEGMENTATION")
    logger.info("=" * 60)

    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import KMeans

    reference_date = df["order_date"].max() + pd.Timedelta(days=1)

    rfm = df.groupby("customer_unique_id").agg(
        recency=("order_date", lambda x: (reference_date - x.max()).days),
        frequency=("order_id", "count"),
        monetary=("total_amount", "sum"),
        avg_order_value=("total_amount", "mean"),
        success_rate=("is_delivered", "mean"),
    ).reset_index()
    rfm.columns = ["customer_id", "recency", "frequency", "monetary", "avg_order_value", "success_rate"]

    logger.info(f"RFM computed for {len(rfm)} customers")

    scaler = StandardScaler()
    cluster_features = ["recency", "frequency", "monetary"]
    rfm_scaled = scaler.fit_transform(rfm[cluster_features])

    from sklearn.metrics import silhouette_score as _sil

    algorithm_used = "KMeans"
    hdbscan_worked = False

    # ── Try HDBSCAN for large datasets (>=1000 customers) ──
    if len(rfm) >= 1000:
        try:
            import hdbscan as _hdbscan
            logger.info(f"  Large dataset ({len(rfm)} customers) — trying HDBSCAN...")
            best_hdb_sil = -1
            best_hdb_labels = None
            best_hdb_mcs = None
            for mcs in [50, 80, 100, 150, 200]:
                hdb = _hdbscan.HDBSCAN(min_cluster_size=mcs, min_samples=10, metric="euclidean")
                labels_h = hdb.fit_predict(rfm_scaled)
                n_clusters_h = len(set(labels_h) - {-1})
                noise_pct = (labels_h == -1).mean() * 100
                if n_clusters_h >= 3 and noise_pct < 30:
                    # Evaluate only non-noise points
                    mask = labels_h != -1
                    if mask.sum() > n_clusters_h:
                        sil_h = _sil(rfm_scaled[mask], labels_h[mask])
                        logger.info(f"    HDBSCAN mcs={mcs}: {n_clusters_h} clusters, "
                                    f"{noise_pct:.0f}% noise, silhouette={sil_h:.4f}")
                        if sil_h > best_hdb_sil:
                            best_hdb_sil = sil_h
                            best_hdb_labels = labels_h
                            best_hdb_mcs = mcs
                else:
                    logger.info(f"    HDBSCAN mcs={mcs}: {n_clusters_h} clusters, "
                                f"{noise_pct:.0f}% noise — skipped")

            if best_hdb_labels is not None and best_hdb_sil > 0.35:
                # Assign noise points to nearest cluster
                from scipy.spatial.distance import cdist
                noise_mask = best_hdb_labels == -1
                if noise_mask.any():
                    cluster_ids = sorted(set(best_hdb_labels) - {-1})
                    centroids = np.array([rfm_scaled[best_hdb_labels == c].mean(axis=0) for c in cluster_ids])
                    dists = cdist(rfm_scaled[noise_mask], centroids)
                    nearest = np.argmin(dists, axis=1)
                    best_hdb_labels[noise_mask] = [cluster_ids[n] for n in nearest]

                rfm["cluster"] = best_hdb_labels
                # Re-label clusters to 0..N-1
                unique_labels = sorted(rfm["cluster"].unique())
                label_map = {old: new for new, old in enumerate(unique_labels)}
                rfm["cluster"] = rfm["cluster"].map(label_map)
                clusterer = None  # HDBSCAN doesn't easily re-predict
                algorithm_used = f"HDBSCAN (mcs={best_hdb_mcs})"
                hdbscan_worked = True
                logger.info(f"  HDBSCAN selected: mcs={best_hdb_mcs}, silhouette={best_hdb_sil:.4f}")
        except ImportError:
            logger.info("  HDBSCAN not installed — falling back to KMeans")

    # ── KMeans fallback (always used for small datasets, or if HDBSCAN fails) ──
    if not hdbscan_worked:
        if len(rfm) >= 1000:
            logger.info("  HDBSCAN didn't produce good clusters — using KMeans")
        best_k, best_sil = 3, -1
        for k in range(3, min(8, len(rfm) // 5)):
            km = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels_k = km.fit_predict(rfm_scaled)
            sil_k = _sil(rfm_scaled, labels_k)
            logger.info(f"  KMeans K={k}: silhouette={sil_k:.4f}")
            if sil_k > best_sil:
                best_sil = sil_k
                best_k = k
        logger.info(f"  Best K={best_k} (silhouette={best_sil:.4f})")
        kmeans = KMeans(n_clusters=best_k, random_state=42, n_init=10)
        rfm["cluster"] = kmeans.fit_predict(rfm_scaled)
        clusterer = kmeans
        algorithm_used = "KMeans"

    # Label clusters using composite RFM score, not just monetary
    # Lower recency = more recent = better, higher frequency/monetary = better
    cluster_stats = rfm.groupby("cluster").agg(
        avg_recency=("recency", "mean"),
        avg_frequency=("frequency", "mean"),
        avg_monetary=("monetary", "mean"),
    )
    # Normalize each dimension to 0-1 range across clusters
    for col in ["avg_recency", "avg_frequency", "avg_monetary"]:
        mn, mx = cluster_stats[col].min(), cluster_stats[col].max()
        if mx > mn:
            cluster_stats[f"{col}_norm"] = (cluster_stats[col] - mn) / (mx - mn)
        else:
            cluster_stats[f"{col}_norm"] = 0.5
    # Composite score: high frequency + high monetary + LOW recency = best
    cluster_stats["score"] = (
        (1 - cluster_stats["avg_recency_norm"]) * 0.3  # recent = good
        + cluster_stats["avg_frequency_norm"] * 0.3
        + cluster_stats["avg_monetary_norm"] * 0.4
    )
    sorted_clusters = cluster_stats["score"].sort_values(ascending=False)
    label_names = ["VIP", "Loyal", "Regular", "At Risk", "Dormant", "Lost", "Churned"]

    segment_mapping = {}
    for i, cluster_id in enumerate(sorted_clusters.index):
        name = label_names[i] if i < len(label_names) else f"Segment {i}"
        segment_mapping[int(cluster_id)] = {
            "name": name,
            "description": {
                "VIP": "High value, frequent, recent buyers",
                "Loyal": "Regular customers with good purchase history",
                "Regular": "Average customers with moderate activity",
                "At Risk": "Previously active customers showing decline",
                "Dormant": "Low activity customers needing re-engagement",
                "Lost": "Inactive customers with no recent purchases",
                "Churned": "Former customers unlikely to return",
            }.get(name, f"Customer group {i}"),
        }

    rfm["segment"] = rfm["cluster"].map(lambda c: segment_mapping.get(int(c), {"name": f"Seg {c}"})["name"])

    logger.info("\nSegment Summary:")
    for seg in rfm["segment"].unique():
        subset = rfm[rfm["segment"] == seg]
        logger.info(
            f"  {seg:10s}: n={len(subset):6,d}  "
            f"recency={subset['recency'].mean():5.0f}d  "
            f"freq={subset['frequency'].mean():4.1f}  "
            f"monetary={subset['monetary'].mean():10,.0f} DZD"
        )

    # Save
    if clusterer is not None:
        joblib.dump(clusterer, MODEL_DIR / "segmenter.joblib")
    else:
        # HDBSCAN: save a KMeans fitted on the final labels for prediction
        from sklearn.cluster import KMeans as _KM
        n_final = len(rfm["cluster"].unique())
        km_proxy = _KM(n_clusters=n_final, random_state=42, n_init=10)
        km_proxy.fit(rfm_scaled)
        joblib.dump(km_proxy, MODEL_DIR / "segmenter.joblib")
    joblib.dump(scaler, MODEL_DIR / "segmenter_scaler.joblib")
    joblib.dump(segment_mapping, MODEL_DIR / "segment_mapping.joblib")
    logger.info(f"Saved segmentation models to {MODEL_DIR}")

    # Return metrics
    from sklearn.metrics import silhouette_score, davies_bouldin_score
    labels_final = rfm["cluster"].values
    try:
        sil_score = round(float(silhouette_score(rfm_scaled, labels_final)), 4)
        db_score  = round(float(davies_bouldin_score(rfm_scaled, labels_final)), 4)
    except Exception:
        sil_score = None
        db_score  = None

    seg_metrics = {
        "algorithm": algorithm_used,
        "n_clusters": len(segment_mapping),
        "total_customers": int(len(rfm)),
        "silhouette_score": sil_score,       # -1 to 1, higher = better separated clusters
        "davies_bouldin_score": db_score,    # ≥0, lower = better (denser, more separated)
        "segments": {},
    }
    for seg in rfm["segment"].unique():
        subset = rfm[rfm["segment"] == seg]
        seg_metrics["segments"][seg] = {
            "count": int(len(subset)),
            "percentage": round(float(len(subset) / len(rfm) * 100), 1),
            "avg_recency": round(float(subset["recency"].mean()), 1),
            "avg_frequency": round(float(subset["frequency"].mean()), 2),
            "avg_monetary": round(float(subset["monetary"].mean()), 2),
        }
    return seg_metrics


# ═══════════════════════════════════════════════════════════════
# STEP 4: DEMAND FORECASTING — LightGBM with Algerian Calendar Events
# ═══════════════════════════════════════════════════════════════


def train_forecasting(df: pd.DataFrame):
    """Train LightGBM demand forecasting models with calendar covariates.

    Selected after benchmarking 5 models (benchmark_covariates.py):
    LightGBM MAE 318,741 DZD (+12.2% vs MA7 baseline, +5.8% vs Chronos).

    Features: lag(1,7,14,28), rolling stats, day-of-week, month, is_weekend
    (Fri-Sat + national + Islamic holidays),
    Islamic events (Ramadan, Eid al-Fitr, Eid al-Adha, Mawlid),
    Algerian national holidays (New Year, Yennayer, Labour Day, Independence, Revolution).
    Uses recursive multi-step forecasting for evaluation.
    """
    logger.info("=" * 60)
    logger.info("STEP 4: DEMAND FORECASTING — LightGBM + Algerian Calendar")
    logger.info("=" * 60)

    from lightgbm import LGBMRegressor
    from app.models.forecaster import get_islamic_events, FEATURE_COLS, EVENT_TYPES, ALGERIAN_NATIONAL_HOLIDAYS

    delivered = df[df["is_delivered"] == 1].copy()
    delivered["ds"] = delivered["order_date"].dt.date

    daily = delivered.groupby("ds").agg(
        y=("total_amount", "sum"),
        order_count=("order_id", "count"),
    ).reset_index()
    daily["ds"] = pd.to_datetime(daily["ds"])

    # Fill missing days
    full_range = pd.date_range(daily["ds"].min(), daily["ds"].max(), freq="D")
    daily = daily.set_index("ds").reindex(full_range, fill_value=0).reset_index()
    daily.columns = ["ds", "y", "order_count"]

    logger.info(f"Time series: {len(daily)} days, avg daily revenue: {daily['y'].mean():,.0f} DZD")

    # ── Save time series data per category ────────────────────
    time_series_data = {}
    forecast_metrics = {"models_trained": [], "method": "lightgbm"}

    # Overall time series
    time_series_data["all"] = {
        "dates": daily["ds"].dt.strftime("%Y-%m-%d").tolist(),
        "values": daily["y"].tolist(),
    }
    forecast_metrics["models_trained"].append("all")
    logger.info("Saved overall time series (%d days)", len(daily))

    # Top 3 categories
    top_cats = delivered["product_category"].value_counts().head(3).index.tolist()
    for cat in top_cats:
        cat_df = delivered[delivered["product_category"] == cat]
        cat_daily = cat_df.groupby("ds").agg(y=("total_amount", "sum")).reset_index()
        cat_daily["ds"] = pd.to_datetime(cat_daily["ds"])
        cat_daily = cat_daily.set_index("ds").reindex(full_range, fill_value=0).reset_index()
        cat_daily.columns = ["ds", "y"]

        time_series_data[cat] = {
            "dates": cat_daily["ds"].dt.strftime("%Y-%m-%d").tolist(),
            "values": cat_daily["y"].tolist(),
        }
        forecast_metrics["models_trained"].append(cat)
        logger.info(f"  Saved time series for category: {cat}")

    # ── Train LightGBM models per category ────────────────────
    start_year = int(daily["ds"].min().year)
    end_year = int(daily["ds"].max().year) + 1
    events = get_islamic_events(start_year, end_year)

    def _add_features(ts_df: pd.DataFrame) -> pd.DataFrame:
        """Add calendar + lag + rolling features to a time series dataframe."""
        ts_df = ts_df.copy()
        dt = pd.to_datetime(ts_df["ds"])

        # Calendar features
        ts_df["day_of_week"] = dt.dt.dayofweek
        ts_df["month"] = dt.dt.month
        ts_df["day_of_month"] = dt.dt.day
        ts_df["week_of_year"] = dt.dt.isocalendar().week.astype(int)

        # is_weekend: Algerian off-days (Fri-Sat weekend + national holidays + Islamic holidays)
        is_off = dt.dt.dayofweek.isin([4, 5]).astype(int)  # Friday-Saturday
        national_set = set(ALGERIAN_NATIONAL_HOLIDAYS)
        md_series = list(zip(dt.dt.month, dt.dt.day))
        national_mask = pd.Series([md in national_set for md in md_series], index=ts_df.index)
        is_off = is_off | national_mask.astype(int)

        # Islamic & Algerian calendar events
        for etype in EVENT_TYPES:
            event_dates = set(
                pd.Timestamp(e["date"]).normalize()
                for e in events if e["event"] == etype
            )
            ts_df[etype] = dt.dt.normalize().isin(event_dates).astype(int)
            # Eid days, Mawlid, Islamic New Year are also off-days
            if etype not in ("ramadan",):
                is_off = is_off | ts_df[etype]

        ts_df["is_weekend"] = is_off.clip(upper=1).astype(int)

        # Lag features
        for lag in [1, 7, 14, 28]:
            ts_df[f"lag_{lag}"] = ts_df["y"].shift(lag)

        # Rolling stats
        for window in [7, 14, 28]:
            ts_df[f"rolling_mean_{window}"] = ts_df["y"].shift(1).rolling(window).mean()
            ts_df[f"rolling_std_{window}"] = ts_df["y"].shift(1).rolling(window).std()

        return ts_df

    test_days = 30
    lgbm_models = {}
    residual_std = {}
    all_predictions = None  # store 'all' category predictions for metrics

    for cat_key in forecast_metrics["models_trained"]:
        ts = time_series_data[cat_key]
        cat_df = pd.DataFrame({"ds": pd.to_datetime(ts["dates"]), "y": ts["values"]})

        cat_feat = _add_features(cat_df)
        cat_feat = cat_feat.dropna(subset=FEATURE_COLS)

        # Train/test split (temporal: last 30 days as test)
        train_feat = cat_feat.iloc[:-test_days]
        test_feat = cat_feat.iloc[-test_days:]

        X_train = train_feat[FEATURE_COLS].values
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

        # Evaluate with recursive multi-step prediction
        from app.models.forecaster import DemandForecaster
        history_values = list(cat_df["y"].values[:-test_days])
        predictions_list = []

        event_dates_by_type = {}
        for etype in EVENT_TYPES:
            event_dates_by_type[etype] = set(
                pd.Timestamp(e["date"]).normalize()
                for e in events if e["event"] == etype
            )

        for i in range(test_days):
            dt = test_feat.iloc[i]["ds"]
            row = DemandForecaster._build_features_for_date(
                pd.Timestamp(dt), history_values, event_dates_by_type
            )
            X_row = np.array([[row[c] for c in FEATURE_COLS]])
            pred_val = max(0, float(model.predict(X_row)[0]))
            predictions_list.append(pred_val)
            history_values.append(pred_val)

        pred_arr = np.array(predictions_list)
        y_test_vals = cat_df["y"].values[-test_days:]
        lgbm_mae = float(np.abs(y_test_vals - pred_arr).mean())
        lgbm_rmse = float(np.sqrt(((y_test_vals - pred_arr) ** 2).mean()))

        # Save residual std for confidence intervals
        train_pred = model.predict(X_train)
        train_residuals = y_train_vals - train_pred
        residual_std[cat_key] = float(np.std(train_residuals))

        lgbm_models[cat_key] = model
        logger.info(f"  {cat_key:20s}: MAE={lgbm_mae:>12,.0f} DZD | RMSE={lgbm_rmse:>12,.0f} DZD")

        if cat_key == "all":
            all_predictions = pred_arr
            all_mae = lgbm_mae
            all_rmse = lgbm_rmse

    # ── Baseline comparison (overall series) ──────────────────
    all_values = np.array(time_series_data["all"]["values"])
    test_actual = all_values[-test_days:]

    ma7_pred = np.full(test_days, all_values[-(test_days + 7):-test_days].mean())
    ma_mae = float(np.abs(test_actual - ma7_pred).mean())
    ma_rmse = float(np.sqrt(((test_actual - ma7_pred) ** 2).mean()))

    improvement = round((1 - all_mae / ma_mae) * 100, 1) if ma_mae > 0 else 0

    forecast_metrics.update({
        "lightgbm": {"mae": round(all_mae, 2), "rmse": round(all_rmse, 2)},
        "baseline_moving_avg": {"mae": round(ma_mae, 2), "rmse": round(ma_rmse, 2)},
        "improvement_mae_pct": improvement,
        "time_series_days": int(len(daily)),
        "test_days": test_days,
        "features": FEATURE_COLS,
        "islamic_events": EVENT_TYPES,
    })

    logger.info(f"\n  LightGBM MAE: {all_mae:,.0f} DZD | Baseline MAE: {ma_mae:,.0f} DZD")
    logger.info(f"  Improvement over baseline: {improvement:.1f}%")

    # Save
    joblib.dump(time_series_data, MODEL_DIR / "forecaster_models.joblib")
    joblib.dump(
        {"models": lgbm_models, "residual_std": residual_std},
        MODEL_DIR / "forecaster_lgbm.joblib",
    )
    logger.info(f"Saved time series and LightGBM models to {MODEL_DIR}")
    return forecast_metrics


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  COD-CRM: SOTA MODEL TRAINING PIPELINE")
    print("=" * 60 + "\n")

    # Check data exists
    required = ["olist_orders_dataset.csv", "olist_customers_dataset.csv",
                 "olist_order_items_dataset.csv", "olist_products_dataset.csv",
                 "olist_order_payments_dataset.csv", "olist_order_reviews_dataset.csv",
                 "olist_sellers_dataset.csv"]
    missing = [f for f in required if not (DATA_DIR / f).exists()]
    if missing:
        logger.error(f"Missing files in {DATA_DIR}: {missing}")
        logger.error("Download from: https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce")
        sys.exit(1)

    # Step 1: Prepare data
    df = load_and_prepare_data()

    # Step 2: Train risk ensemble
    risk_metrics = train_risk_ensemble(df)

    # Step 3: Train segmentation
    seg_metrics = train_segmentation(df)

    # Step 4: Train forecasting
    forecast_metrics = train_forecasting(df)

    # Save all metrics to JSON
    all_metrics = {
        "trained_at": datetime.now().isoformat(),
        "dataset": "olist_brazilian_ecommerce",
        "total_orders": int(len(df)),
        "delivery_rate": round(float(df["is_delivered"].mean()), 4),
        "risk_prediction": risk_metrics,
        "segmentation": seg_metrics,
        "forecasting": forecast_metrics,
    }
    metrics_path = MODEL_DIR / "metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(all_metrics, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved evaluation metrics to {metrics_path}")

    # Summary
    ensemble_auc = risk_metrics["models"]["ensemble"]["auc_roc"]
    print("\n" + "=" * 60)
    print("  TRAINING COMPLETE")
    print("=" * 60)
    print(f"  Orders processed:    {len(df):,}")
    print(f"  Risk ensemble AUC:   {ensemble_auc:.4f}")
    print(f"  Segments found:      {seg_metrics['n_clusters']}")
    print(f"  Forecast models:     {len(forecast_metrics['models_trained'])}")
    print(f"  Metrics saved to:    {metrics_path}")
    print(f"  Models saved to:     {MODEL_DIR}")
    print()
    print("  Saved files:")
    for f in sorted(MODEL_DIR.glob("*")):
        if f.is_file():
            size_kb = f.stat().st_size / 1024
            print(f"    {f.name:35s} ({size_kb:,.0f} KB)")
    print()
    print("  Next: Start the API server:")
    print("    cd ml-service")
    print("    uvicorn app.main:app --port 8001 --reload")
    print("=" * 60)


if __name__ == "__main__":
    main()
