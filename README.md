# COD-CRM — CRM Intelligent avec Module de Prediction ML

> **Projet de Stage** — Annee Universitaire 2025-2026
>
> Entreprise : **BAT PROJET ENGINEERING** | Encadre par **Dr. Khellat Souad**

A production-ready, multi-tenant CRM SaaS platform for Algerian COD (Cash-on-Delivery) e-commerce businesses, integrating an AI/ML module for risk prediction, customer segmentation, and demand forecasting.

---

## Team

| Name | Role |
|------|------|
| Rezaiguia Soltane Tadj Eddine | Data Science |
| Bellatreche Mohamed Amine | Data Science |
| Khelifi Ayyoub | Computer Science |
| Brahim Soheib | Artificial Intelligence |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), TypeScript, TailwindCSS |
| Backend | PHP 8.2+ (REST API, Clean Architecture) |
| ML Service | Python 3.10+, FastAPI, scikit-learn, XGBoost, CatBoost, LightGBM |
| Database | MySQL 8.0+ |
| Auth | JWT (Access + Refresh tokens) |
| LLM | Google Gemini 2.5 Flash (multilingual insights AR/FR/EN) |
| Architecture | Multi-tenant (single DB, `store_id` isolation) |

---

## Features

### CRM Core
- **Multi-store system** — each store has fully isolated data
- **RBAC** — Owner, Admin, Order Confirmator, Inventory Manager, Accountant, Delivery Manager
- **COD workflow** — order lifecycle optimized for Cash-on-Delivery
- **Wilaya-based analytics** — Algeria's 58 wilayas with delivery insights
- **Return rate tracking** — per-product, per-wilaya, per-delivery-partner
- **i18n** — Arabic, French, English with RTL support

### ML Module
- **Order Risk Prediction** — Optimized ensemble (CatBoost + LightGBM + XGBoost + ADASYN + Optuna) with 31 features. Olist dataset: AUC 0.9961, 98% failure recall. Adaptive: automatically re-optimizes with Optuna when retrained on company data.
- **Customer Segmentation** — Hybrid clustering: HDBSCAN for large datasets (>=1000 customers), KMeans with auto-K for smaller datasets. RFM analysis with composite scoring (recency + frequency + monetary).
- **Demand Forecasting** — LightGBM with 20 covariates including Algerian calendar events (Islamic: Ramadan, Eid al-Fitr, Eid al-Adha, Mawlid; National: New Year, Yennayer, Labour Day, Independence Day, Revolution Day)
- **AI Insights** — Google Gemini integration for multilingual business recommendations
- **Model Retraining** — Retrain from your database with one click, or upload a custom CSV. Automatic Optuna hyperparameter optimization (40 Bayesian trials), backup and rollback

---

## Project Structure

```
COD-CRM/
├── backend/                 # PHP REST API (Clean Architecture)
│   ├── config/              # App, DB, JWT, CORS configs
│   ├── database/
│   │   ├── migrations/      # 5 SQL migration files
│   │   └── seeders/         # Wilaya seeder (58 wilayas)
│   ├── public/              # Entry point (Apache)
│   ├── routes/api.php       # All API route definitions
│   └── src/
│       ├── Core/            # Router, Request, Response, DB, Middleware
│       └── Modules/         # Domain modules (12 modules)
│           ├── Auth/        # JWT authentication
│           ├── Order/       # Order management
│           ├── Product/     # Product catalog
│           ├── Inventory/   # Stock management
│           ├── Delivery/    # Delivery tracking
│           ├── Returns/     # Return management
│           ├── Analytics/   # Dashboard & analytics
│           ├── AIInsights/  # ML service bridge
│           ├── Store/       # Multi-store management
│           ├── User/        # User management
│           ├── Admin/       # Super admin panel
│           └── Storefront/  # Public storefront
│
├── ml-service/              # Python ML Microservice (FastAPI)
│   ├── app/
│   │   ├── main.py          # FastAPI entry point (15 endpoints)
│   │   ├── config.py        # Configuration
│   │   ├── models/          # ML model implementations
│   │   │   ├── predictor.py     # Risk prediction (ensemble)
│   │   │   ├── segmenter.py     # Customer segmentation (HDBSCAN/KMeans hybrid)
│   │   │   ├── forecaster.py    # Demand forecasting (LightGBM + Algerian calendar)
│   │   │   └── features.py      # Feature engineering (31 features, 8 categories)
│   │   ├── routes/          # API endpoints
│   │   │   ├── predict.py       # POST /api/predict/order-risk
│   │   │   ├── segment.py       # GET  /api/segment/customers
│   │   │   ├── forecast.py      # GET  /api/forecast/demand
│   │   │   ├── insights.py      # POST /api/insights/generate
│   │   │   └── retrain.py       # POST /api/retrain/upload-and-train
│   │   └── services/        # Business logic
│   │       ├── ml_service.py    # ML orchestration
│   │       ├── data_service.py  # Data loading
│   │       └── llm_service.py   # Gemini LLM integration
│   ├── data/
│   │   ├── olist/               # Olist Brazilian E-Commerce dataset
│   │   ├── prepared/            # Processed CRM data
│   │   ├── mapping.py           # Column mapping (Olist -> Algerian CRM)
│   │   └── prepare_data.py      # Data preprocessing pipeline
│   ├── trained_models/      # Serialized models (production-ready)
│   │   ├── risk_ensemble.joblib      # CatBoost+LightGBM+XGBoost
│   │   ├── segmenter.joblib         # HDBSCAN or KMeans model
│   │   ├── forecaster_models.joblib  # LightGBM forecasting (4 categories)
│   │   ├── forecaster_lgbm.joblib   # LightGBM + Algerian calendar covariates
│   │   ├── feature_engineer.joblib   # Feature pipeline
│   │   ├── segmenter_scaler.joblib   # StandardScaler
│   │   ├── segment_mapping.joblib    # Segment labels
│   │   └── metrics.json             # Evaluation metrics
│   ├── notebooks/           # Jupyter notebooks (EDA & experimentation)
│   │   ├── 01_eda.ipynb
│   │   ├── 02_risk_model.ipynb
│   │   ├── 03_segmentation.ipynb
│   │   └── 04_forecasting.ipynb
│   ├── train_all.py         # Master training script
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                # Next.js App (in development)
│
└── docs/                    # Documentation
    ├── rapport.tex           # LaTeX source (32 pages)
    ├── rapport.pdf           # Compiled report
    ├── presentation.pptx     # PowerPoint (15 slides)
    ├── create_pptx.py        # Presentation generator script
    └── diagrams/             # Architecture diagrams (Draw.io + PNG)
        ├── architecture_globale.drawio.png
        ├── schema_base_donnees.drawio.png
        ├── cycle_vie_commande.drawio.png
        ├── ai_integration.drawio.png
        └── ml_pipeline.drawio.png
```

---

## ML Model Performance

### Risk Prediction (Optimized Ensemble)

Trained on the Olist Brazilian E-Commerce dataset (97,712 orders, clean target: delivered vs canceled/unavailable only). 31 engineered features across 8 categories. ADASYN resampling + Optuna hyperparameter optimization (40-80 Bayesian trials).

**Olist dataset** (97K orders):

| Model | AUC-ROC | Accuracy | Precision | Recall | F1-Score |
|-------|---------|----------|-----------|--------|----------|
| CatBoost | 0.9957 | 99.97% | 99.97% | 100.00% | 99.99% |
| LightGBM | **0.9974** | 99.97% | 99.97% | 100.00% | 99.99% |
| XGBoost | 0.9967 | 99.96% | 99.97% | 99.99% | 99.98% |
| **Ensemble** | **0.9961** | **99.97%** | **99.97%** | **100.00%** | **99.99%** |

Individual models are evaluated at their own F1-maximizing thresholds. The ensemble uses Youden's J statistic for optimal failure detection.

**CRM database** (6K synthetic orders): Ensemble AUC 0.64, F1 0.74 — limited by synthetic data variance. With real company data (diverse orders, customers, regions), performance approaches the Olist benchmark.

### Customer Segmentation (Hybrid: HDBSCAN / KMeans)

Adaptive algorithm: HDBSCAN for large datasets (>=1000 customers) where density-based clustering finds natural groups, KMeans with auto-K selection for smaller datasets where HDBSCAN would produce excessive noise. Both use RFM (Recency, Frequency, Monetary) features with StandardScaler and composite scoring.

**Olist dataset** (96,096 customers — HDBSCAN):

| Segment | Customers | % | Avg Recency | Avg Frequency | Avg Monetary (DZD) |
|---------|-----------|---|-------------|---------------|-------------------|
| Regular | 88,994 | 92.6% | 286 days | 1.0 | 3,459 |
| VIP | 3,673 | 3.8% | 316 days | 1.0 | 26,365 |
| At Risk | 2,736 | 2.8% | 271 days | 2.0 | 7,682 |
| Lost | 441 | 0.5% | 701 days | 1.0 | 6,515 |
| Loyal | 252 | 0.3% | 247 days | 3.4 | 14,429 |

**CRM database** (400 customers — KMeans, K=3, Silhouette=0.485):

### Demand Forecasting (LightGBM + Algerian Calendar)

Benchmarked 5 covariate-aware models. LightGBM selected for best MAE and native covariate support.

| Model | MAE (DZD) | RMSE (DZD) | vs MA7 Baseline |
|-------|-----------|------------|-----------------|
| Moving Average (7d) | 363,075 | 466,570 | baseline |
| Prophet + Islamic holidays | 376,292 | 447,736 | -3.6% |
| Chronos-T5-Small (zero-shot) | 338,231 | 395,363 | +6.8% |
| **LightGBM + lags + holidays** | **318,741** | **416,501** | **+12.2%** |

**20 covariates**: Islamic events — Ramadan, Eid al-Fitr (3d), Eid al-Adha (3d), Mawlid (via `hijri-converter`); National holidays — New Year (Jan 1), Yennayer (Jan 12), Labour Day (May 1), Independence Day (Jul 5), Revolution Day (Nov 1); `is_weekend` = Fri-Sat + all holidays; day of week, month, lags (1/7/14/28), rolling statistics (mean/std at 7/14/28 days).

### Why Not Foundation Models (HuggingFace)?

Foundation models like TimesFM, Chronos-Large, MOIRAI, and Lag-Llama are designed for **zero-shot forecasting** — they don't accept covariates. Our competitive advantage is **Algerian calendar-aware forecasting** (Islamic + national holidays) for Algerian e-commerce, which requires a model that supports covariates. LightGBM is the right choice because:

- **Natively handles 20 covariates** (Islamic events + national holidays + calendar + lags)
- **Fast to retrain** when new data arrives (seconds vs hours for transformers)
- **Small dataset** (714 days) favors simpler models over deep learning
- **TFT** (the only deep learning model with covariates) needs thousands of time series to outperform LightGBM

---

## API Endpoints

### ML Service (FastAPI — port 8001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Service health check |
| POST | `/api/predict/order-risk` | Predict delivery risk for a single order |
| POST | `/api/predict/order-risk/batch` | Batch risk prediction |
| GET | `/api/predict/model-info` | Model metadata and features |
| GET | `/api/segment/customers` | Customer segmentation results |
| GET | `/api/segment/summary` | Segment summary statistics |
| GET | `/api/forecast/demand` | 30-day demand forecast |
| POST | `/api/insights/generate` | AI-generated business insights |
| POST | `/api/retrain/from-database` | Retrain all models from CRM database |
| POST | `/api/retrain/upload-and-train` | Upload CSV and retrain all models |
| GET | `/api/retrain/metrics` | View model evaluation metrics |
| GET | `/api/retrain/data-format` | Expected CSV column format |

### Backend API (PHP — port 8000)

| Group | Endpoints | Auth |
|-------|-----------|------|
| Auth | `/api/v1/auth/register`, `login`, `refresh`, `me`, `logout` | Public / JWT |
| Store | `/api/v1/store`, `/store/stats` | JWT + Tenant |
| Users | `/api/v1/users` (CRUD) | Owner/Admin |
| Orders | `/api/v1/orders` (CRUD + status) | Role-based |
| Products | `/api/v1/products` (CRUD) | Role-based |
| Inventory | `/api/v1/inventory` (adjust, history, alerts) | Role-based |
| Deliveries | `/api/v1/deliveries` (CRUD + status) | Role-based |
| Returns | `/api/v1/returns` (CRUD + status) | Role-based |
| Analytics | `/api/v1/analytics/dashboard`, `orders`, `wilayas`, `products`, `returns`, `revenue` | JWT |
| AI Insights | `/api/v1/ai/order-risk/{id}`, `segments`, `forecast`, `insights`, `recommendations`, `retrain` | Owner/Admin |
| Storefront | `/api/v1/storefront/{slug}`, `products`, `orders` | Public |
| Super Admin | `/api/v1/admin/login`, `me`, `stats`, `stores`, `users` | Super Admin |

---

## Getting Started

### Prerequisites

- Python 3.10+ (with pip)
- PHP 8.2+ with extensions: `pdo_mysql`, `mbstring`, `openssl`
- Composer 2+
- MySQL 8.0+
- Node.js 18+ (for frontend)

### 1. ML Service Setup

```bash
cd ml-service
pip install -r requirements.txt
cp .env.example .env          # Edit with your Gemini API key

# Train models (or use pre-trained defaults)
python train_all.py

# Start the service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

The ML service will be available at `http://localhost:8001` with interactive docs at `/docs`.

### 2. Backend Setup

```bash
cd backend
cp .env.example .env           # Edit with your DB credentials
composer install

# Run migrations
mysql -u root -p your_db < database/migrations/001_create_core_tables.sql
mysql -u root -p your_db < database/migrations/002_create_product_tables.sql
mysql -u root -p your_db < database/migrations/003_create_order_tables.sql
mysql -u root -p your_db < database/migrations/004_create_delivery_return_tables.sql
mysql -u root -p your_db < database/migrations/005_create_super_admin.sql

# Seed wilayas
mysql -u root -p your_db < database/seeders/001_seed_wilayas.sql

# Start PHP dev server
php -S localhost:8000 -t public
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local     # Set NEXT_PUBLIC_API_URL
npm run dev                    # http://localhost:3000
```

---

## Retraining with Your Own Data

The platform supports two methods for model retraining:

### Method 1: Retrain from Database (Recommended)

For companies using the CRM, retraining is a one-click operation. The PHP backend automatically extracts finalized orders (delivered, cancelled, returned) with all relevant joins, generates a CSV matching the ML pipeline format, and sends it to the ML service. Optuna automatically optimizes hyperparameters for your data.

```bash
# Via the PHP backend (requires authentication)
curl -X POST http://localhost:8000/api/v1/ai/retrain \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Or simply click "Retrain from Database" in the AI dashboard interface.

### Method 2: Upload Custom CSV

For custom datasets not in the CRM database:

### 1. Check expected CSV format:
```bash
curl http://localhost:8001/api/retrain/data-format
```

### 2. Upload and retrain:
```bash
curl -X POST http://localhost:8001/api/retrain/upload-and-train \
  -F "file=@your_orders.csv"
```

**Required CSV columns:**
| Column | Description |
|--------|-------------|
| `order_status` | Order outcome: delivered, canceled, returned |
| `order_purchase_timestamp` | Order date (ISO format) |
| `payment_value` | Total order amount (numeric) |
| `customer_unique_id` | Unique customer identifier |

**Optional columns** (improve accuracy): `customer_state`, `product_category_name`, `order_estimated_delivery_date`, `product_weight_g`, `payment_type` (credit_card/boleto/cod/debit_card/voucher), `payment_installments`, `product_photos_qty`, `product_description_lenght`, `product_name_lenght`, `product_length_cm`, `product_height_cm`, `product_width_cm`, `seller_state`

Minimum 100 orders recommended. During retraining, Optuna runs 40 Bayesian trials to optimize hyperparameters for your specific data.

---

## Documentation

| Document | Description |
|----------|-------------|
| `docs/rapport.pdf` | Full project report (32 pages, LaTeX) |
| `docs/presentation.pptx` | Presentation slides (15 slides) |
| `docs/diagrams/` | 5 architecture diagrams (Draw.io + PNG) |
| `ml-service/notebooks/` | 4 Jupyter notebooks (EDA, risk model, segmentation, forecasting) |

---

## Dataset

Trained on the [Olist Brazilian E-Commerce Dataset](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) (100K+ orders), mapped to an Algerian COD CRM schema:
- BRL to DZD currency conversion
- Brazilian states mapped to Algerian wilayas (3 shipping zones)
- Portuguese product categories translated
- Order statuses mapped to COD lifecycle (confirmed, shipped, delivered, returned, failed)

---

## License

Proprietary — All rights reserved.
