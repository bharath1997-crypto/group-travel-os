from typing import Any, Dict, List


class CountryTemplateService:
    """Service to provide destination-aware templates for the Explorer system."""

    def get_template(self, country_code: str) -> Dict[str, Any]:
        """Get the template configuration for a country."""
        country = (country_code or "US").strip().upper()
        if country in ("US", "GB", "UK", "FR", "DE", "ES", "IT", "NL", "BE", "CH", "AT"):
            return self._get_country_template(country)
        # Default fallback
        return self._get_country_template("US")

    def _get_country_template(self, country_code: str) -> Dict[str, Any]:
        return {
            "country_code": country_code,
            "default_radius_meters": 10000,  # 10km
            "modules": [
                {
                    "id": "weather",
                    "priority": 0,
                    "providers": ["open_meteo"],
                    "cache_ttl_hours": 1.0,
                },
                {
                    "id": "events",
                    "priority": 1,
                    "providers": ["ticketmaster", "unipride"],
                    "cache_ttl_hours": 3.0,
                },
                {
                    "id": "places",
                    "priority": 2,
                    "providers": ["geoapify", "foursquare"],
                    "cache_ttl_hours": 24.0,  # Places change less often
                },
                {
                    "id": "buzz",
                    "priority": 3,
                    "providers": ["gnews"],
                    "cache_ttl_hours": 6.0,
                },
                {
                    "id": "audio",
                    "priority": 4,
                    "providers": ["radio_browser"],
                    "cache_ttl_hours": 24.0,
                },
            ],
            "ai_ranking": {
                "enabled": True,
                "model": "gemini-2.5-flash",
                "max_items": 100,  # "max 50–100 normalized cards per batch"
            },
        }


# Singleton instance
country_template_service = CountryTemplateService()
