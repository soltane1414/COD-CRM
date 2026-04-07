import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional

from app.config import settings


class CustomerSegmenter:
    """K-Means based customer RFM segmentation."""

    SEGMENT_LABELS = {
        0: {"name": "VIP", "description": "High value, frequent, recent buyers"},
        1: {"name": "Loyal", "description": "Regular customers with good purchase history"},
        2: {"name": "At Risk", "description": "Previously active customers showing decline"},
        3: {"name": "Lost", "description": "Inactive customers with no recent purchases"},
    }

    def __init__(self):
        self.model = None
        self.scaler = None
        self._loaded = False
        self._segment_mapping = {}

    def load(self, model_path: Optional[Path] = None) -> bool:
        """Load trained segmentation model and scaler."""
        model_path = model_path or settings.MODEL_DIR / "segmenter.joblib"
        scaler_path = model_path.parent / "segmenter_scaler.joblib"
        mapping_path = model_path.parent / "segment_mapping.joblib"

        if not model_path.exists():
            return False

        self.model = joblib.load(model_path)
        if scaler_path.exists():
            self.scaler = joblib.load(scaler_path)
        if mapping_path.exists():
            self._segment_mapping = joblib.load(mapping_path)
        self._loaded = True
        return True

    def compute_rfm(self, orders_df: pd.DataFrame, reference_date=None) -> pd.DataFrame:
        """Compute RFM features from order data.

        Expected columns: customer_id, order_date, total_amount, is_delivered
        """
        if reference_date is None:
            reference_date = orders_df["order_date"].max() + pd.Timedelta(days=1)

        rfm = orders_df.groupby("customer_id").agg(
            recency=("order_date", lambda x: (reference_date - x.max()).days),
            frequency=("customer_id", "count"),
            monetary=("total_amount", "sum"),
            avg_order_value=("total_amount", "mean"),
            success_rate=("is_delivered", "mean"),
        ).reset_index()

        return rfm

    def segment(self, rfm_df: pd.DataFrame) -> pd.DataFrame:
        """Assign segments to customers based on RFM features."""
        if not self._loaded:
            raise RuntimeError("Model not loaded. Call load() first.")

        feature_cols = ["recency", "frequency", "monetary"]
        X = rfm_df[feature_cols].copy()

        if self.scaler:
            X_scaled = self.scaler.transform(X)
        else:
            X_scaled = X.values

        labels = self.model.predict(X_scaled)
        rfm_df = rfm_df.copy()
        rfm_df["cluster"] = labels

        # Map cluster numbers to meaningful labels
        if self._segment_mapping:
            rfm_df["segment"] = rfm_df["cluster"].map(
                lambda c: self._segment_mapping.get(c, self.SEGMENT_LABELS.get(c, {"name": f"Segment {c}"}))["name"]
            )
            rfm_df["segment_description"] = rfm_df["cluster"].map(
                lambda c: self._segment_mapping.get(c, self.SEGMENT_LABELS.get(c, {"description": ""}))["description"]
            )
        else:
            rfm_df["segment"] = rfm_df["cluster"].map(
                lambda c: self.SEGMENT_LABELS.get(c, {"name": f"Segment {c}"})["name"]
            )
            rfm_df["segment_description"] = rfm_df["cluster"].map(
                lambda c: self.SEGMENT_LABELS.get(c, {"description": ""})["description"]
            )

        return rfm_df

    def get_segment_summary(self, segmented_df: pd.DataFrame) -> list[dict]:
        """Return summary statistics per segment."""
        summary = []
        for segment_name in segmented_df["segment"].unique():
            seg = segmented_df[segmented_df["segment"] == segment_name]
            summary.append({
                "segment": segment_name,
                "count": int(len(seg)),
                "avg_recency": round(float(seg["recency"].mean()), 1),
                "avg_frequency": round(float(seg["frequency"].mean()), 1),
                "avg_monetary": round(float(seg["monetary"].mean()), 2),
                "avg_success_rate": round(float(seg["success_rate"].mean()), 3),
            })
        return sorted(summary, key=lambda x: x["avg_monetary"], reverse=True)
