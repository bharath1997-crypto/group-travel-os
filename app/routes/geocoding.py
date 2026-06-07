"""
app/routes/geocoding.py — Nominatim geocoding proxy (no auth)
"""
import httpx
from fastapi import APIRouter, Query

router = APIRouter(tags=["Geocoding"])

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_HEADERS = {
    "User-Agent": "Rovvy/1.0 contact@rovvy.app",
    "Accept-Language": "en",
}


@router.get("/geocoding/search")
async def search_address(q: str = Query(..., min_length=1)):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            NOMINATIM_URL,
            params={
                "q": q,
                "format": "json",
                "limit": 5,
                "addressdetails": 1,
            },
            headers=NOMINATIM_HEADERS,
            timeout=10.0,
        )
        if response.status_code != 200:
            return []
        data = response.json()
        return data if isinstance(data, list) else []
