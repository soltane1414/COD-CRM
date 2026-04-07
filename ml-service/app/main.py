import os

# Prevent OpenMP duplicate library crash on Windows/Anaconda
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.predict import router as predict_router
from app.routes.segment import router as segment_router
from app.routes.forecast import router as forecast_router
from app.routes.insights import router as insights_router
from app.routes.retrain import router as retrain_router

app = FastAPI(
    title="COD-CRM ML Service",
    description="AI-powered decision making for COD e-commerce CRM",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router, prefix="/api/predict", tags=["Prediction"])
app.include_router(segment_router, prefix="/api/segment", tags=["Segmentation"])
app.include_router(forecast_router, prefix="/api/forecast", tags=["Forecasting"])
app.include_router(insights_router, prefix="/api/insights", tags=["Insights"])
app.include_router(retrain_router, prefix="/api/retrain", tags=["Retraining"])


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "ml-service",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
