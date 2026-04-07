from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.models.predictor import OrderRiskPredictor
from app.services.ml_service import ml_service

router = APIRouter()


class OrderRiskRequest(BaseModel):
    """Order data for risk prediction."""
    order_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    wilaya_id: Optional[int] = None
    customer_state: Optional[str] = None
    commune: Optional[str] = None
    subtotal: float = Field(0, ge=0)
    shipping_cost: float = Field(0, ge=0)
    total_amount: float = Field(0, ge=0)
    n_items: int = Field(1, ge=1)
    product_category: Optional[str] = None
    order_date: Optional[str] = None
    is_repeat_customer: bool = False
    customer_order_count: int = Field(0, ge=0)
    customer_total_spent: float = Field(0, ge=0)
    estimated_delivery_days: float = Field(7, ge=1)
    avg_product_weight: float = Field(1.0, ge=0)
    # Payment features
    payment_method: Optional[str] = None
    has_boleto: Optional[int] = Field(None, ge=0, le=1)
    has_credit_card: Optional[int] = Field(None, ge=0, le=1)
    has_voucher: Optional[int] = Field(None, ge=0, le=1)
    has_debit_card: Optional[int] = Field(None, ge=0, le=1)
    n_payment_methods: int = Field(1, ge=1)
    max_installments: int = Field(1, ge=1)
    # Product quality features
    avg_photos: float = Field(1.0, ge=0)
    avg_desc_length: float = Field(500.0, ge=0)
    avg_name_length: float = Field(30.0, ge=0)
    avg_volume: float = Field(10000.0, ge=0)
    # Geography features
    seller_customer_same_state: Optional[int] = Field(None, ge=0, le=1)
    n_sellers: int = Field(1, ge=1)


class BatchRiskRequest(BaseModel):
    orders: list[OrderRiskRequest]


@router.post("/order-risk")
def predict_order_risk(request: OrderRiskRequest):
    """Predict delivery risk for a single order."""
    try:
        result = ml_service.predict_order_risk(
            request.model_dump(exclude_unset=True, exclude_none=True)
        )
        return {"success": True, "data": result}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/order-risk/batch")
def predict_batch_risk(request: BatchRiskRequest):
    """Predict delivery risk for multiple orders."""
    try:
        results = ml_service.predict_batch_risk(
            [o.model_dump(exclude_unset=True, exclude_none=True) for o in request.orders]
        )
        return {"success": True, "data": results}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/model-info")
def model_info():
    """Get information about the loaded prediction model."""
    return {
        "success": True,
        "data": {
            "model_loaded": ml_service.predictor._loaded,
            "features": ml_service.predictor.feature_engineer.get_feature_names() if ml_service.predictor._loaded else [],
            "n_features": len(ml_service.predictor.feature_engineer.get_feature_names()) if ml_service.predictor._loaded else 0,
            "optimal_threshold": ml_service.predictor.optimal_threshold if ml_service.predictor._loaded else 0.5,
        },
    }
