"""
app/services/external/dataforseo_provider.py — DataForSEO API integration.
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Any

import requests
from app.services.external.base_provider import BaseExploreProvider
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class DataForSEOProvider(BaseExploreProvider):
    """
    Direct adapter for DataForSEO Google Events API (Pay-as-you-go, much cheaper).
    """

    @property
    def source_name(self) -> str:
        return "dataforseo"

    def fetch_events(self, city: str, category: str | None = None) -> list[dict[str, Any]]:
        # Read from environment directly
        login = os.getenv("DATAFORSEO_LOGIN")
        password = os.getenv("DATAFORSEO_PASSWORD")

        if not login or not password:
            logger.warning("No DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD configured.")
            return []

        try:
            if category and category.lower() != "events":
                query_str = f"{category} events"
            else:
                query_str = "upcoming events"
            
            # Prepare Basic Auth
            credentials = f"{login}:{password}"
            encoded_credentials = base64.b64encode(credentials.encode("utf-8")).decode("utf-8")
            
            headers = {
                "Authorization": f"Basic {encoded_credentials}",
                "Content-Type": "application/json"
            }
            
            # Post data to Live Advanced Endpoint
            payload = [{
                "keyword": f"{query_str} in {city}",
                "location_code": 2840,
                "language_code": "en"
            }]
            
            response = requests.post(
                "https://api.dataforseo.com/v3/serp/google/events/live/advanced",
                json=payload,
                headers=headers,
                timeout=15.0
            )
            response.raise_for_status()
            
            data = response.json()
            tasks = data.get("tasks", [])
            if not tasks:
                return []
                
            task = tasks[0]
            if task.get("status_code") != 20000:
                raise ValueError(f"DataForSEO Task Error {task.get('status_code')}: {task.get('status_message')}")
                
            results = task.get("result", [])
            if not results:
                return []
                
            items = results[0].get("items", [])
            return items

        except Exception as exc:
            logger.warning("Failed to fetch events from DataForSEO: %s", exc)
            return []

    def fetch_news(self, city: str) -> list[dict[str, Any]]:
        # Read from environment directly
        login = os.getenv("DATAFORSEO_LOGIN")
        password = os.getenv("DATAFORSEO_PASSWORD")

        if not login or not password:
            logger.warning("No DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD configured.")
            return []

        try:
            credentials = f"{login}:{password}"
            encoded_credentials = base64.b64encode(credentials.encode("utf-8")).decode("utf-8")
            
            headers = {
                "Authorization": f"Basic {encoded_credentials}",
                "Content-Type": "application/json"
            }
            
            payload = [{
                "keyword": f"{city} travel tips news",
                "location_code": 2840,
                "language_code": "en"
            }]
            
            response = requests.post(
                "https://api.dataforseo.com/v3/serp/google/news/live/advanced",
                json=payload,
                headers=headers,
                timeout=15.0
            )
            response.raise_for_status()
            
            data = response.json()
            tasks = data.get("tasks", [])
            if not tasks:
                return []
                
            task = tasks[0]
            if task.get("status_code") != 20000:
                raise ValueError(f"DataForSEO Task Error {task.get('status_code')}: {task.get('status_message')}")
                
            results = task.get("result", [])
            if not results:
                return []
                
            items = results[0].get("items", [])
            return items

        except Exception as exc:
            logger.warning("Failed to fetch news from DataForSEO: %s", exc)
            return []

