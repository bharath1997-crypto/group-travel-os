"""
app/services/external/apify_provider.py — Apify API integration for TikTok/Instagram Reels.
"""
from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


class ApifyProvider:
    def __init__(self):
        self.api_token = os.getenv("APIFY_API_TOKEN")

    def fetch_tiktok_shorts(self, city: str) -> list[dict[str, Any]]:
        """
        Fetches TikTok videos for a city using Apify.
        For now, returns mock data to test the multi-source UI.
        """
        if not self.api_token:
            logger.info("No APIFY_API_TOKEN found. Returning mock TikTok data for testing.")
            # Return some realistic mock data for testing the UI
            return [
                {
                    "videoId": "mock_tt_1",
                    "title": f"Best hidden gems in {city}! 🔥",
                    "channelTitle": "travel_guru",
                    "thumbnailUrl": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=500&q=80", # Chicago-like city
                    "source": "TikTok",
                    "url": "https://www.tiktok.com/"
                },
                {
                    "videoId": "mock_tt_2",
                    "title": f"You must visit this place in {city}",
                    "channelTitle": "city_explorer",
                    "thumbnailUrl": "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=500&q=80",
                    "source": "TikTok",
                    "url": "https://www.tiktok.com/"
                }
            ]

        # If they have a token, we would do something like this:
        # url = "https://api.apify.com/v2/acts/tiktok-scraper/runs"
        # ...
        
        # For now, keep returning mock data until they configure a specific actor
        return [
            {
                "videoId": "mock_tt_1",
                "title": f"Best hidden gems in {city}! 🔥",
                "channelTitle": "travel_guru",
                "thumbnailUrl": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=500&q=80",
                "source": "TikTok",
                "url": "https://www.tiktok.com/"
            },
            {
                "videoId": "mock_tt_2",
                "title": f"You must visit this place in {city}",
                "channelTitle": "city_explorer",
                "thumbnailUrl": "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=500&q=80",
                "source": "TikTok",
                "url": "https://www.tiktok.com/"
            }
        ]
