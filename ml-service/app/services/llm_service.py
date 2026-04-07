import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

# Language-specific prompts
LANG_CONFIG = {
    "en": {
        "summary_prompt": "You are a business analyst for an Algerian COD (Cash-on-Delivery) e-commerce company. Generate a concise {period} business insights summary in English.",
        "risk_prompt": "Explain this order risk assessment in simple English for a store manager.",
        "recommendation_prompt": "Provide actionable business recommendations in English.",
    },
    "fr": {
        "summary_prompt": "Vous etes un analyste commercial pour une entreprise de e-commerce COD (paiement a la livraison) algerienne. Generez un resume concis des insights commerciaux de la {period} en francais.",
        "risk_prompt": "Expliquez cette evaluation de risque de commande en francais simple pour un gerant de magasin.",
        "recommendation_prompt": "Fournissez des recommandations commerciales exploitables en francais.",
    },
    "ar": {
        "summary_prompt": "انت محلل اعمال لشركة تجارة الكترونية جزائرية تعمل بنظام الدفع عند التسليم. قم بانشاء ملخص موجز لرؤى الاعمال لفترة {period} باللغة العربية.",
        "risk_prompt": "اشرح تقييم مخاطر هذا الطلب بالعربية البسيطة لمدير المتجر.",
        "recommendation_prompt": "قدم توصيات تجارية قابلة للتنفيذ باللغة العربية.",
    },
}

PERIOD_NAMES = {
    "en": {"day": "daily", "week": "weekly", "month": "monthly"},
    "fr": {"day": "journaliere", "week": "hebdomadaire", "month": "mensuelle"},
    "ar": {"day": "اليومية", "week": "الاسبوعية", "month": "الشهرية"},
}

GEMINI_MODEL = "gemini-2.5-flash"


class LLMService:
    """Google Gemini API integration for natural language insights."""

    def __init__(self):
        self.client = None
        self._initialized = False
        self._initialize()

    def _initialize(self):
        """Initialize the Gemini client using the new google-genai SDK."""
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not set. LLM insights will not be available.")
            return

        try:
            from google import genai
            self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
            self._initialized = True
            logger.info("Gemini LLM service initialized successfully (model: %s)", GEMINI_MODEL)
        except Exception as e:
            logger.error("Failed to initialize Gemini: %s", e)

    async def generate_summary(self, lang: str = "en", period: str = "week", analytics_data: Optional[dict] = None) -> dict:
        """Generate a business insights summary using Gemini."""
        if not self._initialized:
            return {
                "summary": "LLM service not available. Set GEMINI_API_KEY in .env file.",
                "lang": lang,
                "generated": False,
            }

        period_name = PERIOD_NAMES.get(lang, PERIOD_NAMES["en"]).get(period, period)
        system_prompt = LANG_CONFIG.get(lang, LANG_CONFIG["en"])["summary_prompt"].format(period=period_name)

        data_context = ""
        if analytics_data:
            data_context = f"\n\nHere is the current analytics data:\n{analytics_data}"

        prompt = f"""{system_prompt}

Based on the following context about a COD e-commerce business:{data_context}

Provide:
1. Key performance highlights
2. Areas of concern
3. Top 3 actionable recommendations

Keep the summary concise (200-300 words). Focus on actionable insights."""

        try:
            from google import genai
            response = self.client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            return {
                "summary": response.text,
                "lang": lang,
                "period": period,
                "generated": True,
            }
        except Exception as e:
            logger.error("Gemini summary generation failed: %s", e)
            return {
                "summary": f"Failed to generate summary: {str(e)}",
                "lang": lang,
                "generated": False,
            }

    async def explain_risk(self, score: float, reasons: list[str], lang: str = "en") -> dict:
        """Generate natural language explanation for an order risk score."""
        if not self._initialized:
            return {"explanation": "LLM service not available.", "generated": False}

        system_prompt = LANG_CONFIG.get(lang, LANG_CONFIG["en"])["risk_prompt"]
        reasons_text = "\n".join(f"- {r}" for r in reasons) if reasons else "No specific risk factors identified."

        prompt = f"""{system_prompt}

Order Risk Score: {score}/100 (higher = safer)
Risk Factors:
{reasons_text}

Provide a 2-3 sentence explanation that a non-technical store manager can understand. Include what action they should take."""

        try:
            from google import genai
            response = self.client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            return {
                "explanation": response.text,
                "score": score,
                "lang": lang,
                "generated": True,
            }
        except Exception as e:
            logger.error("Gemini risk explanation failed: %s", e)
            return {"explanation": f"Failed to generate explanation: {str(e)}", "generated": False}

    async def generate_recommendations(self, context: str, lang: str = "en") -> dict:
        """Generate business recommendations based on context."""
        if not self._initialized:
            return {"recommendations": "LLM service not available.", "generated": False}

        system_prompt = LANG_CONFIG.get(lang, LANG_CONFIG["en"])["recommendation_prompt"]

        prompt = f"""{system_prompt}

Business Context:
{context}

Provide 3-5 specific, actionable recommendations. For each recommendation:
1. What to do
2. Why it matters
3. Expected impact

Keep each recommendation concise (2-3 sentences)."""

        try:
            from google import genai
            response = self.client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            return {
                "recommendations": response.text,
                "lang": lang,
                "generated": True,
            }
        except Exception as e:
            logger.error("Gemini recommendations failed: %s", e)
            return {"recommendations": f"Failed to generate recommendations: {str(e)}", "generated": False}


# Singleton instance
llm_service = LLMService()
