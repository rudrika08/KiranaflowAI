"""
Natural Language Generation — LLM-based explanations.
Uses Google Gemini API to generate dynamic, expert store analyses.
"""
import logging
import json
from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize the model configuration
generation_config = {
  "temperature": 0.2,
  "top_p": 0.95,
  "top_k": 64,
  "max_output_tokens": 1024,
  "response_mime_type": "text/plain",
}

# Try the first available model in order. Accounts/projects can differ in model availability.
GEMINI_MODEL_CANDIDATES = [
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-1.5-pro-latest",
        "gemini-1.5-pro",
        "gemini-2.0-flash",
]

SYSTEM_PROMPT = """
You are an expert Credit Intelligence Analyst. Your task is to generate a comprehensive, clear, and professional 'Store Analysis Summary' for a kirana store or small business based on raw data signals from various analysis engines.

Structure your report into the following sections exactly:
Store Analysis Summary
──────────────────────────────────────────────────────────
[Provide a 1-2 sentence overview of the store, its catchment tier, and footfall score.]

INVENTORY & SHELF ANALYSIS
[Summarize shelf density, SKU diversity, dominant category, and estimated inventory value.]

LOCATION INTELLIGENCE  
[Discuss road type, competition, and nearby POIs (demand generators).]

CASH FLOW ESTIMATE
[List estimated daily sales, monthly net income, and blended net margin.]

RISK FLAGS (if any)
[List any fraud or risk flags detected as bullet points. If none, write 'None detected'.]

RECOMMENDATION: [Output the exact recommendation provided]
Confidence Score: [Output the confidence score provided out of 1.0]

[Provide a brief 1-2 sentence justification for the recommendation based on the data.]

Format your output nicely. Keep it concise, analytical, and professional. Use formatting such as bullet points where necessary.
"""


def _deterministic_fallback(
    vision: dict,
    geo: dict,
    fraud: dict,
    cash_flow: dict,
    store_name: str | None,
    recommendation: str,
) -> str:
    name = store_name or "This kirana store"
    flags = fraud.get("flags", []) or []

    daily_low = cash_flow.get("daily_sales_low", 0)
    daily_high = cash_flow.get("daily_sales_high", 0)
    monthly_low = cash_flow.get("monthly_income_low", 0)
    monthly_high = cash_flow.get("monthly_income_high", 0)
    margin_pct = round((cash_flow.get("blended_margin", 0) or 0) * 100, 1)
    confidence = cash_flow.get("confidence_score", 0.5)

    lines = [
        "Store Analysis Summary",
        "──────────────────────────────────────────────────────────",
        f"{name} is located in a {str(geo.get('catchment_tier', 'urban_sparse')).replace('_', ' ')} area with a footfall score of {geo.get('footfall_proxy_score', 50)}/100.",
        "",
        "INVENTORY & SHELF ANALYSIS",
        f"- Shelf Density Index: {vision.get('sdi', 0.5)}",
        f"- SKU Diversity: {vision.get('sku_diversity', 0)}",
        f"- Dominant Category: {vision.get('dominant_category', 'unknown')}",
        f"- Estimated Inventory Value: Rs {int(vision.get('inventory_value_est', 0)):,}",
        "",
        "LOCATION INTELLIGENCE",
        f"- Road Type: {geo.get('road_type', 'unclassified')}",
        f"- Competition (300m): {geo.get('competition_count', 0)} stores",
        f"- Nearby POIs counted: {geo.get('poi_count', 0)}",
        "",
        "CASH FLOW ESTIMATE",
        f"- Daily Sales (70% CI): Rs {int(daily_low):,} to Rs {int(daily_high):,}",
        f"- Monthly Net Income (70% CI): Rs {int(monthly_low):,} to Rs {int(monthly_high):,}",
        f"- Blended Net Margin: {margin_pct}%",
        "",
        "RISK FLAGS",
    ]

    if flags:
        for flag in flags:
            lines.append(f"- {str(flag).replace('_', ' ')}")
    else:
        lines.append("- None detected")

    lines.extend([
        "",
        f"RECOMMENDATION: {recommendation}",
        f"Confidence Score: {confidence}",
        "",
        "This summary was generated using deterministic fallback logic because Gemini was unavailable in the runtime environment.",
    ])

    return "\n".join(lines)

async def generate_explanation(
    vision: dict, 
    geo: dict, 
    fraud: dict, 
    cash_flow: dict, 
    store_name: str = None, 
    recommendation: str = "APPROVE_WITH_MONITORING"
) -> str:
    """
    Generate an analysis explanation using Google Gemini API.
    """
    flags = fraud.get("flags", [])
    
    # Create the payload data
    data_payload = {
        "store_name": store_name or "This kirana store",
        "vision_signals": vision,
        "geo_signals": geo,
        "fraud_assessment": fraud,
        "cash_flow_estimate": cash_flow,
        "final_recommendation": recommendation,
        "confidence_score": cash_flow.get("confidence_score", 0.5)
    }

    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY missing. Using deterministic fallback explanation.")
        return _deterministic_fallback(vision, geo, fraud, cash_flow, store_name, recommendation)

    try:
        import google.generativeai as genai
        from google.api_core.exceptions import NotFound

        genai.configure(api_key=settings.GEMINI_API_KEY)
        prompt = f"Please generate the Store Analysis Summary based on the following data:\n\n{json.dumps(data_payload, indent=2)}"

        last_not_found: Exception | None = None
        for model_name in GEMINI_MODEL_CANDIDATES:
            try:
                model = genai.GenerativeModel(
                    model_name=model_name,
                    generation_config=generation_config,
                    system_instruction=SYSTEM_PROMPT,
                )

                response = await model.generate_content_async(prompt)
                text = (response.text or "").strip()
                if text:
                    return text
            except NotFound as e:
                last_not_found = e
                logger.warning(f"Gemini model unavailable: {model_name}. Trying next candidate.")
                continue

        if last_not_found:
            logger.warning(f"No configured Gemini models available: {last_not_found}")
        return _deterministic_fallback(vision, geo, fraud, cash_flow, store_name, recommendation)
    except ModuleNotFoundError as e:
        logger.warning(f"Gemini SDK missing in runtime: {e}. Using deterministic fallback.")
        return _deterministic_fallback(vision, geo, fraud, cash_flow, store_name, recommendation)
    except Exception as e:
        logger.exception(f"Error generating explanation via Gemini: {e}")
        return _deterministic_fallback(vision, geo, fraud, cash_flow, store_name, recommendation)

