from __future__ import annotations
import logging
from datetime import datetime
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.explore_city_extended_service import get_safety_cached
from app.services.currency_service import get_exchange_rate, CURRENCY_SYMBOLS
from app.services.app_settings_service import get_merged_preferences

logger = logging.getLogger(__name__)

# Comprehensive mapping for Travel Info
COUNTRY_TO_CURRENCY: dict[str, str] = {
    "US": "USD", "IN": "INR", "GB": "GBP", "FR": "EUR", "DE": "EUR", "IT": "EUR", "ES": "EUR",
    "JP": "JPY", "CN": "CNY", "CA": "CAD", "AU": "AUD", "AE": "AED", "SG": "SGD", "MX": "MXN",
    "CH": "CHF", "TH": "THB", "MY": "MYR", "ID": "IDR", "VN": "VND", "KR": "KRW", "HK": "HKD",
    "BR": "BRL", "ZA": "ZAR", "TR": "TRY", "RU": "RUB", "SA": "SAR", "QA": "QAR", "NZ": "NZD",
}

def get_safety_level(score: float) -> str:
    if score < 2.0: return "Level 1: Normal Precautions"
    if score < 3.5: return "Level 2: Exercise Increased Caution"
    if score < 4.5: return "Level 3: Reconsider Travel"
    return "Level 4: Do Not Travel"

def get_travel_info_bundle(
    db: Session, 
    city: str, 
    country_code: str, 
    user: Optional[User] = None
) -> dict[str, Any]:
    cc = country_code.strip().upper()
    
    # 1. Country Safety
    safety_info = None
    try:
        safety_data = get_safety_cached(db, cc, city_hint=city.strip())
        if safety_data and isinstance(safety_data, list) and len(safety_data) > 0:
            s = safety_data[0]
            if isinstance(s, dict):
                score = float(s.get("score", 0) or 0)
                safety_info = {
                    "score": score,
                    "level": get_safety_level(score),
                    "description": s.get("message", "") or "",
                    "updated_at": s.get("updated", "") or ""
                }
    except Exception as e:
        logger.warning(f"Failed to fetch country safety data: {e}")

    # 2. City Specific Safety & Crime
    city_crime_info = {
        "rating": "Moderate", # Default placeholder
        "advice": f"Standard urban safety precautions apply in {city}. Stay aware of your surroundings."
    }
    try:
        from app.services.explore_city_extended_service import get_guide_cached
        guide_data = get_guide_cached(db, city)
        city_safety = ""
        if guide_data and isinstance(guide_data, list) and len(guide_data) > 0:
            g = guide_data[0]
            if isinstance(g, dict):
                city_safety = g.get("stay_safe", "") or ""
        
        city_crime_info = {
            "rating": "Moderate", # Placeholder
            "advice": city_safety or f"Standard urban safety precautions apply in {city}. Stay aware of your surroundings."
        }
    except Exception as e:
        logger.warning(f"Failed to fetch city safety guide: {e}")

    # 3. Seasonal AI Activities Fallback
    seasonal_actions = []
    try:
        from app.services.ai_assistant_service import generate_gemini_content
        month_name = datetime.now().strftime("%B")
        prompt = f"List 3 typical seasonal activities or cultural events that happen in {city} during {month_name}. Return a simple list of strings. No extra text."
        
        res = generate_gemini_content(prompt)
        # Simple parsing for a list
        if res:
            seasonal_actions = [line.strip("- ").strip() for line in res.split("\n") if line.strip()]
    except Exception as e:
        logger.warning(f"Gemini seasonal activities failed: {e}")

    # 4. Currency
    currency_info = {
        "destination_currency": "USD",
        "user_currency": "USD",
        "rate": 1.0,
        "inverse_rate": 1.0,
        "symbol": "$"
    }
    try:
        dest_ccy = COUNTRY_TO_CURRENCY.get(cc, "USD")
        
        # Get User Preferred Currency
        user_ccy = "USD"
        if user:
            prefs = get_merged_preferences(db, user)
            user_ccy = prefs.get("locale", {}).get("preferred_currency", "USD")
        
        # Calculate Rates
        # dest_to_user: 1 INR = X USD
        rate = get_exchange_rate(dest_ccy, user_ccy, db)
        # user_to_dest: 1 USD = X INR
        inverse_rate = get_exchange_rate(user_ccy, dest_ccy, db)
        
        currency_info = {
            "destination_currency": dest_ccy,
            "user_currency": user_ccy,
            "rate": rate,
            "inverse_rate": inverse_rate,
            "symbol": CURRENCY_SYMBOLS.get(user_ccy, "$")
        }
    except Exception as e:
        logger.warning(f"Failed to fetch currency info: {e}")

    return {
        "city": city,
        "country_code": cc,
        "safety": safety_info,
        "city_crime": city_crime_info,
        "seasonal_activities": seasonal_actions,
        "currency": currency_info
    }
