from typing import List, Protocol
from app.schemas.explorer import ExplorerCard


class ExplorerProvider(Protocol):
    """Protocol defining the lightweight interface for all Explorer data providers."""

    async def fetch_cards(
        self, lat: float, lon: float, radius: int
    ) -> List[ExplorerCard]:
        """Fetch and normalize cards for a given location and radius.

        Args:
            lat: Latitude
            lon: Longitude
            radius: Radius in meters

        Returns:
            List of normalized ExplorerCard objects.
        """
        ...
