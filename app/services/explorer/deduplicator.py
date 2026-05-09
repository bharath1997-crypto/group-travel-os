import logging
from typing import List
from app.schemas.explorer import ExplorerCard

logger = logging.getLogger(__name__)


class ExplorerDeduplicator:
    """Deduplicates ExplorerCards based on normalized fields to merge items from multiple APIs."""

    def deduplicate(self, cards: List[ExplorerCard]) -> List[ExplorerCard]:
        """Deduplicate cards based on normalized_title, normalized_venue, and normalized_city.

        If a duplicate is found, it merges missing links and records the other source.
        """
        seen_keys = {}
        unique_cards: List[ExplorerCard] = []

        for card in cards:
            # Create a unique key for deduplication
            key = (
                card.normalized_title,
                card.normalized_venue,
                card.normalized_city,
            )

            # Fallback for sparse data: if we only have title, use that
            if not card.normalized_venue and not card.normalized_city:
                key = (card.normalized_title, "", "")

            if key in seen_keys:
                logger.debug(
                    f"Duplicate found: '{card.title}' from {card.source}. Already seen from {seen_keys[key].source}."
                )
                existing_card = seen_keys[key]
                
                # Record the other source
                if "other_sources" not in existing_card.metadata:
                    existing_card.metadata["other_sources"] = []
                existing_card.metadata["other_sources"].append(card.source)

                # Merge links if the duplicate has links the existing one doesn't
                for k, v in card.links.items():
                    if k not in existing_card.links:
                        existing_card.links[k] = v
                        
                # Merge images if existing has none
                if not existing_card.images and card.images:
                    existing_card.images = card.images
            else:
                seen_keys[key] = card
                unique_cards.append(card)

        return unique_cards


# Singleton instance
deduplicator = ExplorerDeduplicator()
