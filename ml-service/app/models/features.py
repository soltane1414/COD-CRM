import pandas as pd
import numpy as np
from typing import Optional
from functools import lru_cache


# ── Algerian national holidays (fixed Gregorian dates) ──────────
ALGERIAN_NATIONAL_HOLIDAYS = [
    (1, 1),    # New Year's Day
    (1, 12),   # Yennayer (Berber New Year)
    (5, 1),    # Labour Day
    (7, 5),    # Independence Day
    (11, 1),   # Revolution Day
]


@lru_cache(maxsize=32)
def _get_islamic_off_days(year: int) -> frozenset:
    """Compute Islamic off-days (Eid al-Fitr 3d, Eid al-Adha 3d, Mawlid, Islamic New Year) for a Gregorian year."""
    off_days = set()
    try:
        from hijri_converter import Hijri
        hijri_year = year - 579
        for hy in [hijri_year, hijri_year + 1]:
            try:
                # Eid al-Fitr: 1-3 Shawwal (3 days)
                eid_fitr = Hijri(hy, 10, 1).to_gregorian()
                for d_off in range(3):
                    d = eid_fitr + pd.Timedelta(days=d_off)
                    if d.year == year:
                        off_days.add((d.month, d.day))

                # Eid al-Adha: 10-12 Dhul Hijjah (3 days)
                eid_adha = Hijri(hy, 12, 10).to_gregorian()
                for d_off in range(3):
                    d = eid_adha + pd.Timedelta(days=d_off)
                    if d.year == year:
                        off_days.add((d.month, d.day))

                # Mawlid: 12 Rabi al-Awal
                mawlid = Hijri(hy, 3, 12).to_gregorian()
                if mawlid.year == year:
                    off_days.add((mawlid.month, mawlid.day))

                # Islamic New Year: 1 Muharram
                islamic_ny = Hijri(hy, 1, 1).to_gregorian()
                if islamic_ny.year == year:
                    off_days.add((islamic_ny.month, islamic_ny.day))
            except (ValueError, OverflowError):
                continue
    except ImportError:
        pass
    return frozenset(off_days)


def is_algerian_off_day(dt) -> bool:
    """Check if a date is an Algerian off-day (weekend, national holiday, or Islamic holiday)."""
    dt = pd.Timestamp(dt)
    # Friday-Saturday weekend (Algeria)
    if dt.dayofweek >= 4:  # 4=Friday, 5=Saturday
        return True
    md = (dt.month, dt.day)
    # National holidays
    if md in ALGERIAN_NATIONAL_HOLIDAYS:
        return True
    # Islamic holidays
    if md in _get_islamic_off_days(dt.year):
        return True
    return False


class FeatureEngineer:
    """Transforms raw order data into ML-ready features.

    All features are available at prediction time (when a new order comes in)
    and do NOT leak the target variable (is_delivered).

    Enhanced feature set (25 features) includes:
    - Temporal: hour, day, month, weekend, day_of_month, quarter, algerian_holiday
    - Value: order_value, subtotal, shipping_cost, value_to_shipping_ratio
    - Items: n_items
    - Customer: is_repeat, order_count, avg_order_value
    - Product quality: avg_photos, avg_desc_length, avg_name_length, avg_volume,
                       avg_product_weight
    - Geography: region_order_volume, seller_customer_same_state, n_sellers
    - Category: category_avg_price, category_popularity
    - Delivery: estimated_delivery_days

    Payment features removed (Algeria uses COD only).
    """

    def __init__(self, historical_data: Optional[pd.DataFrame] = None):
        self._region_volume = {}
        self._category_avg_price = {}
        self._category_volume = {}
        self._default_region_volume = 0.5
        self._default_category_avg_price = 0.0
        self._default_category_volume = 0.5
        if historical_data is not None:
            self._compute_historical_stats(historical_data)

    def _compute_historical_stats(self, df: pd.DataFrame) -> None:
        """Pre-compute regional and category statistics (NO target leakage)."""
        if "customer_state" in df.columns:
            region_counts = df["customer_state"].value_counts()
            max_count = region_counts.max() if len(region_counts) > 0 else 1
            self._region_volume = (region_counts / max_count).to_dict()
            if self._region_volume:
                self._default_region_volume = float(np.mean(list(self._region_volume.values())))

        if "product_category" in df.columns:
            if "total_amount" in df.columns:
                self._category_avg_price = (
                    df.groupby("product_category")["total_amount"].mean().to_dict()
                )
                if self._category_avg_price:
                    self._default_category_avg_price = float(
                        np.mean(list(self._category_avg_price.values()))
                    )
            cat_counts = df["product_category"].value_counts()
            max_count = cat_counts.max() if len(cat_counts) > 0 else 1
            self._category_volume = (cat_counts / max_count).to_dict()
            if self._category_volume:
                self._default_category_volume = float(np.mean(list(self._category_volume.values())))

    def transform_order(self, order: dict) -> dict:
        """Transform a single order dict into feature dict for prediction."""
        features = {}

        # ── Temporal features ──
        if "order_date" in order and order["order_date"]:
            dt = pd.to_datetime(order["order_date"])
            features["hour_of_day"] = dt.hour
            features["day_of_week"] = dt.dayofweek
            features["month"] = dt.month
            features["is_weekend"] = int(is_algerian_off_day(dt))
            features["day_of_month"] = dt.day
            features["quarter"] = dt.quarter
        else:
            features["hour_of_day"] = 12
            features["day_of_week"] = 2
            features["month"] = 6
            features["is_weekend"] = 0
            features["day_of_month"] = 15
            features["quarter"] = 2

        # ── Value features ──
        order_value = float(order.get("total_amount", 0))
        subtotal = float(order.get("subtotal", 0))
        shipping_cost = float(order.get("shipping_cost", 0))
        features["order_value"] = order_value
        features["subtotal"] = subtotal
        features["shipping_cost"] = shipping_cost
        features["value_to_shipping_ratio"] = (
            order_value / shipping_cost if shipping_cost > 0 else 0.0
        )

        # ── Item features ──
        features["n_items"] = int(order.get("n_items", 1))

        # ── Customer features ──
        features["is_repeat_customer"] = int(order.get("is_repeat_customer", False))
        features["customer_order_count"] = int(order.get("customer_order_count", 0))
        count = max(features["customer_order_count"], 1)
        total_spent = float(order.get("customer_total_spent", order_value))
        features["customer_avg_order_value"] = total_spent / count

        # ── Product quality features (seller effort proxy) ──
        features["avg_photos"] = float(order.get("avg_photos", 1.0))
        features["avg_desc_length"] = float(order.get("avg_desc_length", 500.0))
        features["avg_name_length"] = float(order.get("avg_name_length", 30.0))
        features["avg_volume"] = float(order.get("avg_volume", 10000.0))
        features["avg_product_weight"] = float(order.get("avg_product_weight", 1.0))

        # ── Geography features ──
        customer_state = order.get("customer_state")
        wilaya_id = order.get("wilaya_id")
        if customer_state is not None and str(customer_state).strip() != "":
            region_key = str(customer_state).strip()
        elif wilaya_id is not None and str(wilaya_id).strip() != "":
            region_key = str(wilaya_id).strip()
        else:
            region_key = None

        if region_key is None:
            features["region_order_volume"] = self._default_region_volume
        else:
            features["region_order_volume"] = self._region_volume.get(
                region_key, self._default_region_volume
            )

        # If not provided by caller, default to same-state (neutral) to avoid false risk inflation.
        scss = order.get("seller_customer_same_state")
        features["seller_customer_same_state"] = int(scss) if scss is not None else 1
        features["n_sellers"] = int(order.get("n_sellers", 1))

        # ── Category features ──
        category_raw = order.get("product_category")
        category = str(category_raw).strip() if category_raw is not None else ""
        if category:
            features["category_avg_price"] = self._category_avg_price.get(
                category, self._default_category_avg_price
            )
            features["category_popularity"] = self._category_volume.get(
                category, self._default_category_volume
            )
        else:
            features["category_avg_price"] = self._default_category_avg_price
            features["category_popularity"] = self._default_category_volume

        # ── Delivery features ──
        features["estimated_delivery_days"] = float(
            order.get("estimated_delivery_days", 7)
        )

        return features

    def transform_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Transform a full DataFrame into feature matrix."""
        features_list = []
        for _, row in df.iterrows():
            features_list.append(self.transform_order(row.to_dict()))
        return pd.DataFrame(features_list)

    @staticmethod
    def get_feature_names() -> list:
        """Return ordered list of feature names used by the model."""
        return [
            # Temporal (6)
            "hour_of_day",
            "day_of_week",
            "month",
            "is_weekend",
            "day_of_month",
            "quarter",
            # Value (4)
            "order_value",
            "subtotal",
            "shipping_cost",
            "value_to_shipping_ratio",
            # Items (1)
            "n_items",
            # Customer (3)
            "is_repeat_customer",
            "customer_order_count",
            "customer_avg_order_value",
            # Product quality (5)
            "avg_photos",
            "avg_desc_length",
            "avg_name_length",
            "avg_volume",
            "avg_product_weight",
            # Geography (3)
            "region_order_volume",
            "seller_customer_same_state",
            "n_sellers",
            # Category (2)
            "category_avg_price",
            "category_popularity",
            # Delivery (1)
            "estimated_delivery_days",
        ]
