import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional

from app.models.features import FeatureEngineer
from app.config import settings


class OrderRiskPredictor:
    """Ensemble of CatBoost + LightGBM + XGBoost for delivery risk prediction.

    Uses a soft-voting ensemble of three SOTA gradient boosting models.
    Each model independently predicts delivery success probability,
    and the final score is the weighted average (weights set by validation AUC).
    """

    def __init__(self):
        self.models = {}
        self.weights = {}
        self.feature_engineer: Optional[FeatureEngineer] = None
        self.optimal_threshold: float = 0.5
        self._loaded = False

    def load(self, model_path: Optional[Path] = None) -> bool:
        """Load trained ensemble models and feature engineer from disk."""
        model_dir = model_path or settings.MODEL_DIR
        ensemble_path = model_dir / "risk_ensemble.joblib"
        fe_path = model_dir / "feature_engineer.joblib"

        if ensemble_path.exists():
            data = joblib.load(ensemble_path)
            self.models = data["models"]
            self.weights = data["weights"]
            self.optimal_threshold = data.get("optimal_threshold", 0.5)
        elif (model_dir / "risk_model.joblib").exists():
            self.models = {"single": joblib.load(model_dir / "risk_model.joblib")}
            self.weights = {"single": 1.0}
        else:
            return False

        if fe_path.exists():
            self.feature_engineer = joblib.load(fe_path)
        else:
            self.feature_engineer = FeatureEngineer()

        self._loaded = True
        return True

    def predict(self, order_data: dict) -> dict:
        """Predict delivery risk using ensemble voting."""
        if not self._loaded:
            raise RuntimeError("Model not loaded. Call load() first.")

        features = self.feature_engineer.transform_order(order_data)
        feature_names = FeatureEngineer.get_feature_names()
        X = pd.DataFrame([features])[feature_names]

        model_scores = {}
        weighted_sum = 0.0
        total_weight = 0.0

        for name, model in self.models.items():
            proba = model.predict_proba(X)[0]
            success_prob = float(proba[1]) if len(proba) > 1 else float(proba[0])
            model_scores[name] = round(success_prob * 100, 1)
            weight = self.weights.get(name, 1.0 / len(self.models))
            weighted_sum += success_prob * weight
            total_weight += weight

        ensemble_prob = weighted_sum / total_weight if total_weight > 0 else 0.5
        score = round(ensemble_prob * 100, 1)

        category = self._get_category(score)
        reasons = self._get_risk_reasons(features, score, order_data)
        recommendation = self._get_recommendation(category)

        return {
            "score": score,
            "category": category,
            "success_probability": round(ensemble_prob, 4),
            "reasons": reasons,
            "recommendation": recommendation,
            "model_scores": model_scores,
        }

    def predict_batch(self, orders: list[dict]) -> list[dict]:
        return [self.predict(order) for order in orders]

    def _get_category(self, score: float) -> str:
        """Map success probability score to risk category using optimal threshold."""
        t = self.optimal_threshold * 100
        if score < t * 0.5:
            return "critical"
        elif score < t * 0.85:
            return "high"
        elif score < t:
            return "medium"
        else:
            return "low"

    def _get_risk_reasons(self, features: dict, score: float, order_data: Optional[dict] = None) -> list[str]:
        def _has_value(v) -> bool:
            return v is not None and str(v).strip() != ""

        order_data = order_data or {}
        has_region_input = _has_value(order_data.get("customer_state")) or _has_value(
            order_data.get("wilaya_id")
        )
        has_cross_region_input = "seller_customer_same_state" in order_data and _has_value(
            order_data.get("seller_customer_same_state")
        )
        has_category_input = _has_value(order_data.get("product_category"))

        reasons = []
        # Customer history
        if features.get("customer_order_count", 0) == 0:
            reasons.append("First-time customer (no order history)")
        # Order value
        if features.get("order_value", 0) > 10000:
            reasons.append("High order value increases risk")
        if features.get("value_to_shipping_ratio", 0) < 2:
            reasons.append("Low value-to-shipping ratio")
        # Geography
        if has_region_input and features.get("region_order_volume", 1) < 0.1:
            reasons.append("Low-volume region (less delivery infrastructure)")
        if has_cross_region_input and not features.get("seller_customer_same_state", 0):
            reasons.append("Cross-region delivery")
        # Product
        if has_category_input and features.get("category_popularity", 1) < 0.05:
            reasons.append("Niche product category (higher uncertainty)")
        if features.get("avg_photos", 1) < 1:
            reasons.append("Low product listing quality (few photos)")
        # Temporal
        if features.get("is_weekend", 0):
            reasons.append("Weekend order (lower confirmation rates)")
        # Delivery
        if features.get("estimated_delivery_days", 0) > 10:
            reasons.append("Long estimated delivery time")
        return reasons

    def _get_recommendation(self, category: str) -> str:
        recommendations = {
            "critical": "URGENT: Verify customer by phone before processing. Confirm shipping address and customer availability.",
            "high": "Priority confirmation call recommended. Verify shipping address and customer availability.",
            "medium": "Standard processing. Monitor delivery status closely.",
            "low": "Low risk order. Proceed with standard workflow.",
        }
        return recommendations.get(category, "Standard processing.")
