import json
import logging
import re
from typing import Any, Dict, List

import httpx

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerCard
from config import settings

logger = logging.getLogger(__name__)


class GeminiRanker:
    """Ranks ExplorerCards using Gemini 1.5 Flash with strict JSON output."""

    def __init__(self):
        self.api_key = (settings.gemini_api_key or "").strip()
        self.model = "gemini-1.5-flash"
        self.url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"

    async def rank_cards(
        self, cards: List[ExplorerCard], context: Dict[str, Any]
    ) -> List[ExplorerCard]:
        """Rank a list of cards using Gemini Flash.

        Args:
            cards: List of deduplicated cards (max 50-100).
            context: Dict containing weather, time, group size, etc.
        """
        if not self.api_key:
            logger.warning("Gemini API key not configured. Skipping ranking.")
            return cards

        if not cards:
            return []

        # Prepare items for prompt (limit to 100 as requested)
        items_to_rank = []
        for card in cards[:100]:
            items_to_rank.append(
                {
                    "id": card.id,
                    "title": card.title,
                    "type": card.type,
                    "category": card.category,
                    "venue": card.location.name,
                }
            )

        prompt = f"""
        You are a group travel recommendation engine.
        Rank the following items based on their relevance to a group in this context:
        Context: {json.dumps(context)}
        
        Items to rank:
        {json.dumps(items_to_rank)}
        
        Rules:
        1. Rank the top 20 items.
        2. Assign a score (0.0 to 1.0) to each ranked item.
        3. Assign 1-3 group tags to each ranked item (e.g., "nightlife", "chill", "large groups").
        4. Return ONLY a valid JSON object. No markdown blocks, no conversational text.
        
        Expected JSON format:
        {{
          "ranked_ids": ["id1", "id2", ...],
          "scores": {{"id1": 0.9, "id2": 0.8, ...}},
          "tags": {{"id1": ["tag1", "tag2"], "id2": ["tag3"], ...}}
        }}
        """

        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,  # Low temperature for structured output
                "maxOutputTokens": 2048,
                "responseMimeType": "application/json",  # Request JSON output
            },
        }

        try:
            async with httpx.AsyncClient(
                timeout=API_TIMEOUT_SECONDS
            ) as client:
                r = await client.post(
                    self.url, params={"key": self.api_key}, json=body
                )

            if r.status_code != 200:
                logger.warning("Gemini HTTP %s: %s", r.status_code, r.text[:200])
                return cards

            payload = r.json()
            candidates = payload.get("candidates")
            if not isinstance(candidates, list) or not candidates:
                return cards

            first_c = candidates[0]
            parts = (
                first_c.get("content", {}).get("parts")
                if isinstance(first_c, dict)
                else None
            )
            if not isinstance(parts, list) or not parts:
                return cards

            raw_text = parts[0].get("text", "")

            # Parse JSON
            try:
                # Clean up if Gemini wraps it in markdown blocks despite instructions
                cleaned_text = raw_text.strip()
                if cleaned_text.startswith("```json"):
                    cleaned_text = cleaned_text[7:]
                if cleaned_text.endswith("```"):
                    cleaned_text = cleaned_text[:-3]
                cleaned_text = cleaned_text.strip()

                result = json.loads(cleaned_text)

                ranked_ids = result.get("ranked_ids", [])
                scores = result.get("scores", {})
                tags = result.get("tags", {})

                # Reorder cards based on ranked_ids
                card_map = {card.id: card for card in cards}
                ranked_result: List[ExplorerCard] = []

                # Add ranked cards first
                for rid in ranked_ids:
                    if rid in card_map:
                        card = card_map[rid]
                        card.popularity_score = scores.get(rid)
                        card.group_tags = tags.get(rid, [])
                        ranked_result.append(card)
                        del card_map[rid]

                # Append remaining unranked cards
                ranked_result.extend(card_map.values())

                return ranked_result

            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse Gemini JSON output: {e}. Raw: {raw_text[:200]}")
                return cards

        except Exception as exc:
            logger.warning("Gemini ranking failed: %s", exc)
            return cards


# Singleton instance
gemini_ranker = GeminiRanker()
