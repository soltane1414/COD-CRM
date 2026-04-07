import logging
from typing import Optional

from app.models.predictor import OrderRiskPredictor
from app.models.segmenter import CustomerSegmenter
from app.models.forecaster import DemandForecaster
from app.config import settings

logger = logging.getLogger(__name__)


class MLService:
    """Orchestrates all ML model operations."""

    def __init__(self):
        self.predictor = OrderRiskPredictor()
        self.segmenter = CustomerSegmenter()
        self.forecaster = DemandForecaster()
        self._segmentation_cache = None
        self._load_models()

    def _get_model_source_dir(self):
        """Return primary model dir, or backup dir when primary artifacts are missing."""
        model_dir = settings.MODEL_DIR
        backup_dir = model_dir / "backup"

        has_primary = (
            (model_dir / "risk_ensemble.joblib").exists()
            or (model_dir / "risk_model.joblib").exists()
        ) and (model_dir / "segmenter.joblib").exists() and (model_dir / "forecaster_models.joblib").exists()

        if has_primary:
            return model_dir

        has_backup = (
            (backup_dir / "risk_ensemble.joblib").exists()
            or (backup_dir / "risk_model.joblib").exists()
        ) and (backup_dir / "segmenter.joblib").exists() and (backup_dir / "forecaster_models.joblib").exists()

        if has_backup:
            logger.warning(
                "Primary model artifacts missing in %s; loading from backup directory %s",
                model_dir,
                backup_dir,
            )
            return backup_dir

        return model_dir

    def _load_models(self):
        """Attempt to load all trained models on startup."""
        model_source_dir = self._get_model_source_dir()

        if self.predictor.load(model_source_dir):
            logger.info("Risk prediction model loaded successfully")
        else:
            logger.warning(
                "Risk prediction model not found (looked for %s or %s)",
                model_source_dir / "risk_ensemble.joblib",
                model_source_dir / "risk_model.joblib",
            )

        if self.segmenter.load(model_source_dir / "segmenter.joblib"):
            logger.info("Customer segmentation model loaded successfully")
        else:
            logger.warning("Segmentation model not found at %s", model_source_dir / "segmenter.joblib")

        if self.forecaster.load(model_source_dir):
            logger.info("Demand forecasting models loaded successfully")
        else:
            logger.warning("Forecasting models not found at %s", model_source_dir / "forecaster_models.joblib")

    # ── Order Risk Prediction ────────────────────────────────

    def predict_order_risk(self, order_data: dict) -> dict:
        """Predict delivery risk for a single order."""
        if not self.predictor._loaded:
            raise RuntimeError(
                "Risk prediction model is not loaded. "
                "Train models first using train_all.py or the retrain endpoint."
            )
        return self.predictor.predict(order_data)

    def predict_batch_risk(self, orders: list[dict]) -> list[dict]:
        """Predict risk for multiple orders."""
        if not self.predictor._loaded:
            raise RuntimeError("Risk prediction model is not loaded.")
        return self.predictor.predict_batch(orders)

    # ── Customer Segmentation ────────────────────────────────

    def get_customer_segments(self) -> dict:
        """Get cached customer segmentation results."""
        if self._segmentation_cache is not None:
            return self._segmentation_cache

        if not self.segmenter._loaded:
            raise RuntimeError(
                "Segmentation model is not loaded. "
                "Train models first using train_all.py or the retrain endpoint."
            )
        raise RuntimeError("No segmentation data cached. Run segmentation first.")

    def get_segment_summary(self) -> list[dict]:
        """Get segment summary statistics."""
        segments = self.get_customer_segments()
        import pandas as pd
        df = pd.DataFrame(segments.get("customers", []))
        if df.empty:
            return []
        return self.segmenter.get_segment_summary(df)

    # ── Demand Forecasting ───────────────────────────────────

    def forecast_demand(self, category: str = "all", periods: int = 30) -> dict:
        """Generate demand forecast."""
        if not self.forecaster._loaded:
            raise RuntimeError(
                "Forecasting models are not loaded. "
                "Train models first using train_all.py or the retrain endpoint."
            )
        return self.forecaster.forecast(category=category, periods=periods)

    def get_forecast_categories(self) -> list[str]:
        """List categories with available forecasting models."""
        if not self.forecaster._loaded:
            raise RuntimeError("Forecasting models are not loaded.")
        return self.forecaster.get_available_categories()

    # ── Model Management ─────────────────────────────────────

    def reload_models(self):
        """Reload all models from disk."""
        self._load_models()
        self._segmentation_cache = None
        return {
            "predictor": self.predictor._loaded,
            "segmenter": self.segmenter._loaded,
            "forecaster": self.forecaster._loaded,
        }


# Singleton instance
ml_service = MLService()
