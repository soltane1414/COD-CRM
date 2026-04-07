"""
Data preparation script for the Olist Brazilian E-Commerce dataset.

Downloads and transforms Olist data into a format compatible with the COD-CRM schema.
Use this as a one-time data preparation step before training models.

Prerequisites:
1. Download the dataset from: https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce
2. Extract all CSV files into: ml-service/data/olist/

Usage:
    python -m data.prepare_data
    python -m data.prepare_data --data-dir ./data/olist --output-dir ./data/prepared
"""

import argparse
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Add parent to path so we can import mapping
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mapping import (
    STATE_TO_WILAYA,
    STATUS_MAPPING,
    CATEGORY_TRANSLATION,
    ZONE_SHIPPING_RATES,
    BRL_TO_DZD,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def load_olist_data(data_dir: Path) -> dict:
    """Load all Olist CSV files."""
    files = {
        "orders": "olist_orders_dataset.csv",
        "customers": "olist_customers_dataset.csv",
        "items": "olist_order_items_dataset.csv",
        "products": "olist_products_dataset.csv",
        "payments": "olist_order_payments_dataset.csv",
        "reviews": "olist_order_reviews_dataset.csv",
    }

    data = {}
    for key, filename in files.items():
        path = data_dir / filename
        if not path.exists():
            logger.error("File not found: %s", path)
            logger.error("Please download the Olist dataset from Kaggle and extract it to %s", data_dir)
            sys.exit(1)
        data[key] = pd.read_csv(path)
        logger.info("Loaded %s: %d rows x %d cols", filename, len(data[key]), len(data[key].columns))

    return data


def merge_datasets(data: dict) -> pd.DataFrame:
    """Merge all Olist tables into a single DataFrame."""
    # Start with orders
    df = data["orders"].copy()

    # Join customers
    df = df.merge(data["customers"], on="customer_id", how="left")

    # Aggregate items per order
    items_agg = data["items"].groupby("order_id").agg(
        n_items=("order_item_id", "count"),
        subtotal=("price", "sum"),
        total_freight=("freight_value", "sum"),
        avg_product_weight=("product_id", "count"),  # placeholder, will compute properly
    ).reset_index()

    # Get primary product category per order
    items_with_products = data["items"].merge(data["products"][["product_id", "product_category_name", "product_weight_g"]], on="product_id", how="left")
    primary_category = items_with_products.groupby("order_id").agg(
        product_category=("product_category_name", "first"),
        avg_product_weight=("product_weight_g", lambda x: x.mean() / 1000),  # convert g to kg
    ).reset_index()

    df = df.merge(items_agg[["order_id", "n_items", "subtotal", "total_freight"]], on="order_id", how="left")
    df = df.merge(primary_category, on="order_id", how="left")

    # Aggregate payments per order
    payments_agg = data["payments"].groupby("order_id").agg(
        total_payment=("payment_value", "sum"),
        payment_type=("payment_type", "first"),
    ).reset_index()
    df = df.merge(payments_agg, on="order_id", how="left")

    # Add review scores
    reviews_agg = data["reviews"].groupby("order_id").agg(
        review_score=("review_score", "mean"),
    ).reset_index()
    df = df.merge(reviews_agg, on="order_id", how="left")

    logger.info("Merged dataset: %d rows x %d cols", len(df), len(df.columns))
    return df


def transform_to_crm_format(df: pd.DataFrame) -> pd.DataFrame:
    """Transform merged Olist data into CRM-compatible format."""
    crm = pd.DataFrame()

    # ── Order fields ─────────────────────────────────────────
    crm["order_id"] = range(1, len(df) + 1)
    crm["store_id"] = 1  # Single store for demo
    crm["reference"] = df["order_id"].str[:10].str.upper()

    # Customer info (anonymized)
    crm["customer_id"] = df["customer_unique_id"]
    crm["customer_name"] = "Customer " + crm["order_id"].astype(str)
    crm["customer_phone"] = "05" + np.random.choice(["5", "6", "7"], size=len(df)) + np.char.zfill(np.random.randint(1000000, 9999999, size=len(df)).astype(str), 7)
    # 40% have alternative phone
    crm["customer_phone_2"] = np.where(
        np.random.random(len(df)) < 0.4,
        "06" + np.char.zfill(np.random.randint(1000000, 9999999, size=len(df)).astype(str), 7),
        None,
    )

    # ── Geographic mapping ───────────────────────────────────
    crm["customer_state"] = df["customer_state"]
    crm["wilaya_id"] = df["customer_state"].map(lambda s: STATE_TO_WILAYA.get(s, {"id": 16})["id"])
    crm["wilaya_name"] = df["customer_state"].map(lambda s: STATE_TO_WILAYA.get(s, {"name": "Alger"})["name"])
    crm["shipping_zone"] = df["customer_state"].map(lambda s: STATE_TO_WILAYA.get(s, {"zone": "zone_1"})["zone"])
    crm["commune"] = df["customer_city"]

    # ── Financial fields (converted BRL → DZD) ──────────────
    crm["subtotal"] = (df["subtotal"].fillna(0) * BRL_TO_DZD).round(2)
    crm["shipping_cost"] = crm["shipping_zone"].map(ZONE_SHIPPING_RATES).fillna(400)
    crm["discount"] = 0
    crm["total_amount"] = crm["subtotal"] + crm["shipping_cost"]

    # ── Status mapping ───────────────────────────────────────
    crm["status"] = df["order_status"].map(STATUS_MAPPING).fillna("new")
    crm["is_delivered"] = (crm["status"] == "delivered").astype(int)

    # ── Temporal fields ──────────────────────────────────────
    crm["order_date"] = pd.to_datetime(df["order_purchase_timestamp"])
    crm["confirmed_at"] = pd.to_datetime(df["order_approved_at"])
    crm["shipped_at"] = pd.to_datetime(df["order_delivered_carrier_date"])
    crm["delivered_at"] = pd.to_datetime(df["order_delivered_customer_date"])
    crm["estimated_delivery"] = pd.to_datetime(df["order_estimated_delivery_date"])
    crm["created_at"] = crm["order_date"]

    # Delivery delay in days
    crm["estimated_delivery_days"] = (crm["estimated_delivery"] - crm["order_date"]).dt.days.clip(lower=1)
    crm["actual_delivery_days"] = (crm["delivered_at"] - crm["order_date"]).dt.days

    # ── Product fields ───────────────────────────────────────
    crm["n_items"] = df["n_items"].fillna(1).astype(int)
    crm["product_category"] = df["product_category"].map(
        lambda c: CATEGORY_TRANSLATION.get(str(c), str(c)) if pd.notna(c) else "unknown"
    )
    crm["avg_product_weight"] = df["avg_product_weight"].fillna(1.0)

    # ── Customer history features ────────────────────────────
    crm["source"] = np.random.choice(["website", "facebook", "instagram", "manual"], size=len(df), p=[0.4, 0.3, 0.2, 0.1])
    crm["attempt_count"] = np.where(crm["is_delivered"] == 1, 1, np.random.choice([1, 2, 3], size=len(df), p=[0.5, 0.3, 0.2]))

    # Review score as satisfaction proxy
    crm["review_score"] = df["review_score"].fillna(3.0)

    # Compute customer history features
    crm = crm.sort_values("order_date")
    customer_stats = crm.groupby("customer_id").apply(
        lambda g: pd.Series({
            "customer_order_count": len(g),
            "customer_success_rate": g["is_delivered"].mean(),
        })
    ).reset_index()
    crm = crm.merge(customer_stats, on="customer_id", how="left")
    crm["is_repeat_customer"] = (crm["customer_order_count"] > 1).astype(int)

    # ── Temporal features for ML ─────────────────────────────
    crm["hour_of_day"] = crm["order_date"].dt.hour
    crm["day_of_week"] = crm["order_date"].dt.dayofweek
    crm["month"] = crm["order_date"].dt.month
    crm["is_weekend"] = (crm["day_of_week"] >= 5).astype(int)

    logger.info("CRM-format dataset: %d rows x %d cols", len(crm), len(crm.columns))
    logger.info("Delivery success rate: %.1f%%", crm["is_delivered"].mean() * 100)
    logger.info("Status distribution:\n%s", crm["status"].value_counts().to_string())

    return crm


def compute_regional_stats(crm: pd.DataFrame) -> pd.DataFrame:
    """Compute per-region delivery statistics."""
    stats = crm.groupby(["wilaya_id", "wilaya_name", "shipping_zone"]).agg(
        total_orders=("order_id", "count"),
        delivered=("is_delivered", "sum"),
        success_rate=("is_delivered", "mean"),
        avg_order_value=("total_amount", "mean"),
        avg_delivery_days=("actual_delivery_days", "mean"),
    ).reset_index()
    stats["success_rate"] = stats["success_rate"].round(3)
    stats["avg_order_value"] = stats["avg_order_value"].round(2)
    stats["avg_delivery_days"] = stats["avg_delivery_days"].round(1)
    return stats


def compute_category_stats(crm: pd.DataFrame) -> pd.DataFrame:
    """Compute per-category delivery statistics."""
    stats = crm.groupby("product_category").agg(
        total_orders=("order_id", "count"),
        delivered=("is_delivered", "sum"),
        success_rate=("is_delivered", "mean"),
        avg_order_value=("total_amount", "mean"),
    ).reset_index()
    stats["success_rate"] = stats["success_rate"].round(3)
    return stats.sort_values("total_orders", ascending=False)


def main():
    parser = argparse.ArgumentParser(description="Prepare Olist data for COD-CRM ML models")
    parser.add_argument("--data-dir", type=str, default=str(Path(__file__).parent / "olist"),
                        help="Directory containing Olist CSV files")
    parser.add_argument("--output-dir", type=str, default=str(Path(__file__).parent / "prepared"),
                        help="Output directory for prepared data")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load raw data
    logger.info("Loading Olist data from %s", data_dir)
    raw_data = load_olist_data(data_dir)

    # Merge tables
    logger.info("Merging datasets...")
    merged = merge_datasets(raw_data)

    # Transform to CRM format
    logger.info("Transforming to CRM format...")
    crm = transform_to_crm_format(merged)

    # Compute statistics
    region_stats = compute_regional_stats(crm)
    category_stats = compute_category_stats(crm)

    # Save outputs
    crm.to_csv(output_dir / "crm_orders.csv", index=False)
    region_stats.to_csv(output_dir / "region_stats.csv", index=False)
    category_stats.to_csv(output_dir / "category_stats.csv", index=False)

    logger.info("Saved prepared data to %s", output_dir)
    logger.info("Files created:")
    logger.info("  - crm_orders.csv (%d orders)", len(crm))
    logger.info("  - region_stats.csv (%d regions)", len(region_stats))
    logger.info("  - category_stats.csv (%d categories)", len(category_stats))

    # Print summary
    print("\n" + "=" * 60)
    print("DATA PREPARATION COMPLETE")
    print("=" * 60)
    print(f"Total orders:     {len(crm):,}")
    print(f"Unique customers: {crm['customer_id'].nunique():,}")
    print(f"Delivery rate:    {crm['is_delivered'].mean():.1%}")
    print(f"Wilayas covered:  {crm['wilaya_id'].nunique()}")
    print(f"Categories:       {crm['product_category'].nunique()}")
    print(f"Date range:       {crm['order_date'].min().date()} to {crm['order_date'].max().date()}")
    print()
    print("Regional success rates:")
    for _, row in region_stats.sort_values("success_rate").head(5).iterrows():
        print(f"  {row['wilaya_name']:20s} zone={row['shipping_zone']}  success={row['success_rate']:.1%}  orders={row['total_orders']}")
    print()
    print("Next steps:")
    print("  1. Open notebooks/01_eda.ipynb for exploratory analysis")
    print("  2. Train the risk model with notebooks/02_risk_model.ipynb")
    print("  3. Start the API: cd ml-service && uvicorn app.main:app --reload")
    print("=" * 60)


if __name__ == "__main__":
    main()
