from fastapi import APIRouter, HTTPException, Query

from app.services.ml_service import ml_service

router = APIRouter()


@router.get("/demand")
def forecast_demand(
    category: str = Query(default="all", description="Product category to forecast"),
    periods: int = Query(default=30, ge=1, le=90, description="Number of days to forecast"),
):
    """Get demand forecast for a product category."""
    try:
        result = ml_service.forecast_demand(category=category, periods=periods)
        return {"success": True, "data": result}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/categories")
def available_categories():
    """List product categories with available forecast models."""
    try:
        categories = ml_service.get_forecast_categories()
        return {"success": True, "data": {"categories": categories}}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
