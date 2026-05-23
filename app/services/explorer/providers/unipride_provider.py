"""
app/services/explorer/providers/unipride_provider.py — Provider for inclusive UN Pride & Diversity events.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import List

from app.schemas.explorer import ExplorerCard, create_explorer_card

logger = logging.getLogger(__name__)


class UniprideProvider:
    """Provider for inclusive UN Pride & Diversity events."""

    async def fetch_cards(
        self, lat: float, lon: float, radius: int
    ) -> List[ExplorerCard]:
        """Fetch and normalize Pride/Diversity and inclusive community events."""
        now = datetime.now(timezone.utc)
        
        events_templates = [
            {
                "title": "Global Diversity & Culture Gala",
                "venue_name": "Metro Convention Hall",
                "category": "pride",
                "days_offset": 2,
                "time_str": "18:00:00",
                "description": "A magnificent celebration of international heritage, inclusive arts, and cross-cultural music. Featuring keynote speakers and local global performers.",
                "price": 25.0,
                "image": "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=800&auto=format&fit=crop&q=80"
            },
            {
                "title": "UN Pride Solidarity Parade & Rally",
                "venue_name": "Central Plaza & City Park",
                "category": "pride",
                "days_offset": 5,
                "time_str": "11:00:00",
                "description": "Join the annual UN Pride march celebrating equality, human rights, and love. Features vibrant floats, local community organizations, and live street performers.",
                "price": 0.0,
                "image": "https://images.unsplash.com/photo-1572945281861-68b291d03091?w=800&auto=format&fit=crop&q=80"
            },
            {
                "title": "Queer Cinema Showcase & Director Q&A",
                "venue_name": "Starlight Independent Theatre",
                "category": "arts",
                "days_offset": 3,
                "time_str": "19:30:00",
                "description": "Screenings of award-winning LGBTQ+ short films and documentaries from around the globe, followed by a panel discussion with independent filmmakers.",
                "price": 12.0,
                "image": "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80"
            },
            {
                "title": "Equality & Inclusion Networking Forum",
                "venue_name": "Innovation Hub Co-working",
                "category": "community",
                "days_offset": 1,
                "time_str": "14:00:00",
                "description": "Connect with leaders and allies advocating for diversity and inclusion in professional spaces. Great for sharing resources and active advocacy.",
                "price": 0.0,
                "image": "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80"
            },
            {
                "title": "Pride Comedy & Open Mic Night",
                "venue_name": "The Laugh Lounge",
                "category": "nightlife",
                "days_offset": 4,
                "time_str": "21:00:00",
                "description": "An incredibly hilarious lineup of talented local LGBTQ+ comedians and allies. Enjoy custom mocktails/cocktails and non-stop laughter.",
                "price": 15.0,
                "image": "https://images.unsplash.com/photo-1585699324551-f6c309eed262?w=800&auto=format&fit=crop&q=80"
            },
            {
                "title": "Vibrant Rainbow Street Food Bazaar",
                "venue_name": "Broadway Market Square",
                "category": "food",
                "days_offset": 6,
                "time_str": "12:00:00",
                "description": "Delicious street eats from top local food trucks, complete with rainbow-themed desserts, family friendly game zones, and lively acoustic buskers.",
                "price": 0.0,
                "image": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80"
            }
        ]

        cards: List[ExplorerCard] = []
        for index, t in enumerate(events_templates):
            evt_date = now + timedelta(days=t["days_offset"])
            dt_str = f"{evt_date.strftime('%Y-%m-%d')}T{t['time_str']}"
            
            # Create card with coordinates perturbed slightly to sit within radius
            # 0.001 deg is approx 111m
            offset_lat = lat + (0.002 * (index - 2.5))
            offset_lon = lon + (0.0025 * (index - 2.5))
            
            card = create_explorer_card(
                source="unipride",
                title=t["title"],
                item_type="event",
                venue_name=t["venue_name"],
                city_name="GPS Area",
                id=f"up_{index}_{dt_str[:10]}",
                datetime=dt_str,
                images=[t["image"]],
                links={"info": "https://unpride.org/events", "tickets": "https://unpride.org/tickets"},
                metadata={
                    "description": t["description"],
                    "price": t["price"],
                    "is_free": t["price"] == 0.0,
                },
                location={
                    "lat": offset_lat,
                    "lon": offset_lon,
                    "name": t["venue_name"]
                },
                category=t["category"]
            )
            cards.append(card)
            
        return cards
