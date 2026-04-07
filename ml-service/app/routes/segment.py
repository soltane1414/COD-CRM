from fastapi import APIRouter, HTTPException, Query

from app.services.ml_service import ml_service

router = APIRouter()


@router.get("/customers")
def get_customer_segments():
    """Get customer segmentation results."""
    try:
        result = ml_service.get_customer_segments()
        return {"success": True, "data": result}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/summary")
def get_segment_summary():
    """Get summary statistics per customer segment."""
    try:
        result = ml_service.get_segment_summary()
        return {"success": True, "data": result}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
