import re
import json
import logging
import urllib.parse
import httpx
import requests
from fastapi import APIRouter, status
from pydantic import BaseModel
import yt_dlp
import instaloader

from app.schemas.cart import VideoExtractRequest, VideoExtractResponse
from app.services.ai_assistant_service import generate_gemini_content

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cart", tags=["video_extract"])

def detect_platform(url: str) -> str:
    url_lower = url.lower()
    if "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "youtube"
    elif "instagram.com" in url_lower:
        return "instagram"
    elif "tiktok.com" in url_lower:
        return "tiktok"
    elif "maps.google.com" in url_lower or "google.com/maps" in url_lower or "maps.app.goo.gl" in url_lower:
        return "google_maps"
    else:
        return "other"

def parse_google_maps_url(url: str) -> tuple[str | None, float | None, float | None]:
    final_url = url
    if "maps.app.goo.gl" in url:
        try:
            resp = requests.head(url, allow_redirects=True, timeout=5)
            final_url = resp.url
        except Exception as e:
            logger.error(f"Failed to follow Google Maps redirect: {e}")

    place_name = None
    lat = None
    lng = None

    # Parse place name
    # Format e.g.: /maps/place/Eiffel+Tower/
    place_match = re.search(r"/place/([^/@?]+)", final_url)
    if place_match:
        place_name = urllib.parse.unquote_plus(place_match.group(1))

    # Also check /search/ if not place
    if not place_name:
        search_match = re.search(r"/search/([^/@?]+)", final_url)
        if search_match:
            place_name = urllib.parse.unquote_plus(search_match.group(1))

    # Parse coordinates
    # Format e.g.: @48.85837,2.2944813
    coords_match = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", final_url)
    if coords_match:
        try:
            lat = float(coords_match.group(1))
            lng = float(coords_match.group(2))
        except ValueError:
            pass

    return place_name, lat, lng

@router.post("/extract-from-url", response_model=VideoExtractResponse)
async def extract_from_url(body: VideoExtractRequest) -> VideoExtractResponse:
    url = body.url.strip()
    platform = detect_platform(url)

    title = ""
    description = ""
    tags = []
    location = ""
    thumbnail = ""
    extracted_place = None
    city = None
    country = None
    lat = 0.0
    lng = 0.0
    confidence = "low"

    # Step 1: Handle Google Maps URL directly
    if platform == "google_maps":
        place_name, map_lat, map_lng = parse_google_maps_url(url)
        title = place_name or "Google Maps Place"
        extracted_place = place_name
        if map_lat is not None and map_lng is not None:
            lat = map_lat
            lng = map_lng
            confidence = "high"
        
        # Geocode if coordinates are missing but place name is present
        if extracted_place and (lat == 0.0 and lng == 0.0):
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(
                        "https://nominatim.openstreetmap.org/search",
                        params={
                            "q": extracted_place,
                            "format": "json",
                            "limit": 1,
                            "addressdetails": 1
                        },
                        headers={
                            "User-Agent": "Rovvy/1.0 contact@rovvy.app",
                            "Accept-Language": "en"
                        },
                        timeout=10.0
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if data and isinstance(data, list):
                            lat = float(data[0].get("lat", 0.0))
                            lng = float(data[0].get("lon", 0.0))
                            confidence = "high"
                            address = data[0].get("address", {})
                            city = address.get("city") or address.get("town") or address.get("village") or address.get("county")
                            country = address.get("country")
            except Exception as e:
                logger.error(f"Geocoding failed for Google Maps: {e}")

        return VideoExtractResponse(
            title=title,
            description=f"Saved from Google Maps link: {url}",
            thumbnail="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=300", # Branded default map thumbnail
            extracted_place=extracted_place,
            city=city,
            country=country,
            lat=lat,
            lng=lng,
            confidence=confidence,
            platform=platform
        )

    # Step 2: Use Instaloader for Instagram if applicable
    instagram_success = False
    if platform == "instagram":
        try:
            shortcode_match = re.search(r"/(?:p|reel|tv)/([A-Za-z0-9_-]+)", url)
            if shortcode_match:
                shortcode = shortcode_match.group(1)
                L = instaloader.Instaloader()
                # Disable downloading to avoid disk operations and keep it fast
                post = instaloader.Post.from_shortcode(L.context, shortcode)
                title = f"Instagram Reel by {post.owner_username}"
                description = post.caption or ""
                thumbnail = post.url
                instagram_success = True
        except Exception as e:
            logger.error(f"Instaloader failed for Instagram: {e}. Falling back to yt-dlp.")

    # Step 3: Use yt-dlp as fallback / primary extractor
    if not instagram_success:
        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
                'skip_download': True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info:
                    title = info.get('title', '')
                    description = info.get('description', '') or info.get('caption', '') or ''
                    tags = info.get('tags', []) or []
                    location = info.get('location', '') or ''
                    thumbnail = info.get('thumbnail', '') or ''
        except Exception as e:
            logger.error(f"yt-dlp extraction failed for {url}: {e}")

    # Step 4: AI Location Extraction via Gemini/Wayra
    if title or description or location:
        prompt = f"""Extract the location/place name from this travel video content. Return ONLY a JSON object:
{{ "place_name": string, "city": string, "country": string }}

Title: {title}
Description: {description}
Tags: {tags}
Location field: {location}

If no location found, return:
{{ "place_name": null, "city": null, "country": null }}"""

        try:
            # generate_gemini_content returns an AwaitableString
            res = generate_gemini_content(prompt)
            # await res if it has __await__ or if it's awaitable
            if hasattr(res, "__await__"):
                res_text = await res
            else:
                res_text = str(res)

            # Clean json code block markers
            res_text = res_text.strip()
            if res_text.startswith("```"):
                res_text = re.sub(r"^```(?:json)?\s*", "", res_text, flags=re.IGNORECASE)
                res_text = re.sub(r"\s*```\s*$", "", res_text, flags=re.DOTALL).strip()

            loc_data = json.loads(res_text)
            extracted_place = loc_data.get("place_name")
            city = loc_data.get("city")
            country = loc_data.get("country")
        except Exception as e:
            logger.error(f"Gemini location extraction failed: {e}")

    # Step 5: Geocoding via Nominatim
    if extracted_place:
        try:
            # Query Nominatim
            q_parts = [extracted_place]
            if city:
                q_parts.append(city)
            if country:
                q_parts.append(country)

            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={
                        "q": " ".join(q_parts),
                        "format": "json",
                        "limit": 1,
                        "addressdetails": 1
                    },
                    headers={
                        "User-Agent": "Rovvy/1.0 contact@rovvy.app",
                        "Accept-Language": "en"
                    },
                    timeout=10.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data and isinstance(data, list):
                        lat = float(data[0].get("lat", 0.0))
                        lng = float(data[0].get("lon", 0.0))
                        confidence = "high"
                        address = data[0].get("address", {})
                        if not city:
                            city = address.get("city") or address.get("town") or address.get("village") or address.get("county")
                        if not country:
                            country = address.get("country")
        except Exception as e:
            logger.error(f"Geocoding failed for extracted place: {e}")

    # Fallback default thumbnail if empty
    if not thumbnail:
        thumbnail = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=300"

    return VideoExtractResponse(
        title=title or "Travel Video",
        description=description[:200] if description else "",
        thumbnail=thumbnail,
        extracted_place=extracted_place,
        city=city,
        country=country,
        lat=lat,
        lng=lng,
        confidence=confidence,
        platform=platform
    )
