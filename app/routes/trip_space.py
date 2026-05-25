from fastapi import APIRouter, Depends
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/trip-space", tags=["Trip Space"])

@router.get("/destinations")
def get_destinations(
    origin: str = "Chicago",
    max_hours: int = 3,
    vibe: str = "adventure",
    current_user: User = Depends(get_current_user)
):
    """Return curated weekend destinations based on origin and vibe"""
    # Curated static list per origin city with Unsplash hero images and search terms
    destinations = {
        "chicago": [
            {
                "name": "Starved Rock State Park",
                "state": "IL",
                "drive_hours": 1.5,
                "vibes": ["adventure", "nature", "hiking"],
                "city_search": "Utica,IL",
                "drive": "1.5 hrs",
                "vibe": "Hiking, Canyons, Waterfalls",
                "image": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400"
            },
            {
                "name": "Galena",
                "state": "IL",
                "drive_hours": 2.5,
                "vibes": ["relaxing", "cultural", "food", "food & drink"],
                "city_search": "Galena,IL",
                "drive": "2.5 hrs",
                "vibe": "Charming town, Rolling hills, History",
                "image": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400"
            },
            {
                "name": "Lake Geneva",
                "state": "WI",
                "drive_hours": 1.5,
                "vibes": ["nature", "relaxing", "adventure"],
                "city_search": "Lake Geneva,WI",
                "drive": "1.5 hrs",
                "vibe": "Lake activities, Boating, Beaches",
                "image": "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=400"
            },
            {
                "name": "Shawnee National Forest",
                "state": "IL",
                "drive_hours": 3.0,
                "vibes": ["adventure", "nature", "hiking"],
                "city_search": "Harrisburg,IL",
                "drive": "3 hrs",
                "vibe": "Rock formations, Hiking, Camping",
                "image": "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400"
            },
            {
                "name": "Peninsula State Park",
                "state": "WI",
                "drive_hours": 3.0,
                "vibes": ["nature", "adventure", "camping"],
                "city_search": "Fish Creek,WI",
                "drive": "3 hrs",
                "vibe": "Camping, Kayaking, Scenic views",
                "image": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400"
            },
        ]
    }
    
    city_key = origin.lower().split(",")[0].strip()
    results = destinations.get(city_key, destinations["chicago"])
    
    # Filter by vibe if specified
    if vibe and vibe != "all":
        results = [d for d in results if vibe.lower() in [v.lower() for v in d["vibes"]]]
    
    # Filter by max drive hours
    results = [d for d in results if d["drive_hours"] <= max_hours]
    
    return {"origin": origin, "destinations": results}
