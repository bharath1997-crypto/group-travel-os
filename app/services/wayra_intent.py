"""
Wayra intent classification and curated local responses.

Used by AIAssistantService for reliable App Guide answers and travel fallbacks
when live LLM providers are slow or unavailable.
"""
from __future__ import annotations

import re
from enum import StrEnum
from typing import Any


class WayraMode(StrEnum):
    APP_GUIDE = "app_guide"
    TRAVEL = "travel"


class AppIntent(StrEnum):
    CREATE_GROUP = "create_group"
    CREATE_TRIP = "create_trip"
    PLAN_PAGE = "plan_page_explainer"
    NOTIFICATIONS = "notifications"
    NOTIFICATION_SETTINGS = "notification_settings"
    POLLS = "polls"
    SPLITS = "splits"
    LIVE_MAP = "live_map"
    SETTINGS = "settings"
    PROFILE = "profile"
    INVITES = "invites"
    BUDDY_TRIPS = "buddy_trips"
    EXPLORE = "explore"
    MEMORIES = "memories"


APP_INTENT_RESPONSES: dict[AppIntent, str] = {
    AppIntent.CREATE_GROUP: (
        "Open Group in the left sidebar, then Travel Hub to start a coordinated workspace. "
        "Create your group, name it, and share the invite link or code so friends can join. "
        "That group becomes home for trips, polls, and shared expenses."
    ),
    AppIntent.CREATE_TRIP: (
        "From the dashboard choose your trip workspace, or open Trips and tap New Trip. "
        "Add a title, dates, and destination, then invite your group so everyone shares polls, "
        "splits, and live coordination on the same itinerary."
    ),
    AppIntent.PLAN_PAGE: (
        "Plan is Rovvy's booking and routing hub in one place. Open Plan in the sidebar to search "
        "Flights, Hotels, Routes, and Buses—compare options and keep planning next to your group context."
    ),
    AppIntent.NOTIFICATIONS: (
        "Tap the bell icon in the top-right on any screen to open your notification feed, "
        "or go to Notifications (/notifications) for trip updates, invites, and group activity."
    ),
    AppIntent.NOTIFICATION_SETTINGS: (
        "Open Profile → Settings and look for notification preferences to control alerts, "
        "trip updates, and digests. Your inbox at the bell icon still shows everything you've received."
    ),
    AppIntent.POLLS: (
        "Inside an active trip, open the Polls tab → New Poll, add options, and share with the group. "
        "Everyone votes in one place; the creator can close the poll when you're ready to decide."
    ),
    AppIntent.SPLITS: (
        "Open Split Activities or your trip's Expenses tab → Add Expense, enter who paid and the amount, "
        "then choose how to split. Balance Summary shows who owes whom; mark splits settled when done."
    ),
    AppIntent.LIVE_MAP: (
        "Open Group → Live (or your trip's Live/Map tab) to share location, drop meet points, "
        "and run a countdown timer so everyone converges without endless texts."
    ),
    AppIntent.SETTINGS: (
        "Open Profile in the sidebar → Settings for account, security, notifications, and subscription. "
        "Changes there apply across Rovvy on every device you're signed into."
    ),
    AppIntent.PROFILE: (
        "Tap Profile in the left sidebar to edit your name, bio, and avatar—click your photo to upload a new one. "
        "Posts, saved places, and trip highlights also live on your profile."
    ),
    AppIntent.INVITES: (
        "Open your group in Travel Hub and use Share invite link so friends join with one tap. "
        "You can regenerate the code from group settings if you need a fresh link."
    ),
    AppIntent.BUDDY_TRIPS: (
        "Open Group → Buddy Trips (or Explore) to browse open trips from other travelers. "
        "Tap a listing and request to join—the host approves before you're added."
    ),
    AppIntent.EXPLORE: (
        "Explore is your discovery layer—trending destinations, events, activities, and weather cues. "
        "Filter by mood (beach, city, food), save places with the heart icon, and pull them into a trip later."
    ),
    AppIntent.MEMORIES: (
        "Your profile keeps posts and trip moments in one place. Open Profile → Posts or Memories "
        "to revisit what your group captured, and share highlights back to the travel feed."
    ),
}

# Ordered rules: first match wins. Each entry is (intent, predicate on normalized query).
def _has_any(q: str, *patterns: str) -> bool:
    return any(re.search(p, q) for p in patterns)


def normalize_query(message: str) -> str:
    q = message.lower().strip()
    q = re.sub(r"[^\w\s'-]", " ", q)
    return re.sub(r"\s+", " ", q).strip()


def classify_mode(message: str) -> WayraMode:
    """App-help vs travel inspiration. Noun-specific travel cues override generic app words."""
    q = normalize_query(message)
    if not q:
        return WayraMode.APP_GUIDE

    travel_strong = _has_any(
        q,
        r"\bsuggest\b",
        r"\brecommend\b",
        r"\bbest places\b",
        r"\bplaces to visit\b",
        r"\bplaces to see\b",
        r"\bweekend (trip|getaway|escape)\b",
        r"\bwhere should i (go|travel)\b",
        r"\bthings to do in\b",
        r"\bitinerary\b",
        r"\btravel guide\b",
        r"\bcity break\b",
        r"\bhidden gems\b",
        r"\bvisit (tokyo|japan|paris|europe|italy|bali|goa)\b",
    )

    app_strong = _has_any(
        q,
        r"\bhow do i\b",
        r"\bhow to\b",
        r"\bhow can i\b",
        r"\bwhere (do|can) i (find|see|open|get)\b",
        r"\bwhat is the\b",
        r"\bwhat is\b",
        r"\bwhat s the\b",
        r"\bwhat does\b",
        r"\bshow me how\b",
        r"\bexplain (the|this)\b",
        r"\bhelp me (use|with|find)\b",
        r"\bin the app\b",
        r"\bon rovvy\b",
        r"\bwayra\b",
    )

    if travel_strong and not app_strong:
        return WayraMode.TRAVEL
    if app_strong and not travel_strong:
        return WayraMode.APP_GUIDE

    # Mixed: "plan a weekend trip" → travel; "plan page" → app
    if _has_any(q, r"\bplan page\b", r"\bplan tab\b") or (
        "plan" in q.split() and _has_any(q, r"\bwhat is\b", r"\bwhat s\b", r"\bfor\b", r"\bexplain\b")
    ):
        return WayraMode.APP_GUIDE

    if travel_strong:
        return WayraMode.TRAVEL

    # Weak signals: destination/country names without app verbs
    if _has_any(
        q,
        r"\b(japan|tokyo|kyoto|europe|beach|mountain|abroad)\b",
        r"\bdestination\b",
        r"\bgetaway\b",
    ) and not _has_any(q, r"\b(create|delete|invite|notification|poll|split|setting|profile)\b"):
        return WayraMode.TRAVEL

    return WayraMode.APP_GUIDE


def resolve_app_intent(message: str) -> AppIntent | None:
    """
    Resolve a specific App Guide intent. Group beats trip; notifications beat profile/settings.
    """
    q = normalize_query(message)
    if not q:
        return None

    # --- Highest specificity: explicit phrases ---
    if _has_any(q, r"\bplan page\b", r"\bplan tab\b") or (
        re.search(r"\bplan\b", q) and _has_any(q, r"\bwhat is\b", r"\bwhat s\b", r"\bwhat for\b", r"\bused for\b", r"\bexplain\b")
    ):
        return AppIntent.PLAN_PAGE

    if _has_any(
        q,
        r"\bnotification settings?\b",
        r"\bnotification preferences?\b",
        r"\balert settings?\b",
    ):
        return AppIntent.NOTIFICATION_SETTINGS

    if _has_any(
        q,
        r"\bnotification\b",
        r"\bnotifications\b",
        r"\bnotify\b",
        r"\balerts?\b",
        r"\bbell icon\b",
        r"\bsee my (notifications|alerts)\b",
    ):
        return AppIntent.NOTIFICATIONS

    # Create group BEFORE create trip (both may contain "create")
    if _has_any(
        q,
        r"\b(create|make|start|new|add)\b.{0,40}\bgroup\b",
        r"\bgroup\b.{0,40}\b(create|make|start|new)\b",
        r"\bnew group\b",
    ):
        return AppIntent.CREATE_GROUP

    if _has_any(
        q,
        r"\b(create|make|start|new|add)\b.{0,40}\btrip\b",
        r"\btrip\b.{0,40}\b(create|make|start|new)\b",
        r"\bnew trip\b",
    ):
        return AppIntent.CREATE_TRIP

    if _has_any(q, r"\binvite\b", r"\binvitation\b", r"\binvite (link|code|friends)\b"):
        return AppIntent.INVITES

    if _has_any(q, r"\bpoll\b", r"\bvote\b", r"\bvoting\b"):
        return AppIntent.POLLS

    if _has_any(q, r"\bsplit\b", r"\bexpense\b", r"\bbalance\b", r"\bsettle\b", r"\bowe\b"):
        return AppIntent.SPLITS

    if _has_any(
        q,
        r"\blive\b",
        r"\bmeet point\b",
        r"\bmeeting point\b",
        r"\blocation shar",
        r"\bshare (my )?location\b",
        r"\bcountdown\b",
        r"\btimer\b",
    ):
        return AppIntent.LIVE_MAP

    if _has_any(q, r"\bbuddy trip\b", r"\bbuddy travel\b", r"\bjoin a trip\b"):
        return AppIntent.BUDDY_TRIPS

    if _has_any(q, r"\bexplore\b", r"\bdiscover\b", r"\bsaved places\b", r"\bsave (a )?destination\b"):
        return AppIntent.EXPLORE

    if _has_any(q, r"\bmemories\b", r"\bposts\b", r"\bphoto\b", r"\balbum\b"):
        return AppIntent.MEMORIES

    if _has_any(q, r"\bprofile\b", r"\bavatar\b", r"\bbio\b"):
        return AppIntent.PROFILE

    if _has_any(q, r"\bsetting\b", r"\bpassword\b", r"\baccount\b", r"\blogin\b", r"\bsubscription\b"):
        return AppIntent.SETTINGS

    return None


def resolve_app_guide_message(message: str, page: str) -> str | None:
    intent = resolve_app_intent(message)
    if intent is not None:
        return APP_INTENT_RESPONSES[intent]
    return None


def contextual_app_fallback(page: str, active_tab: str | None = None) -> str:
    """Page-aware menu when App Guide intent is unclear."""
    p = (page or "dashboard").replace("_", "/").strip("/") or "dashboard"
    tab = (active_tab or "").strip()

    if p.startswith("dashboard") or p == "":
        return (
            "On your command center you can start a trip, open Travel Hub for groups, "
            "check open polls and splits, tap the bell for notifications, or open Plan to book transport. "
            "Tell me which you want—groups, trips, Plan, polls, expenses, Live map, or Explore."
        )
    if p.startswith("plan") or p in ("flights", "hotels", "routes", "buses"):
        return (
            "You're in Plan—use Flights, Hotels, Routes, or Buses from the sidebar to compare options. "
            "Ask me how to search any tab, or switch to a trip to align bookings with your group."
        )
    if p.startswith("explore") or p.startswith("activities"):
        return (
            "Explore is for discovery—filter by vibe, save places you love, and send ideas to a trip poll. "
            "Buddy Trips and Events are under Explore and Group when you're ready to coordinate."
        )
    if p.startswith("group") or p.startswith("travel-hub") or p.startswith("buddy") or p.startswith("live"):
        return (
            "This area is for people moving together—Travel Hub for chat and invites, Buddy Trips to find companions, "
            "Live for maps and meet points. What should we set up first?"
        )
    if p.startswith("profile") or p.startswith("settings"):
        return (
            "Profile and Settings cover your identity, avatar, security, and notification preferences. "
            "Say if you want to edit your profile, change alerts, or upgrade your plan."
        )
    if tab:
        return (
            f"You're on /{p} ({tab}). I can explain trips, groups, Plan, polls, splits, notifications, "
            "Live coordination, or Explore—what should we do next?"
        )
    return (
        f"You're on /{p}. I can walk you through groups, trips, Plan bookings, polls, splits, "
        "notifications (bell icon), Live map, or Explore—pick one and I'll give exact taps."
    )


def _context_city(context: dict[str, Any] | None) -> str | None:
    if not context:
        return None
    for key in ("city", "home_city", "location", "origin"):
        val = context.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    pathname = context.get("pathname")
    if isinstance(pathname, str) and "chicago" in pathname.lower():
        return "Chicago"
    return None


def travel_fallback_message(message: str, context: dict[str, Any] | None = None) -> str | None:
    """Curated travel ideas when live LLM is unavailable."""
    q = normalize_query(message)
    if not q:
        return None

    prefix = (
        "Live travel AI is taking longer than usual, but here are a few ideas to get you started:\n\n"
    )

    if _has_any(q, r"\bjapan\b", r"\btokyo\b", r"\bkyoto\b"):
        body = (
            "Tokyo — neighborhoods, food halls, and modern culture.\n"
            "Kyoto — temples, gardens, and traditional streets.\n"
            "Osaka — street food and easy day trips.\n"
            "Hiroshima — history plus Miyajima island.\n"
            "Hokkaido — nature, skiing, and cooler summer escapes.\n\n"
            "Save favorites in Explore, then run a group poll to pick bases and dates."
        )
        return prefix + body

    if _has_any(q, r"\bweekend\b", r"\bgetaway\b", r"\bshort trip\b", r"\bweekend trip\b"):
        city = (_context_city(context) or "").lower()
        if "chicago" in city or _has_any(q, r"\bchicago\b", r"\bmidwest\b", r"\bfrom chicago\b"):
            body = (
                "Milwaukee — lakefront, breweries, and easy train access.\n"
                "Lake Geneva — resort town and lake days within a couple of hours.\n"
                "Galena — historic Main Street and bluff-country scenery.\n"
                "Door County — coastal villages, cherries, and slow weekends.\n"
                "Nashville — live music and food if you want a longer hop.\n\n"
                "Sketch dates in a new trip, then poll your group before you book."
            )
        else:
            body = (
                "Pick a radius you are willing to drive or ride: a nearby city for food and culture, "
                "a lake or coast for outdoors, or a small historic town for a slower pace.\n\n"
                "In Rovvy, create a weekend trip, drop two or three options in a poll, and book from Plan once you align."
            )
        return prefix + body

    if _has_any(q, r"\bbeach\b", r"\bcoast\b", r"\bsea\b"):
        body = (
            "Look for shoulder-season beach towns with walkable centers, one water activity, "
            "and a backup indoor plan for rain.\n\n"
            "Save shore spots in Explore, then attach them to your trip map for the group."
        )
        return prefix + body

    if _has_any(q, r"\bmountain\b", r"\bhike\b", r"\btrek\b"):
        body = (
            "Choose elevation and daily mileage your group agrees on, check shoulder-season weather, "
            "and book lodging near trailheads early.\n\n"
            "Use Live meet points on hike day so everyone starts from the same pin."
        )
        return prefix + body

    if _has_any(q, r"\bfood\b", r"\brestaurant\b", r"\bculinary\b"):
        body = (
            "Anchor one must-try meal, one casual local spot, and one market or food hall—"
            "that keeps groups happy without over-planning.\n\n"
            "Save pins on the map and split the tab in Expenses when you settle up."
        )
        return prefix + body

    if _has_any(q, r"\bsuggest\b", r"\brecommend\b", r"\bdestination\b", r"\bwhere should i go\b"):
        body = (
            "Name your month, budget, and how far you will travel—city breaks favor museums and food, "
            "coasts favor weather windows, mountains favor gear and lodging near trails.\n\n"
            "Try Explore for inspiration, then vote in a trip poll before anyone books flights."
        )
        return prefix + body

    return None


def degraded_message(
    message: str,
    page: str,
    active_tab: str | None,
    context: dict[str, Any] | None,
    *,
    prefer_travel: bool,
) -> str:
    if prefer_travel:
        travel = travel_fallback_message(message, context)
        if travel:
            return travel
    app = resolve_app_guide_message(message, page)
    if app:
        return app
    if prefer_travel:
        return (
            "Live travel AI is taking longer than usual. Try a shorter question, "
            "or open Explore and Plan while I catch up."
        )
    return contextual_app_fallback(page, active_tab)
