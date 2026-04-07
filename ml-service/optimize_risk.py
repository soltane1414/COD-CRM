"""optimize_risk.py — Systematic Risk Model AUC Optimization

Identifies and tests every lever to maximize AUC:

  Experiment 1: Target definition
    - A) Current: is_delivered (all non-delivered = failure)  → noisy
    - B) Clean: only delivered vs canceled/unavailable         → true failures

  Experiment 2: Feature engineering
    - A) Current 20 features (includes 3 noise features)
    - B) Clean 17 features (remove random phone, random source, zero discount)
    - C) Enhanced 28+ features (add payment type, product quality, freight, geography)

  Experiment 3: Resampling
    - SMOTE 0.2 | SMOTE 0.5 | BorderlineSMOTE | ADASYN | SMOTE-Tomek | None (class_weight)

  Experiment 4: Optuna hyperparameter tuning on best combination

Uses Stratified 5-Fold CV for reliable comparison.
"""

import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import json
import time
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import roc_auc_score, make_scorer
from lightgbm import LGBMClassifier

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "olist"
MODEL_DIR = BASE_DIR / "trained_models"

# BRL→DZD conversion (same as mapping.py)
BRL_TO_DZD = 26.5


# ═══════════════════════════════════════════════════════════════
# DATA LOADING & FEATURE ENGINEERING
# ═══════════════════════════════════════════════════════════════

def load_raw_data():
    """Load and merge all Olist tables with enhanced features."""
    orders = pd.read_csv(DATA_DIR / "olist_orders_dataset.csv")
    customers = pd.read_csv(DATA_DIR / "olist_customers_dataset.csv")
    items = pd.read_csv(DATA_DIR / "olist_order_items_dataset.csv")
    products = pd.read_csv(DATA_DIR / "olist_products_dataset.csv")
    payments = pd.read_csv(DATA_DIR / "olist_order_payments_dataset.csv")
    sellers = pd.read_csv(DATA_DIR / "olist_sellers_dataset.csv")

    print(f"Loaded: {len(orders)} orders")

    # ── Merge orders + customers ──
    df = orders.merge(customers, on="customer_id", how="left")
    df["order_date"] = pd.to_datetime(df["order_purchase_timestamp"])

    # ── Items aggregation (enhanced) ──
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
    ).reset_index()

    # Seller-customer same state
    items_state = items_ext.groupby("order_id").agg(
        seller_state_first=("seller_state", "first"),
    ).reset_index()

    # ── Payment aggregation ──
    pay_agg = payments.groupby("order_id").agg(
        payment_value=("payment_value", "sum"),
        n_payment_methods=("payment_type", "nunique"),
        max_installments=("payment_installments", "max"),
    ).reset_index()

    # Payment type flags (one-hot)
    pay_type = payments.groupby("order_id")["payment_type"].apply(
        lambda x: set(x.values)
    ).reset_index()
    pay_type["has_boleto"] = pay_type["payment_type"].apply(lambda s: int("boleto" in s))
    pay_type["has_credit_card"] = pay_type["payment_type"].apply(lambda s: int("credit_card" in s))
    pay_type["has_voucher"] = pay_type["payment_type"].apply(lambda s: int("voucher" in s))
    pay_type["has_debit_card"] = pay_type["payment_type"].apply(lambda s: int("debit_card" in s))
    pay_type = pay_type.drop(columns=["payment_type"])

    # ── Merge all ──
    df = df.merge(items_agg, on="order_id", how="left")
    df = df.merge(items_state, on="order_id", how="left")
    df = df.merge(pay_agg, on="order_id", how="left")
    df = df.merge(pay_type, on="order_id", how="left")

    # ── Derived columns ──
    df["total_amount"] = (df["payment_value"].fillna(0) * BRL_TO_DZD).round(2)
    df["subtotal"] = (df["subtotal"].fillna(0) * BRL_TO_DZD).round(2)
    df["freight_total"] = (df["freight_total"].fillna(0) * BRL_TO_DZD).round(2)
    df["estimated_delivery_days"] = (
        pd.to_datetime(df["order_estimated_delivery_date"]) - df["order_date"]
    ).dt.days.clip(lower=1).fillna(7)
    df["seller_customer_same_state"] = (
        df["customer_state"] == df["seller_state_first"]
    ).astype(int)

    # Customer history (computed on delivered orders only to avoid leakage)
    df_sorted = df.sort_values("order_date")
    cust_stats = df_sorted[df_sorted["order_status"] == "delivered"].groupby(
        "customer_unique_id"
    ).agg(
        customer_order_count=("order_id", "count"),
        customer_total_spent=("total_amount", "sum"),
    ).reset_index()
    df = df.merge(cust_stats, on="customer_unique_id", how="left")
    df["customer_order_count"] = df["customer_order_count"].fillna(0).astype(int)
    df["customer_total_spent"] = df["customer_total_spent"].fillna(0)
    df["is_repeat_customer"] = (df["customer_order_count"] > 1).astype(int)

    # Fill NAs
    for col in ["avg_photos", "avg_desc_length", "avg_name_length", "avg_volume",
                 "avg_product_weight", "n_items", "freight_total", "max_installments"]:
        df[col] = df[col].fillna(0)
    for col in ["has_boleto", "has_credit_card", "has_voucher", "has_debit_card",
                 "n_payment_methods", "n_sellers"]:
        df[col] = df[col].fillna(0).astype(int)

    print(f"Merged dataset: {len(df)} rows, {df.shape[1]} columns")
    return df


def build_features(df: pd.DataFrame, feature_set: str = "enhanced") -> tuple:
    """Build feature matrix and target vector.

    feature_set:
      'original'  — current 20 features (includes noise)
      'clean'     — remove noise features (phone, source, discount)
      'enhanced'  — add payment, product quality, freight, geography
    """
    dt = df["order_date"]

    # ── Base features (always included) ──
    features = pd.DataFrame()
    features["hour_of_day"] = dt.dt.hour
    features["day_of_week"] = dt.dt.dayofweek
    features["month"] = dt.dt.month
    features["is_weekend"] = (dt.dt.dayofweek >= 5).astype(int)
    features["order_value"] = df["total_amount"]
    features["subtotal"] = df["subtotal"]
    features["shipping_cost"] = df["freight_total"]
    features["value_to_shipping_ratio"] = (
        features["order_value"] / features["shipping_cost"].replace(0, 1)
    )
    features["n_items"] = df["n_items"]
    features["is_repeat_customer"] = df["is_repeat_customer"]
    features["customer_order_count"] = df["customer_order_count"]
    features["customer_avg_order_value"] = (
        df["customer_total_spent"] / df["customer_order_count"].replace(0, 1)
    )
    features["estimated_delivery_days"] = df["estimated_delivery_days"]
    features["avg_product_weight"] = df["avg_product_weight"]

    # Region & category popularity (volume-based, no target leakage)
    region_counts = df["customer_state"].value_counts(normalize=True)
    features["region_order_volume"] = df["customer_state"].map(region_counts).fillna(0)

    cat_counts = df["product_category"].value_counts(normalize=True)
    features["category_popularity"] = df["product_category"].map(cat_counts).fillna(0)

    cat_avg_price = df.groupby("product_category")["total_amount"].transform("mean")
    features["category_avg_price"] = cat_avg_price.fillna(0)

    if feature_set == "original":
        # Include noise features (as current production does)
        rng = np.random.RandomState(42)
        features["has_alt_phone"] = (rng.random(len(df)) < 0.4).astype(int)
        features["source_is_social"] = rng.choice([0, 1], size=len(df), p=[0.6, 0.4])
        features["discount"] = 0

    if feature_set == "enhanced":
        # ── Payment features (STRONG signal for COD-like risk) ──
        features["has_boleto"] = df["has_boleto"]     # bank slip ≈ COD
        features["has_credit_card"] = df["has_credit_card"]
        features["has_voucher"] = df["has_voucher"]
        features["has_debit_card"] = df["has_debit_card"]
        features["n_payment_methods"] = df["n_payment_methods"]
        features["max_installments"] = df["max_installments"]

        # ── Product quality features (seller effort proxy) ──
        features["avg_photos"] = df["avg_photos"]
        features["avg_desc_length"] = df["avg_desc_length"]
        features["avg_name_length"] = df["avg_name_length"]
        features["avg_volume"] = df["avg_volume"]

        # ── Geography ──
        features["seller_customer_same_state"] = df["seller_customer_same_state"]
        features["n_sellers"] = df["n_sellers"]

        # ── Enhanced temporal ──
        features["day_of_month"] = dt.dt.day
        features["quarter"] = dt.dt.quarter

    return features


def get_target(df: pd.DataFrame, target_type: str = "clean") -> tuple:
    """Build target vector and filter mask.

    target_type:
      'noisy'  — all non-delivered = failure (current, includes shipped/processing/etc)
      'clean'  — only delivered vs canceled/unavailable (true failures)
    """
    if target_type == "noisy":
        mask = pd.Series(True, index=df.index)
        y = (df["order_status"] == "delivered").astype(int)
    elif target_type == "clean":
        final_statuses = ["delivered", "canceled", "unavailable"]
        mask = df["order_status"].isin(final_statuses)
        y = (df.loc[mask, "order_status"] == "delivered").astype(int)
    else:
        raise ValueError(f"Unknown target_type: {target_type}")

    return y, mask


# ═══════════════════════════════════════════════════════════════
# EXPERIMENT RUNNER
# ═══════════════════════════════════════════════════════════════

def evaluate_config(X, y, resample_method="smote_02", n_splits=5, lgbm_params=None):
    """Evaluate a configuration using Stratified K-Fold CV.

    Returns mean AUC and std.
    """
    if lgbm_params is None:
        lgbm_params = {
            "n_estimators": 500,
            "max_depth": 8,
            "learning_rate": 0.05,
            "num_leaves": 63,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "random_state": 42,
            "verbose": -1,
        }

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    aucs = []

    for fold, (train_idx, test_idx) in enumerate(skf.split(X, y)):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx].values, y.iloc[test_idx].values

        # Resample training data
        X_train_rs, y_train_rs = apply_resampling(X_train, y_train, resample_method)

        # Train LightGBM
        params = lgbm_params.copy()
        if resample_method == "none_classweight":
            neg = (y_train == 0).sum()
            pos = (y_train == 1).sum()
            params["scale_pos_weight"] = pos / neg if neg > 0 else 1

        model = LGBMClassifier(**params)
        model.fit(X_train_rs, y_train_rs)
        proba = model.predict_proba(X_test)[:, 1]
        aucs.append(roc_auc_score(y_test, proba))

    return np.mean(aucs), np.std(aucs)


def apply_resampling(X_train, y_train, method):
    """Apply resampling to training data."""
    X_arr = X_train.values if hasattr(X_train, "values") else X_train
    feature_names = X_train.columns if hasattr(X_train, "columns") else None

    if method == "none" or method == "none_classweight":
        return X_train, y_train

    if method == "smote_02":
        from imblearn.over_sampling import SMOTE
        sm = SMOTE(sampling_strategy=0.2, random_state=42, k_neighbors=5)
    elif method == "smote_05":
        from imblearn.over_sampling import SMOTE
        sm = SMOTE(sampling_strategy=0.5, random_state=42, k_neighbors=5)
    elif method == "smote_10":
        from imblearn.over_sampling import SMOTE
        sm = SMOTE(sampling_strategy=1.0, random_state=42, k_neighbors=5)
    elif method == "borderline":
        from imblearn.over_sampling import BorderlineSMOTE
        sm = BorderlineSMOTE(sampling_strategy=0.3, random_state=42, kind="borderline-1")
    elif method == "adasyn":
        from imblearn.over_sampling import ADASYN
        sm = ADASYN(sampling_strategy=0.3, random_state=42)
    elif method == "smote_tomek":
        from imblearn.combine import SMOTETomek
        from imblearn.over_sampling import SMOTE
        sm = SMOTETomek(
            smote=SMOTE(sampling_strategy=0.3, random_state=42),
            random_state=42,
        )
    else:
        raise ValueError(f"Unknown resampling: {method}")

    X_rs, y_rs = sm.fit_resample(X_arr, y_train)
    if feature_names is not None:
        X_rs = pd.DataFrame(X_rs, columns=feature_names)
    return X_rs, y_rs


# ═══════════════════════════════════════════════════════════════
# OPTUNA HYPERPARAMETER OPTIMIZATION
# ═══════════════════════════════════════════════════════════════

def optuna_optimize(X, y, resample_method, n_trials=80):
    """Find optimal LightGBM hyperparameters using Optuna."""
    try:
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)
    except ImportError:
        print("  Optuna not installed. Installing...")
        import subprocess
        subprocess.check_call(["pip", "install", "optuna", "-q"])
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)

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

        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        aucs = []
        for train_idx, test_idx in skf.split(X, y):
            X_tr, X_te = X.iloc[train_idx], X.iloc[test_idx]
            y_tr, y_te = y.iloc[train_idx].values, y.iloc[test_idx].values
            X_tr_rs, y_tr_rs = apply_resampling(X_tr, y_tr, resample_method)

            model = LGBMClassifier(**params)
            model.fit(X_tr_rs, y_tr_rs)
            proba = model.predict_proba(X_te)[:, 1]
            aucs.append(roc_auc_score(y_te, proba))

        return np.mean(aucs)

    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=42))
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)

    print(f"  Best trial: AUC={study.best_value:.4f}")
    print(f"  Best params: {study.best_params}")
    return study.best_params, study.best_value


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    print("=" * 70)
    print("  RISK MODEL OPTIMIZATION — Systematic AUC Maximization")
    print("=" * 70)

    df = load_raw_data()
    results = []

    # ────────────────────────────────────────────────────────────
    # EXPERIMENT 1: Target definition × Feature set
    # ────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  EXPERIMENT 1: Target × Features (default SMOTE 0.2)")
    print("=" * 70)

    configs = [
        ("noisy",  "original",  "Current baseline (noisy target + original features)"),
        ("noisy",  "clean",     "Noisy target + clean features (no noise)"),
        ("noisy",  "enhanced",  "Noisy target + enhanced features"),
        ("clean",  "original",  "Clean target + original features"),
        ("clean",  "clean",     "Clean target + clean features"),
        ("clean",  "enhanced",  "Clean target + enhanced features"),
    ]

    for target_type, feat_set, desc in configs:
        y, mask = get_target(df, target_type)
        X = build_features(df, feat_set)
        if not mask.all():
            X = X.loc[mask].reset_index(drop=True)
            y = y.reset_index(drop=True)

        neg = (y == 0).sum()
        pos = (y == 1).sum()
        t0 = time.time()
        mean_auc, std_auc = evaluate_config(X, y, resample_method="smote_02")
        elapsed = time.time() - t0

        result = {
            "experiment": "target_features",
            "target": target_type,
            "features": feat_set,
            "n_features": X.shape[1],
            "n_samples": len(y),
            "failure_rate": f"{neg/(neg+pos)*100:.2f}%",
            "auc_mean": round(mean_auc, 4),
            "auc_std": round(std_auc, 4),
            "time_sec": round(elapsed, 1),
            "description": desc,
        }
        results.append(result)
        print(f"  AUC={mean_auc:.4f}±{std_auc:.4f} | {feat_set:10s} | target={target_type:5s} | "
              f"n={len(y):>6,} | fail={neg/(neg+pos)*100:.1f}% | {elapsed:.1f}s | {desc}")

    # Find best target+feature combo
    exp1_results = [r for r in results if r["experiment"] == "target_features"]
    best_exp1 = max(exp1_results, key=lambda r: r["auc_mean"])
    best_target = best_exp1["target"]
    best_feat = best_exp1["features"]
    print(f"\n  >> Best: target={best_target}, features={best_feat}, AUC={best_exp1['auc_mean']:.4f}")

    # Prepare data for remaining experiments
    y_best, mask_best = get_target(df, best_target)
    X_best = build_features(df, best_feat)
    if not mask_best.all():
        X_best = X_best.loc[mask_best].reset_index(drop=True)
        y_best = y_best.reset_index(drop=True)

    # ────────────────────────────────────────────────────────────
    # EXPERIMENT 2: Resampling methods
    # ────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print(f"  EXPERIMENT 2: Resampling (target={best_target}, features={best_feat})")
    print("=" * 70)

    resample_methods = [
        ("none", "No resampling"),
        ("none_classweight", "No resampling + class_weight"),
        ("smote_02", "SMOTE ratio=0.2"),
        ("smote_05", "SMOTE ratio=0.5"),
        ("smote_10", "SMOTE ratio=1.0 (balanced)"),
        ("borderline", "BorderlineSMOTE ratio=0.3"),
        ("adasyn", "ADASYN ratio=0.3"),
        ("smote_tomek", "SMOTE-Tomek ratio=0.3"),
    ]

    for method, desc in resample_methods:
        t0 = time.time()
        try:
            mean_auc, std_auc = evaluate_config(X_best, y_best, resample_method=method)
            elapsed = time.time() - t0
            result = {
                "experiment": "resampling",
                "method": method,
                "auc_mean": round(mean_auc, 4),
                "auc_std": round(std_auc, 4),
                "time_sec": round(elapsed, 1),
                "description": desc,
            }
            results.append(result)
            print(f"  AUC={mean_auc:.4f}±{std_auc:.4f} | {method:20s} | {elapsed:.1f}s | {desc}")
        except Exception as e:
            print(f"  FAILED | {method:20s} | {desc} | {e}")

    # Find best resampling
    exp2_results = [r for r in results if r["experiment"] == "resampling"]
    best_exp2 = max(exp2_results, key=lambda r: r["auc_mean"])
    best_resample = best_exp2["method"]
    print(f"\n  >> Best resampling: {best_resample}, AUC={best_exp2['auc_mean']:.4f}")

    # ────────────────────────────────────────────────────────────
    # EXPERIMENT 3: Optuna Hyperparameter Optimization
    # ────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print(f"  EXPERIMENT 3: Optuna ({best_target} + {best_feat} + {best_resample})")
    print("=" * 70)

    t0 = time.time()
    best_params, best_optuna_auc = optuna_optimize(
        X_best, y_best, resample_method=best_resample, n_trials=80
    )
    elapsed = time.time() - t0
    results.append({
        "experiment": "optuna",
        "auc_mean": round(best_optuna_auc, 4),
        "best_params": best_params,
        "time_sec": round(elapsed, 1),
    })

    # ────────────────────────────────────────────────────────────
    # EXPERIMENT 4: Full ensemble with best settings
    # ────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  EXPERIMENT 4: Full Ensemble (CatBoost + LightGBM + XGBoost)")
    print("=" * 70)

    from xgboost import XGBClassifier
    from catboost import CatBoostClassifier

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    ensemble_aucs = []
    lgb_aucs = []
    cb_aucs = []
    xgb_aucs = []

    lgbm_opt_params = {
        **best_params,
        "random_state": 42,
        "verbose": -1,
    }

    for fold, (train_idx, test_idx) in enumerate(skf.split(X_best, y_best)):
        X_tr, X_te = X_best.iloc[train_idx], X_best.iloc[test_idx]
        y_tr, y_te = y_best.iloc[train_idx].values, y_best.iloc[test_idx].values
        X_tr_rs, y_tr_rs = apply_resampling(X_tr, y_tr, best_resample)

        # LightGBM (optimized)
        lgb = LGBMClassifier(**lgbm_opt_params)
        lgb.fit(X_tr_rs, y_tr_rs)
        lgb_p = lgb.predict_proba(X_te)[:, 1]
        lgb_auc = roc_auc_score(y_te, lgb_p)
        lgb_aucs.append(lgb_auc)

        # CatBoost
        cb = CatBoostClassifier(
            iterations=best_params.get("n_estimators", 500),
            depth=min(best_params.get("max_depth", 8), 10),
            learning_rate=best_params.get("learning_rate", 0.05),
            l2_leaf_reg=best_params.get("reg_lambda", 3),
            eval_metric="AUC",
            random_seed=42,
            verbose=0,
        )
        cb.fit(X_tr_rs, y_tr_rs)
        cb_p = cb.predict_proba(X_te)[:, 1]
        cb_auc = roc_auc_score(y_te, cb_p)
        cb_aucs.append(cb_auc)

        # XGBoost
        xgb = XGBClassifier(
            n_estimators=best_params.get("n_estimators", 500),
            max_depth=best_params.get("max_depth", 8),
            learning_rate=best_params.get("learning_rate", 0.05),
            subsample=best_params.get("subsample", 0.8),
            colsample_bytree=best_params.get("colsample_bytree", 0.8),
            reg_alpha=best_params.get("reg_alpha", 0),
            reg_lambda=best_params.get("reg_lambda", 1),
            eval_metric="auc",
            random_state=42,
            use_label_encoder=False,
            verbosity=0,
        )
        xgb.fit(X_tr_rs, y_tr_rs)
        xgb_p = xgb.predict_proba(X_te)[:, 1]
        xgb_auc = roc_auc_score(y_te, xgb_p)
        xgb_aucs.append(xgb_auc)

        # Ensemble (weighted by AUC)
        total = lgb_auc + cb_auc + xgb_auc
        ens_p = (lgb_p * lgb_auc + cb_p * cb_auc + xgb_p * xgb_auc) / total
        ens_auc = roc_auc_score(y_te, ens_p)
        ensemble_aucs.append(ens_auc)

        print(f"  Fold {fold+1}: LGB={lgb_auc:.4f} CB={cb_auc:.4f} XGB={xgb_auc:.4f} ENS={ens_auc:.4f}")

    print(f"\n  CatBoost:  {np.mean(cb_aucs):.4f}±{np.std(cb_aucs):.4f}")
    print(f"  LightGBM:  {np.mean(lgb_aucs):.4f}±{np.std(lgb_aucs):.4f}")
    print(f"  XGBoost:   {np.mean(xgb_aucs):.4f}±{np.std(xgb_aucs):.4f}")
    print(f"  Ensemble:  {np.mean(ensemble_aucs):.4f}±{np.std(ensemble_aucs):.4f}")

    results.append({
        "experiment": "ensemble",
        "catboost_auc": round(np.mean(cb_aucs), 4),
        "lightgbm_auc": round(np.mean(lgb_aucs), 4),
        "xgboost_auc": round(np.mean(xgb_aucs), 4),
        "ensemble_auc": round(np.mean(ensemble_aucs), 4),
        "ensemble_std": round(np.std(ensemble_aucs), 4),
    })

    # ────────────────────────────────────────────────────────────
    # FEATURE IMPORTANCE
    # ────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  FEATURE IMPORTANCE (LightGBM, best config)")
    print("=" * 70)

    # Train on full data for feature importance
    X_full_rs, y_full_rs = apply_resampling(X_best, y_best.values, best_resample)
    lgb_full = LGBMClassifier(**lgbm_opt_params)
    lgb_full.fit(X_full_rs, y_full_rs)

    importance = pd.DataFrame({
        "feature": X_best.columns,
        "importance": lgb_full.feature_importances_,
    }).sort_values("importance", ascending=False)

    for _, row in importance.iterrows():
        bar = "#" * int(row["importance"] / importance["importance"].max() * 30)
        print(f"  {row['feature']:30s} {row['importance']:6.0f}  {bar}")

    # ────────────────────────────────────────────────────────────
    # SUMMARY
    # ────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  FINAL SUMMARY")
    print("=" * 70)

    baseline_auc = [r for r in results if r.get("description") == "Current baseline (noisy target + original features)"]
    baseline = baseline_auc[0]["auc_mean"] if baseline_auc else 0

    print(f"\n  Baseline AUC (current):        {baseline:.4f}")
    print(f"  Best single-model AUC:         {best_optuna_auc:.4f}")
    print(f"  Best ensemble AUC:             {np.mean(ensemble_aucs):.4f}")
    print(f"  Improvement:                   +{(np.mean(ensemble_aucs) - baseline)*100:.1f}% absolute AUC")
    print(f"\n  Best config:")
    print(f"    Target:       {best_target}")
    print(f"    Features:     {best_feat} ({X_best.shape[1]} features)")
    print(f"    Resampling:   {best_resample}")
    print(f"    Optuna params: {best_params}")

    # Save results
    out_path = MODEL_DIR / "optimization_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n  Results saved to {out_path}")
    print("=" * 70)

    return results


if __name__ == "__main__":
    main()
