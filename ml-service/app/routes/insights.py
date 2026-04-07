from fastapi import APIRouter, HTTPException, Query

from app.services.llm_service import llm_service

router = APIRouter()


@router.get("/summary")
async def get_insights_summary(
    lang: str = Query(default="en", pattern="^(en|fr|ar)$", description="Language: en, fr, ar"),
    period: str = Query(default="week", description="Period: day, week, month"),
):
    """Get AI-generated business insights summary."""
    try:
        result = await llm_service.generate_summary(lang=lang, period=period)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Insight generation failed: {str(e)}")


@router.get("/order-explanation")
async def explain_order_risk(
    score: float = Query(..., description="Risk score (0-100)"),
    reasons: str = Query(default="", description="Comma-separated risk reasons"),
    lang: str = Query(default="en", pattern="^(en|fr|ar)$"),
):
    """Get natural language explanation of an order's risk score."""
    try:
        reason_list = [r.strip() for r in reasons.split(",") if r.strip()]
        result = await llm_service.explain_risk(score=score, reasons=reason_list, lang=lang)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Explanation generation failed: {str(e)}")


@router.get("/recommendations")
async def get_recommendations(
    context: str = Query(..., description="Business context for recommendations"),
    lang: str = Query(default="en", pattern="^(en|fr|ar)$"),
):
    """Get AI-powered business recommendations."""
    try:
        result = await llm_service.generate_recommendations(context=context, lang=lang)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Recommendation generation failed: {str(e)}")
