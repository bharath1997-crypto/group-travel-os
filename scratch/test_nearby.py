import asyncio
import logging
from app.services.places_nearby_service import PlacesNearbyService

logging.basicConfig(level=logging.INFO)

async def main():
    try:
        # Near Chicago Loop
        res = await PlacesNearbyService.search_nearby_places(
            category="gas",
            lat=41.8781,
            lng=-87.6298,
            radius_meters=1000
        )
        print("Gas results:", len(res), res)
        
        res_all = await PlacesNearbyService.search_nearby_places(
            category="all",
            lat=41.8781,
            lng=-87.6298,
            radius_meters=500
        )
        print("All results:", len(res_all), res_all[:2] if res_all else [])
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
