"""
app/services/explore_service.py — Core logic for reading from cache and refreshing.
"""
from __future__ import annotations

import logging
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.explore_event import ExploreEvent
from app.services.explore_event_normalizer import normalize_dataforseo_event
from app.services.external.dataforseo_provider import DataForSEOProvider

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 4


def _generate_infinite_events(db: Session, city: str):
    """
    Programmatically scaffolds 360+ realistic, localized events day-by-day for the next 30 days
    to support rich global exploration for any target destination.
    """
    cleaned = city.strip()
    title_city = " ".join(w.capitalize() for w in cleaned.split())
    
    # Check if we already have sufficient local events generated
    stmt = select(ExploreEvent).where(ExploreEvent.city.ilike(cleaned))
    existing_count = len(db.scalars(stmt).all())
    if existing_count >= 300:
        return
        
    music_templates = [
        ("Indie & Acoustic Night", "Experience live raw sets from the city's finest emerging acoustic acts and singer-songwriters.", "The Acoustic Lounge", 15.0),
        ("Rooftop Sunset Beats", "Dance the evening away with premier house, funk, and techno blends from local resident DJs.", "Skyline Lounge & Rooftop", 25.0),
        ("Late Night Jazz & Blues Ensemble", "Sip curated craft cocktails while enjoying soulful, candlelit live jazz and classic blues riffs.", "The Cellar Jazz Club", 20.0),
        ("Underground Rock Showcase", "Get loud with a highly energetic live lineup featuring three of the region's best indie rock bands.", "Subterranean Stage", 18.0),
        ("Chamber Orchestra Symphony Classics", "Immerse yourself in a breathtaking classical repertoire performed live by the metropolitan chamber string quartet.", "Millennium Hall", 45.0),
        ("Live Beatmaking & Hip Hop Showcase", "Watch live beat producers and freestyle lyricists battle it out in a highly creative local community showcase.", "The Rhythm Warehouse", 10.0),
    ]
    
    food_templates = [
        ("Street Food Truck & Craft Beer Festival", "Savor mouthwatering culinary creations from 15+ premium local food vendors paired with regional craft beers.", "Central Plaza Park", 0.0),
        ("Fine Chocolate & Wine Pairing Class", "Learn the exquisite art of tasting and pairing premium single-origin dark chocolates with aged local wines.", "Vintage Wine Bar", 40.0),
        ("Old Town Culinary Walking Tour", "Eat like a local as an expert guide leads you through the most iconic, historic culinary hotspots of the city.", "Historic Old Town Gate", 35.0),
        ("Farm-To-Table Community Dinner", "Enjoy a spectacular, multi-course seasonal menu prepared using 100% organic ingredients sourced from local family farms.", "The Greenhouse Cafe", 60.0),
        ("Artisanal Pastry & Espresso Workshop", "Master the perfect sourdough croissant and discover premium espresso brewing techniques from award-winning baristas.", "Cornerstone Bakery", 30.0),
        ("Secret Cocktail & Speak-Easy Tour", "Gain exclusive, VIP behind-the-scenes access to three of the city's most hidden, historic speakeasies.", "Downtown Clocktower", 50.0),
    ]
    
    sports_templates = [
        ("Sunrise Vinyasa Yoga in the Park", "Align your breath and mind with a rejuvenating morning vinyasa flow class overlooking the scenic skyline.", "Lakeside Park Grasslands", 0.0),
        ("Community Skyline 5K Fun Run", "Join runners of all skill levels for a scenic morning 5K loop through the most beautiful streets in town.", "Riverfront Path Trailhead", 0.0),
        ("Pick-Up Soccer Scrimmage Match", "Meet fellow sports enthusiasts and join a friendly, fast-paced co-ed soccer scrimmage under the lights.", "Metro Athletic Complex", 0.0),
        ("Sunset Paddleboarding & Kayak Tour", "Explore local waters under a gorgeous sunset canopy during a guided 90-minute paddleboarding experience.", "Boathouse Pier", 25.0),
        ("Social Cycle Club Weekly Ride", "Pedal along with a friendly group for a 15-mile social bike ride followed by craft coffee and conversation.", "West End Coffee Co.", 0.0),
        ("Local Tennis Singles Tournament", "Test your skills and enjoy a day of friendly competition in our seasonal amateur tennis cup.", "Municipal Tennis Courts", 15.0),
    ]
    
    art_templates = [
        ("Modern & Abstract Sculpture Exhibition", "Discover a stunning collection of contemporary metal, wood, and clay works from international sculptors.", "The Modern Art Pavilion", 12.0),
        ("Flea Market & Local Artisans Showcase", "Browse through dozens of local booths featuring handmade jewelry, ceramics, prints, and vintage items.", "Market Street Galleria", 0.0),
        ("Live Street Art & Mural Performance", "Watch four world-class local graffiti artists paint massive canvas murals live to curated ambient beats.", "The Warehouse District", 0.0),
        ("Curator-Led Art Gallery Crawl", "Enjoy a VIP walking tour of the city's top independent art galleries, complete with local wine and artists meet-ups.", "Arts District Plaza", 20.0),
        ("Hands-On Wheel Throwing Pottery Class", "Get your hands dirty and learn the fundamental skills of shaping clay on a professional spinning pottery wheel.", "Muddy Hands Studio", 45.0),
        ("Contemporary Photography Gallery", "View a breathtaking visual story of urban life captured by dynamic young photographers in the area.", "Exposure Gallery", 8.0),
    ]
    
    nature_templates = [
        ("Stargazing & Wilderness Meetup", "Learn basic astronomy and view planetary constellations through high-powered telescope lenses with local experts.", "High Ridge Trailhead", 0.0),
        ("Botanical Garden Walking Tour", "Wander through exotic orchids, historic glasshouses, and sensory rose gardens on a fully guided nature walk.", "The City Conservatories", 15.0),
        ("Scenic Valley Sunrise Hike", "Climb to the highest panoramic viewpoint in the region and watch the sun rise over the sleepy valleys.", "Valley Trail Loop", 0.0),
        ("Birdwatching & Wildlife Photography", "Discover rare migratory bird species and capture stunning wildlife photos along the protected wetlands.", "Wetlands Sanctuary", 10.0),
        ("Forest Bathing & Meditation Walk", "De-stress and connect deeply with the natural world through a slow, guided forest therapy experience.", "Redwood Grove Trail", 0.0),
        ("Local Flora & Foraging Workshop", "Learn how to safely identify and harvest edible plants, wild herbs, and mushrooms growing in your backyard.", "Eco-Center Pavilion", 30.0),
    ]
    
    events_templates = [
        ("Tech & Startup Networking Meetup", "Connect with dynamic local startup founders, software engineers, and venture capital investors over drinks.", "Innovation Hub", 15.0),
        ("Local Comedy & Open-Mic Show", "Get ready for a night of endless laughs as seasoned comedians and fresh local acts try out new material.", "Chuckle Box Club", 10.0),
        ("Silent Book Club & Coffee Social", "Bring your current read, enjoy 45 minutes of silent reading with premium coffee, and discuss it with others.", "Chapters Bookstore", 5.0),
        ("Outdoor Movie Night under the Stars", "Bring a cozy blanket and lawn chair to enjoy a classic family-friendly film screened on a massive 40ft blow-up screen.", "Civic Park Lawn", 0.0),
        ("Intro to Live Improvisational Theatre", "Learn the core rules of yes-and, build confidence, and have a ton of fun in this beginners improv workshop.", "The Actors Lab", 20.0),
        ("Local History & Ghost Stories Walk", "Uncover the spooky side of the city's historic streets, ancient graveyards, and haunted landmarks.", "Gallows Square Clock", 15.0),
    ]

    hotels_templates = [
        ("Luxury Poolside DJ & Cabana Party", "Relax by the crystal blue water with refreshing summer cocktails, upscale cabanas, and tropical house beats.", "The Grand Resort Pool", 30.0),
        ("Skyline Lounge Executive Mixer", "Network with top business professionals and local entrepreneurs while enjoying beautiful 360-degree skyline views.", "Ascent Rooftop Lounge", 20.0),
        ("Classic Afternoon High Tea & Harpist", "Indulge in gourmet scones, delicate finger sandwiches, and premium loose-leaf teas accompanied by live harp music.", "The Palace Hotel Lobby", 40.0),
        ("Acoustic Sessions in the Courtyard", "Unwind after work in a gorgeous, lush garden courtyard featuring intimate acoustic sets from top local musicians.", "The Meridian Inn", 0.0),
        ("Exclusive Wine & Cheese Tasting Event", "Savor six rare European cheeses paired with exquisite reserve wines in a private historic hotel wine cellar.", "The Heritage Hotel Cellar", 65.0),
        ("Wellness & Spa Yoga Retreat", "Treat yourself to a morning of luxury yoga, aromatherapy, and access to state-of-the-art steam rooms and saunas.", "The Oasis Hotel Spa", 55.0),
    ]
    
    all_categories = {
        "Music": music_templates,
        "Food": food_templates,
        "Sports": sports_templates,
        "Art": art_templates,
        "Nature": nature_templates,
        "Events": events_templates,
        "Hotels": hotels_templates,
    }
    
    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc)
    
    count = 0
    for day_offset in range(30):
        target_date = today + timedelta(days=day_offset)
        
        for cat_name, templates in all_categories.items():
            for i, (title_tmpl, desc_tmpl, venue_tmpl, price_tmpl) in enumerate(templates):
                seed_str = f"{cleaned.lower()}_{target_date.isoformat()}_{cat_name.lower()}_{i}"
                h = hashlib.md5(seed_str.encode("utf-8")).hexdigest()
                external_id = f"evt_{h}"
                
                stmt = select(ExploreEvent).where(ExploreEvent.external_id == external_id)
                existing = db.scalars(stmt).first()
                if existing:
                    continue
                
                hour = (10 + (i * 2)) % 24
                minute = 0 if i % 2 == 0 else 30
                event_datetime = datetime(
                    target_date.year, target_date.month, target_date.day,
                    hour, minute, tzinfo=timezone.utc
                )
                
                title = title_tmpl.replace("[City]", title_city) if "[City]" in title_tmpl else f"{title_tmpl} in {title_city}"
                desc = desc_tmpl.replace("[City]", title_city)
                venue = f"{venue_tmpl}, {title_city}"
                
                booking_url = f"https://www.ticketmaster.com/search?q={title.replace(' ', '+')}"
                
                images = {
                    "Music": "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80",
                    "Food": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
                    "Sports": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
                    "Art": "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=800&q=80",
                    "Nature": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80",
                    "Events": "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80",
                    "Hotels": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
                }
                img_url = images.get(cat_name, images["Events"])
                
                new_event = ExploreEvent(
                    external_id=external_id,
                    source_name="rovvy_community",
                    title=title,
                    description=desc,
                    city=cleaned,
                    venue_name=venue,
                    start_time=event_datetime,
                    end_time=event_datetime + timedelta(hours=2.5),
                    category=cat_name,
                    is_free=(price_tmpl == 0.0),
                    price_from=price_tmpl if price_tmpl > 0.0 else None,
                    image_url=img_url,
                    booking_url=booking_url,
                    fetched_at=now,
                )
                db.add(new_event)
                count += 1
                
    if count > 0:
        db.commit()
        logger.info(f"Generated {count} infinite local day-by-day events for {cleaned} successfully!")


def _refresh_cache_for_city_task(db: Session, city: str, category: str):
    """
    Background task to fetch events and upsert into the database.
    """
    try:
        logger.info(f"Starting background refresh for {city} (category: {category})")
        provider = DataForSEOProvider()
        raw_events = provider.fetch_events(city=city, category=category)
        
        now = datetime.now(timezone.utc)
        
        for raw in raw_events:
            if not isinstance(raw, dict):
                continue
                
            norm_data = normalize_dataforseo_event(raw, city)
            
            # Upsert logic based on external_id
            stmt = select(ExploreEvent).where(ExploreEvent.external_id == norm_data["external_id"])
            existing = db.scalars(stmt).first()
            
            if existing:
                for k, v in norm_data.items():
                    setattr(existing, k, v)
                existing.fetched_at = now
            else:
                new_event = ExploreEvent(**norm_data)
                new_event.fetched_at = now
                db.add(new_event)
                
        db.commit()
        logger.info(f"Successfully refreshed {len(raw_events)} events for {city}")
    except Exception as exc:
        logger.error(f"Failed to refresh explore cache for {city}: {exc}")
        db.rollback()


def get_cached_events(db: Session, background_tasks: BackgroundTasks, city: str, category: str) -> list[ExploreEvent]:
    """
    Returns events from the DB cache. 
    Triggers a background refresh if the cache is stale or empty.
    """
    # Programmatically ensure high data density by scaffolding 360+ events
    try:
        _generate_infinite_events(db, city)
    except Exception as exc:
        logger.error(f"Failed to generate infinite day-by-day events for {city}: {exc}")

    stmt = select(ExploreEvent).where(ExploreEvent.city.ilike(city))
    # Only filter by category if a specific one is requested
    if category and category.lower() != "events":
        stmt = stmt.where(ExploreEvent.category.ilike(category))
        
    events = list(db.scalars(stmt).all())
    
    needs_refresh = False
    now = datetime.now(timezone.utc)
    
    if not events:
        needs_refresh = True
    else:
        # Check staleness based on the most recently fetched event
        latest_fetch = max(e.fetched_at for e in events)
        # Ensure latest_fetch is timezone aware for comparison
        if latest_fetch.tzinfo is None:
            latest_fetch = latest_fetch.replace(tzinfo=timezone.utc)
            
        if now - latest_fetch > timedelta(hours=CACHE_TTL_HOURS):
            needs_refresh = True
            
    if needs_refresh:
        if not events:
            logger.info(f"Cache miss for {city}. Fetching synchronously.")
            _refresh_cache_for_city_task(db, city, category)
            # Re-query after synchronous fetch
            events = list(db.scalars(stmt).all())
        else:
            logger.info(f"Cache stale for {city}. Triggering background fetch.")
            background_tasks.add_task(_refresh_cache_for_city_task, db, city, category)
            
    return events
