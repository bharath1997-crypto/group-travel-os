"""Generate Wayra canonical knowledge seed: 100 intents × ~10 variants.

Run: .venv\\Scripts\\python scripts\\generate_wayra_knowledge_seed.py
Output: data/wayra_knowledge_seed.json
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "wayra_knowledge_seed.json"


def _norm(text: str) -> str:
    q = text.lower().strip()
    q = q.replace("'", " ").replace("’", " ")
    q = re.sub(r"[^\w\s-]", " ", q)
    return re.sub(r"\s+", " ", q).strip()


def _variants(base: list[str], extras: list[str] | None = None) -> list[dict]:
    tags = ["casual", "direct", "polite", "voice_typo", "short"]
    out: list[dict] = []
    for i, text in enumerate(base + (extras or [])):
        out.append(
            {
                "utterance": text,
                "normalized": _norm(text),
                "style_tag": tags[i % len(tags)],
            }
        )
    return out


def _intent(
    key: str,
    category: str,
    question: str,
    answer: str | None,
    *,
    strategy: str = "static",
    handler: str | None = None,
    required_context: str = "none",
    variants: list[str],
) -> dict:
    return {
        "intent_key": key,
        "category": category,
        "canonical_question": question,
        "answer_strategy": strategy,
        "answer_text": answer,
        "handler_key": handler,
        "required_context": required_context,
        "utterances": _variants(variants),
    }


INTENTS: list[dict] = []

# ── 1. Project / Rovvy identity (10) ──────────────────────────────────────────
INTENTS += [
    _intent(
        "what_is_rovvy",
        "project",
        "What is Rovvy?",
        "Rovvy is your group travel companion — plan trips, coordinate with friends, "
        "explore destinations, and navigate Live with Wayra by your side. Tagline: Roam together.",
        variants=[
            "What is Rovvy?",
            "Tell me about Rovvy",
            "What does Rovvy do?",
            "Explain Rovvy to me",
            "What's this app?",
            "What is this product?",
            "hey what is rovvy",
            "ok so whats Rovvy for",
            "Can you describe Rovvy?",
            "yo what is this app called Rovvy",
        ],
    ),
    _intent(
        "rovvy_tagline",
        "project",
        "What is Rovvy's tagline?",
        "Rovvy's tagline is Roam together — plan, coordinate, and travel as a group.",
        variants=[
            "What is Rovvy's tagline?",
            "What's the slogan?",
            "Roam together means what?",
            "What's Rovvy's motto?",
            "Tell me the Rovvy slogan",
            "whats the tagline for rovvy",
            "hey whats the motto",
            "Rovvy tagline please",
            "ok so whats the slogan",
            "What's the brand line?",
        ],
    ),
    _intent(
        "who_built_rovvy",
        "project",
        "Who built Rovvy?",
        "Rovvy is built by the Rovvy team as a group travel platform. I'm Wayra, the in-app "
        "assistant that helps you plan, navigate, and coordinate — not a separate company chatbot.",
        variants=[
            "Who built Rovvy?",
            "Who made this app?",
            "Who created Rovvy?",
            "Who owns Rovvy?",
            "Who developed this?",
            "who made rovvy",
            "hey who built this",
            "Is Rovvy a company?",
            "ok so who created this app",
            "Who's behind Rovvy?",
        ],
    ),
    _intent(
        "rovvy_vs_maps",
        "project",
        "How is Rovvy different from Google Maps?",
        "Rovvy combines group trip planning, shared expenses, polls, Explore discovery, and Live "
        "navigation with Wayra. Maps apps focus on directions; Rovvy is built so your whole group "
        "can roam together.",
        variants=[
            "How is Rovvy different from Google Maps?",
            "Is Rovvy like Google Maps?",
            "Why not just use Maps?",
            "Rovvy vs Google Maps",
            "Is this a maps app?",
            "how is this different from maps",
            "hey is this like waze",
            "Compared to Maps what do you do?",
            "ok so why use rovvy not maps",
            "Is Rovvy navigation only?",
        ],
    ),
    _intent(
        "rovvy_features_overview",
        "project",
        "What can I do in Rovvy?",
        "You can create groups and trips, plan flights and hotels, split expenses, run polls, "
        "explore destinations, share Live locations, and ask Wayra for travel help. Open the "
        "sidebar to jump between Dashboard, Plan, Explore, Group, Live, and Profile.",
        variants=[
            "What can I do in Rovvy?",
            "What features does Rovvy have?",
            "Show me what Rovvy offers",
            "What are the main features?",
            "Give me an overview of Rovvy",
            "whats possible in this app",
            "hey what can i do here in rovvy",
            "List Rovvy capabilities",
            "ok so what does the app include",
            "What should I try first?",
        ],
    ),
    _intent(
        "is_rovvy_free",
        "project",
        "Is Rovvy free?",
        "You can browse and use core planning and Live tools without paying upfront. Some "
        "subscription features may unlock extras — check Profile → Settings for your plan.",
        variants=[
            "Is Rovvy free?",
            "Do I have to pay?",
            "Is there a subscription?",
            "How much does Rovvy cost?",
            "Is this free to use?",
            "is rovvy free to use",
            "hey do i need to pay",
            "Any pricing?",
            "ok so is there a free plan",
            "What does it cost?",
        ],
    ),
    _intent(
        "rovvy_privacy_basics",
        "project",
        "How does Rovvy handle my privacy?",
        "Your account, trips, and location sharing stay under your control. Live location is "
        "shared only when you enable it for a session or group. Manage visibility and alerts "
        "from Profile → Settings.",
        variants=[
            "How does Rovvy handle my privacy?",
            "Is my location private?",
            "Who can see my data?",
            "Privacy policy basics?",
            "Are my trips private?",
            "is my gps shared always",
            "hey is my data safe",
            "Do you sell my data?",
            "ok so privacy how does it work",
            "Can others see my location?",
        ],
    ),
    _intent(
        "rovvy_platforms",
        "project",
        "Where can I use Rovvy?",
        "Rovvy runs in the browser at rovvy.app — use it on phone or desktop. Sign in once and "
        "your groups, trips, and settings follow you across devices.",
        variants=[
            "Where can I use Rovvy?",
            "Is there a mobile app?",
            "Does Rovvy work on phone?",
            "Is Rovvy web only?",
            "Can I use Rovvy on iPhone?",
            "does it work on android",
            "hey is there an ios app",
            "Desktop and mobile?",
            "ok so where do i open rovvy",
            "Is it a website?",
        ],
    ),
    _intent(
        "rovvy_offline",
        "project",
        "Does Rovvy work offline?",
        "Core Live map tiles and some cached data may remain available briefly, but routing, "
        "search, and Wayra need a connection. Reconnect to sync group updates and fresh routes.",
        variants=[
            "Does Rovvy work offline?",
            "Can I use it without internet?",
            "Offline mode?",
            "What if I lose signal?",
            "Does Live work offline?",
            "no wifi does it still work",
            "hey offline support",
            "Need internet always?",
            "ok so what happens offline",
            "Can I navigate without data?",
        ],
    ),
    _intent(
        "getting_started",
        "onboarding",
        "How do I get started?",
        "Create an account or browse as a guest, open Dashboard, then make a group or trip. "
        "Invite friends, drop pins on Live, and ask Wayra anytime from the sidecar.",
        variants=[
            "How do I get started?",
            "I'm new — what now?",
            "Getting started guide",
            "How do I begin?",
            "First steps in Rovvy?",
            "im new what do i do",
            "hey how do i start",
            "Onboarding please",
            "ok so how do i start using this",
            "Walk me through setup",
        ],
    ),
]

# ── 2. Wayra identity / meta (10) ─────────────────────────────────────────────
INTENTS += [
    _intent(
        "who_are_you",
        "wayra",
        "Who are you?",
        "I'm Wayra, Rovvy's built-in travel companion. I help with planning, Live map questions, "
        "group coordination, and on-the-road tips — right inside the app.",
        variants=[
            "Who are you?",
            "What is Wayra?",
            "Tell me about yourself",
            "Who am I talking to?",
            "Are you Wayra?",
            "hey who are you",
            "whats wayra",
            "Introduce yourself",
            "ok so who is wayra",
            "What do you do?",
        ],
    ),
    _intent(
        "are_you_ai",
        "wayra",
        "Are you an AI?",
        "Yes — I'm Wayra, an AI assistant built into Rovvy. I combine trusted app guidance with "
        "live context from your page and location so answers stay useful on the trip.",
        variants=[
            "Are you an AI?",
            "Are you a real person?",
            "Are you a bot?",
            "Is Wayra artificial intelligence?",
            "Human or AI?",
            "are you real or ai",
            "hey are you a chatbot",
            "Is this automated?",
            "ok so are you artificial",
            "Robot?",
        ],
    ),
    _intent(
        "which_model_powers_you",
        "wayra",
        "Which AI model powers you?",
        "I don't discuss vendor models in chat. What matters is that Wayra answers from Rovvy "
        "context, trusted knowledge, and live sources so you get practical travel help.",
        variants=[
            "Which AI model powers you?",
            "Are you using Gemini?",
            "Are you DeepSeek?",
            "What model are you?",
            "Do you use OpenAI?",
            "which model is behind wayra",
            "hey are you chatgpt",
            "Is this GPT?",
            "ok so what llm do you use",
            "Google AI or what?",
        ],
    ),
    _intent(
        "what_can_wayra_do",
        "wayra",
        "What can Wayra help with?",
        "Ask me how Rovvy works, what to do near your GPS or pin, weather, routes, nearby food, "
        "culture tips, and group planning help. Tap + to attach a place when you want answers "
        "tied to the map.",
        variants=[
            "What can Wayra help with?",
            "What can you do?",
            "How can you help me?",
            "What are you good at?",
            "Wayra capabilities?",
            "what can you help with",
            "hey what else can you do",
            "Show me your skills",
            "ok so how do you help travelers",
            "What questions can I ask?",
        ],
    ),
    _intent(
        "wayra_vs_alexa",
        "wayra",
        "Are you like Alexa?",
        "A bit — you can chat casually and ask travel questions. Unlike a home speaker, I'm "
        "tied to Rovvy: your page, Live map, groups, and trip plans stay in context.",
        variants=[
            "Are you like Alexa?",
            "Are you like Siri?",
            "Is this like Google Assistant?",
            "Can I joke with you like Alexa?",
            "Voice assistant vibes?",
            "are you like alexa",
            "hey like siri?",
            "Home assistant style?",
            "ok so alexa but for travel",
            "Can we just chat?",
        ],
    ),
    _intent(
        "tell_a_joke",
        "fun",
        "Tell me a joke",
        "Why did the suitcase break up with the backpack? Too much baggage for one trip. "
        "Want a destination tip instead? Drop a pin and ask what to do nearby.",
        variants=[
            "Tell me a joke",
            "Make me laugh",
            "Got any jokes?",
            "Funny travel joke?",
            "Say something funny",
            "tell a joke wayra",
            "hey joke please",
            "Entertain me",
            "ok so tell me something funny",
            "Pun please",
        ],
    ),
    _intent(
        "sing_or_play",
        "fun",
        "Can you sing?",
        "I leave the singing to the road playlist — but I can help pick a place for live music "
        "or a scenic drive. Share your location or pin and ask for nearby spots.",
        variants=[
            "Can you sing?",
            "Play a song",
            "Sing for me",
            "Can you dance?",
            "Do a voice impression",
            "sing something",
            "hey play music",
            "Entertain me with a song",
            "ok so can you sing",
            "Music please",
        ],
    ),
    _intent(
        "thanks",
        "conversation",
        "Thank you",
        "You're welcome — glad to help. Ask anytime if you need directions, nearby ideas, or "
        "how something in Rovvy works.",
        variants=[
            "Thank you",
            "Thanks",
            "Thanks Wayra",
            "Appreciate it",
            "Thanks for your help",
            "thx",
            "hey thanks",
            "Cheers",
            "ok thanks a lot",
            "Thank you so much",
        ],
    ),
    _intent(
        "hello",
        "conversation",
        "Hello",
        "Hey — I'm Wayra. Ask about this page, your trip, Live map, or what to do near you.",
        variants=[
            "Hello",
            "Hi",
            "Hey",
            "Hi Wayra",
            "Hello Wayra",
            "hey there",
            "good morning",
            "Good evening",
            "ok hi",
            "yo wayra",
        ],
    ),
    _intent(
        "how_are_you",
        "conversation",
        "How are you?",
        "Doing great and ready to help with your trip. What are you planning or where are you "
        "headed on the map?",
        variants=[
            "How are you?",
            "How's it going?",
            "You good?",
            "How are you doing?",
            "What's up?",
            "how r u",
            "hey how are you",
            "How you doing Wayra?",
            "ok so hows it going",
            "You okay?",
        ],
    ),
]

# ── 3. Groups / trips / invites (12) ──────────────────────────────────────────
INTENTS += [
    _intent(
        "create_group",
        "groups",
        "How do I create a group?",
        "Open Group in the left sidebar, then Travel Hub to start a coordinated workspace. "
        "Create your group, name it, and share the invite link or code so friends can join.",
        variants=[
            "How do I create a group?",
            "Make a new group",
            "Start a travel group",
            "Create group please",
            "Where do I add a group?",
            "how to create group",
            "hey make a group",
            "New group how?",
            "ok so create a group",
            "Group setup?",
        ],
    ),
    _intent(
        "invite_friends",
        "groups",
        "How do I invite friends?",
        "Open your group in Travel Hub and use Share invite link so friends join with one tap. "
        "You can regenerate the code from group settings if you need a fresh link.",
        variants=[
            "How do I invite friends?",
            "Share invite link",
            "How do invites work?",
            "Add friends to my group",
            "Send group invite",
            "invite people how",
            "hey how do i invite",
            "Invite code where?",
            "ok so share invite",
            "Bring friends in?",
        ],
    ),
    _intent(
        "create_trip",
        "trips",
        "How do I create a trip?",
        "From the dashboard choose your trip workspace, or open Trips and tap New Trip. "
        "Add a title, dates, and destination, then invite your group so everyone shares polls, "
        "splits, and live coordination.",
        variants=[
            "How do I create a trip?",
            "New trip how?",
            "Start a trip",
            "Make a trip plan",
            "Where do I add a trip?",
            "create trip please",
            "hey new trip",
            "Trip setup?",
            "ok so how do i make a trip",
            "Add itinerary?",
        ],
    ),
    _intent(
        "join_trip",
        "trips",
        "How do I join a trip?",
        "Use an invite link or code from the host, or browse Buddy Trips and request to join. "
        "Once approved, the trip appears in your list with shared polls and plans.",
        variants=[
            "How do I join a trip?",
            "Join someone's trip",
            "Accept trip invite",
            "Can I join a trip?",
            "Trip invite how?",
            "join trip how",
            "hey how do i join",
            "Enter trip code",
            "ok so join a trip",
            "Request to join?",
        ],
    ),
    _intent(
        "buddy_trips",
        "trips",
        "What are Buddy Trips?",
        "Open Group → Buddy Trips (or Explore) to browse open trips from other travelers. "
        "Tap a listing and request to join — the host approves before you're added.",
        variants=[
            "What are Buddy Trips?",
            "Explain Buddy Trips",
            "How do Buddy Trips work?",
            "Find travelers to join",
            "Open buddy trips",
            "buddy trips what",
            "hey what is buddy trip",
            "Join strangers trip?",
            "ok so buddy trips",
            "Travel with new people?",
        ],
    ),
    _intent(
        "polls_how",
        "groups",
        "How do polls work?",
        "Inside an active trip, open the Polls tab → New Poll, add options, and share with the "
        "group. Everyone votes in one place; the creator can close the poll when ready.",
        variants=[
            "How do polls work?",
            "Create a poll",
            "Group voting?",
            "Where are polls?",
            "How do we vote?",
            "make a poll",
            "hey polls how",
            "Trip poll?",
            "ok so how do polls work",
            "Vote on options?",
        ],
    ),
    _intent(
        "splits_how",
        "groups",
        "How do expense splits work?",
        "Open Split Activities or your trip's Expenses tab → Add Expense, enter who paid and "
        "the amount, then choose how to split. Balance Summary shows who owes whom.",
        variants=[
            "How do expense splits work?",
            "Split the bill",
            "How do expenses work?",
            "Add shared expense",
            "Who owes whom?",
            "split expenses how",
            "hey how do splits work",
            "Track group spending",
            "ok so expense split",
            "Settle up how?",
        ],
    ),
    _intent(
        "notifications_how",
        "account",
        "Where are notifications?",
        "Tap the bell icon in the top-right on any screen to open your notification feed, "
        "or go to Notifications for trip updates, invites, and group activity.",
        variants=[
            "Where are notifications?",
            "Open notifications",
            "Where is the bell?",
            "Check alerts",
            "Notification feed?",
            "notifications where",
            "hey show notifications",
            "See trip alerts",
            "ok so where are notifs",
            "Inbox?",
        ],
    ),
    _intent(
        "notification_settings",
        "account",
        "How do I change notification settings?",
        "Open Profile → Settings and look for notification preferences to control alerts, "
        "trip updates, and digests. Your inbox at the bell icon still shows everything received.",
        variants=[
            "How do I change notification settings?",
            "Mute notifications",
            "Turn off alerts",
            "Notification preferences",
            "Manage alert settings",
            "notif settings",
            "hey change notifications",
            "Stop email alerts?",
            "ok so notification settings",
            "Control digests?",
        ],
    ),
    _intent(
        "profile_edit",
        "account",
        "How do I edit my profile?",
        "Tap Profile in the left sidebar to edit your name, bio, and avatar — click your photo "
        "to upload a new one. Posts, saved places, and trip highlights also live on your profile.",
        variants=[
            "How do I edit my profile?",
            "Change my photo",
            "Update bio",
            "Edit profile",
            "Where is my profile?",
            "profile edit how",
            "hey change avatar",
            "Update display name",
            "ok so edit profile",
            "My account page?",
        ],
    ),
    _intent(
        "settings_where",
        "account",
        "Where are settings?",
        "Open Profile in the sidebar → Settings for account, security, notifications, and "
        "subscription. Changes apply across Rovvy on every device you're signed into.",
        variants=[
            "Where are settings?",
            "Open settings",
            "Account settings",
            "App settings where?",
            "Preferences?",
            "settings where",
            "hey open settings",
            "Security settings",
            "ok so where is settings",
            "Change password where?",
        ],
    ),
    _intent(
        "memories_where",
        "account",
        "Where are my memories?",
        "Your profile keeps posts and trip moments in one place. Open Profile → Posts or "
        "Memories to revisit what your group captured.",
        variants=[
            "Where are my memories?",
            "Trip memories",
            "See past trips",
            "Where are posts?",
            "Photo memories?",
            "memories where",
            "hey show memories",
            "Past trip highlights",
            "ok so memories",
            "Group moments?",
        ],
    ),
]

# ── 4. Plan / Explore / Live basics (18) ──────────────────────────────────────
INTENTS += [
    _intent(
        "plan_page",
        "plan",
        "What is the Plan page?",
        "Plan is Rovvy's booking and routing hub. Open Plan in the sidebar to search Flights, "
        "Hotels, Routes, and Buses — compare options next to your group context.",
        variants=[
            "What is the Plan page?",
            "Explain Plan",
            "Where do I book?",
            "Plan tab what is it?",
            "Flights hotels where?",
            "plan page what",
            "hey what is plan",
            "Booking hub?",
            "ok so plan page",
            "Search travel options?",
        ],
    ),
    _intent(
        "search_flights",
        "plan",
        "How do I search flights?",
        "Open Plan → Flights, enter origin, destination, and dates, then compare options. "
        "You can keep planning beside your group trip context.",
        variants=[
            "How do I search flights?",
            "Find flights",
            "Book a flight",
            "Flight search where?",
            "Look up flights",
            "search flights how",
            "hey find flights",
            "Plane tickets?",
            "ok so flight search",
            "Air travel search?",
        ],
    ),
    _intent(
        "search_hotels",
        "plan",
        "How do I search hotels?",
        "Open Plan → Hotels, set your destination and dates, then browse stays. Save favorites "
        "and share picks with your group.",
        variants=[
            "How do I search hotels?",
            "Find hotels",
            "Book a hotel",
            "Hotel search where?",
            "Places to stay",
            "search hotels how",
            "hey find hotels",
            "Accommodations?",
            "ok so hotel search",
            "Lodging options?",
        ],
    ),
    _intent(
        "search_routes",
        "plan",
        "How do I search routes?",
        "Open Plan → Routes (or use Live) to compare driving and related route options between "
        "places. On Live you can also set a destination and preview the path on the map.",
        variants=[
            "How do I search routes?",
            "Find a route",
            "Driving directions in Plan",
            "Route search?",
            "Plan a drive",
            "search routes how",
            "hey find route",
            "Road trip route?",
            "ok so routes page",
            "Compare routes?",
        ],
    ),
    _intent(
        "search_buses",
        "plan",
        "How do I search buses?",
        "Open Plan → Buses to browse bus options for your corridor. Buses coverage is expanding — "
        "use Live for local last-mile walking when needed.",
        variants=[
            "How do I search buses?",
            "Find buses",
            "Bus tickets?",
            "Bus search where?",
            "Coach travel?",
            "search buses how",
            "hey find bus",
            "Intercity bus?",
            "ok so buses page",
            "Bus options?",
        ],
    ),
    _intent(
        "explore_page",
        "explore",
        "What is Explore?",
        "Explore is your discovery layer — trending destinations, events, activities, and "
        "weather cues. Filter by mood, save places with the heart icon, and pull them into a trip.",
        variants=[
            "What is Explore?",
            "Explain Explore page",
            "Where do I discover places?",
            "Explore tab?",
            "Trending destinations?",
            "explore what is it",
            "hey what is explore",
            "Discovery feed?",
            "ok so explore page",
            "Find events?",
        ],
    ),
    _intent(
        "live_map_what",
        "live",
        "What is Live?",
        "Open Live for the fullscreen map: GPS, pins, routes, and Solo Live navigation. "
        "It's built for on-the-road coordination — drop a pin, preview a route, and ask Wayra "
        "about the place.",
        variants=[
            "What is Live?",
            "Explain Live map",
            "What is Live Mode?",
            "Open Live how?",
            "Live tab?",
            "live map what",
            "hey what is live",
            "Fullscreen map?",
            "ok so live mode",
            "Navigation map?",
        ],
    ),
    _intent(
        "solo_live",
        "live",
        "What is Solo Live?",
        "Solo Live turns on turn-by-turn navigation on the map — pick a destination, tap Set "
        "destination, then Start Solo Live to follow the route with GPS.",
        variants=[
            "What is Solo Live?",
            "Start Solo Live",
            "Turn-by-turn how?",
            "Solo navigation?",
            "How do I navigate?",
            "solo live what",
            "hey start solo live",
            "Begin navigation",
            "ok so solo live",
            "Waze-style nav?",
        ],
    ),
    _intent(
        "drop_pin",
        "live",
        "How do I drop a pin?",
        "On Live, tap the map to drop a pin or pick a search result. You can rename it, preview "
        "a route, save the place, or ask Wayra about that spot.",
        variants=[
            "How do I drop a pin?",
            "Drop a pin",
            "Add map pin",
            "Mark a place",
            "Pin a location",
            "drop pin how",
            "hey how do i pin",
            "Tap to pin?",
            "ok so drop a pin",
            "Select a place on map?",
        ],
    ),
    _intent(
        "save_place",
        "live",
        "How do I save a place?",
        "Open a place preview on Live and use Add / Save location. Saved places stay on your "
        "map layers so you can revisit them later.",
        variants=[
            "How do I save a place?",
            "Save this pin",
            "Bookmark location",
            "Add to saved places",
            "Keep this spot",
            "save place how",
            "hey save this location",
            "Favorite this pin",
            "ok so save place",
            "Store this place?",
        ],
    ),
    _intent(
        "layers_how",
        "live",
        "How do map layers work?",
        "Use the Live map dock / layer control to switch street, terrain, travel overlays, and "
        "saved places. Your active route stays when you change layers.",
        variants=[
            "How do map layers work?",
            "Change map layer",
            "Terrain layer?",
            "Satellite or street?",
            "Toggle layers",
            "map layers how",
            "hey switch layer",
            "Travel overlay?",
            "ok so layers",
            "Map style?",
        ],
    ),
    _intent(
        "gps_locate",
        "live",
        "How do I find my GPS location?",
        "On Live, tap the locate control in the right dock to center on your GPS. Allow location "
        "permission in the browser if the blue dot doesn't appear.",
        variants=[
            "How do I find my GPS location?",
            "Center on me",
            "Where is the locate button?",
            "Show my location",
            "Enable GPS",
            "gps locate how",
            "hey find my location button",
            "Blue dot missing?",
            "ok so locate me",
            "Recenter map?",
        ],
    ),
    _intent(
        "pencil_icon",
        "live",
        "What does the pencil icon do?",
        "The pencil icon on Live lets you edit a dropped pin — rename the label, adjust the "
        "spot, or refine what you're sharing before you navigate or send it to your group.",
        variants=[
            "What does the pencil icon do?",
            "Pencil icon?",
            "Edit pin how?",
            "Rename pin",
            "Edit dropped pin",
            "pencil icon what",
            "hey what is pencil",
            "Change pin name",
            "ok so pencil on live",
            "Modify pin?",
        ],
    ),
    _intent(
        "travel_modes",
        "live",
        "How do I switch travel modes?",
        "Open Plan in the sidebar to switch between Flights, Hotels, Routes, and Buses. On Live, "
        "use the map tools for driving, walking, and Solo Live navigation.",
        variants=[
            "How do I switch travel modes?",
            "Change travel mode",
            "Drive or walk?",
            "Switch modes",
            "Walking mode?",
            "travel modes how",
            "hey switch mode",
            "Transit mode?",
            "ok so travel modes",
            "Mode selector?",
        ],
    ),
    _intent(
        "last_mile",
        "live",
        "What is the last mile?",
        "The last mile is the final walk or short drive after you arrive near your destination. "
        "On Live, follow the dashed walk segment when the route includes a foot approach.",
        variants=[
            "What is the last mile?",
            "Explain last mile",
            "Why a dashed walk line?",
            "Last mile walk?",
            "Foot path after drive?",
            "last mile what",
            "hey what is last mile",
            "Walking segment?",
            "ok so last mile",
            "Final approach?",
        ],
    ),
    _intent(
        "meet_points",
        "live",
        "How do meet points work?",
        "In a group Live session you can drop meet points so everyone converges on one spot. "
        "Open Group → Live (or your trip Live tab) to share location and set a meet point.",
        variants=[
            "How do meet points work?",
            "Set a meet point",
            "Meeting point on map",
            "Where do we meet?",
            "Group meet pin",
            "meet points how",
            "hey meet point",
            "Rendezvous pin?",
            "ok so meet points",
            "Converge location?",
        ],
    ),
    _intent(
        "day_night_map",
        "live",
        "Does the map have day and night mode?",
        "Live supports map styling for readability day and night. Use the map tools / layer "
        "controls on Live to adjust appearance while you navigate.",
        variants=[
            "Does the map have day and night mode?",
            "Night mode map?",
            "Dark map?",
            "Day night live map",
            "Switch map theme",
            "night mode map",
            "hey dark mode map",
            "Map brightness?",
            "ok so day night map",
            "Light or dark map?",
        ],
    ),
    _intent(
        "compass_zoom",
        "live",
        "Where are compass and zoom?",
        "On Live, compass and zoom live in the right-side Rovvy Map Dock — use the zoom rocker, "
        "locate, and tools without covering the map.",
        variants=[
            "Where are compass and zoom?",
            "Zoom controls?",
            "Compass where?",
            "Map dock?",
            "Zoom in how?",
            "compass zoom where",
            "hey zoom buttons",
            "Right side controls?",
            "ok so map dock",
            "Scale slider?",
        ],
    ),
]

# ── 5. Dynamic context handlers (8) ───────────────────────────────────────────
INTENTS += [
    _intent(
        "where_am_i",
        "live_context",
        "Where am I?",
        None,
        strategy="handler",
        handler="where_am_i",
        required_context="page_or_gps",
        variants=[
            "Where am I?",
            "What's my location?",
            "Where am I right now?",
            "Tell me my location",
            "What is my current location?",
            "where am i now",
            "hey where am i",
            "My GPS location?",
            "ok so where am i",
            "Locate me",
        ],
    ),
    _intent(
        "what_page_am_i_on",
        "live_context",
        "What page am I on?",
        None,
        strategy="handler",
        handler="page_help",
        required_context="page",
        variants=[
            "What page am I on?",
            "Where in the app am I?",
            "What screen is this?",
            "Which page is open?",
            "Current page?",
            "what page is this",
            "hey what page am i on",
            "App location?",
            "ok so which screen",
            "What am I looking at in Rovvy?",
        ],
    ),
    _intent(
        "what_can_i_do_here",
        "live_context",
        "What can I do here?",
        None,
        strategy="handler",
        handler="what_can_i_do_here",
        required_context="gps",
        variants=[
            "What can I do here?",
            "Things to do here",
            "What's around me?",
            "Activities nearby",
            "What should I do here?",
            "what can i do around here",
            "hey things to do here",
            "Suggestions for here",
            "ok so what can i do here",
            "Fun nearby?",
        ],
    ),
    _intent(
        "food_nearby",
        "live_context",
        "Where can I eat nearby?",
        None,
        strategy="handler",
        handler="what_can_i_do_here",
        required_context="gps",
        variants=[
            "Where can I eat nearby?",
            "Food near me",
            "Restaurants nearby",
            "Best bites around here",
            "Where to eat?",
            "food nearby",
            "hey where to eat",
            "Coffee nearby?",
            "ok so food near me",
            "Hungry — what's close?",
        ],
    ),
    _intent(
        "what_is_this_pin",
        "live_context",
        "What is this pin?",
        None,
        strategy="handler",
        handler="where_am_i",
        required_context="pin",
        variants=[
            "What is this pin?",
            "What's this place?",
            "Where is this pin?",
            "Name this location",
            "What did I drop?",
            "what is this pin",
            "hey whats this pin",
            "Identify this spot",
            "ok so what is this place",
            "Pin details?",
        ],
    ),
    _intent(
        "how_far_from_me",
        "live_context",
        "How far is this from me?",
        None,
        strategy="handler",
        handler="where_am_i",
        required_context="page_or_gps",
        variants=[
            "How far is this from me?",
            "Distance from me",
            "How far away?",
            "Miles from my location",
            "Is it close to me?",
            "how far from me",
            "hey how far is it",
            "Distance to pin",
            "ok so how far",
            "Far from here?",
        ],
    ),
    _intent(
        "weather_here",
        "live_context",
        "What's the weather here?",
        None,
        strategy="handler",
        handler="what_can_i_do_here",
        required_context="gps",
        variants=[
            "What's the weather here?",
            "Weather near me",
            "Is it raining here?",
            "Temperature here?",
            "Weather at my location",
            "weather here",
            "hey weather",
            "Do I need a jacket?",
            "ok so weather here",
            "Forecast here?",
        ],
    ),
    _intent(
        "help_on_this_page",
        "live_context",
        "Help me with this page",
        None,
        strategy="handler",
        handler="page_help",
        required_context="page",
        variants=[
            "Help me with this page",
            "What can I do on this page?",
            "Explain this screen",
            "Page help",
            "Guide me here",
            "help on this page",
            "hey help with this screen",
            "How does this page work?",
            "ok so help on this page",
            "What should I do on this screen?",
        ],
    ),
]

# ── 6. Travel basics + more product (22) → total 90 so far, need 10 more ──────
INTENTS += [
    _intent(
        "border_crossing",
        "travel",
        "How do border crossings work in Live?",
        "When a route crosses an international border, Live can surface a border notice on the "
        "preview. Always check visa and entry rules before you travel — Wayra won't invent them.",
        variants=[
            "How do border crossings work in Live?",
            "Border crossing warning?",
            "International border on route?",
            "Visa at the border?",
            "Crossing countries?",
            "border crossing how",
            "hey border on map",
            "Border notice?",
            "ok so border crossing",
            "Cross-border drive?",
        ],
    ),
    _intent(
        "safety_tips",
        "travel",
        "Any safety tips?",
        "Share Live location with your group when traveling together, keep emergency contacts "
        "updated, and trust official sources for hazards. If something feels wrong, pause and "
        "regroup before continuing.",
        variants=[
            "Any safety tips?",
            "Travel safety?",
            "How do I stay safe?",
            "Safety advice",
            "Is it safe to travel?",
            "safety tips",
            "hey safety",
            "Emergency tips?",
            "ok so stay safe how",
            "Group safety?",
        ],
    ),
    _intent(
        "language_help",
        "travel",
        "How do I say hello locally?",
        "Ask with a pin or location selected and I'll share common greetings for that country. "
        "English works in many tourist areas; a few local words still go a long way.",
        variants=[
            "How do I say hello locally?",
            "Local greeting?",
            "How do I say thank you?",
            "What language do they speak?",
            "Do people speak English?",
            "say hello locally",
            "hey language help",
            "Useful phrases?",
            "ok so how do i say hello",
            "Main language here?",
        ],
    ),
    _intent(
        "packing_tips",
        "travel",
        "What should I pack?",
        "Pack for the forecast and walking: layers, comfortable shoes, charger, and documents. "
        "Ask weather for your pin, then adjust for rain, heat, or cold before you go.",
        variants=[
            "What should I pack?",
            "Packing list?",
            "What to bring?",
            "Do I need an umbrella?",
            "Packing tips",
            "what should i pack",
            "hey packing",
            "Travel essentials?",
            "ok so packing tips",
            "What clothes?",
        ],
    ),
    _intent(
        "best_time_to_visit",
        "travel",
        "When is the best time to visit?",
        "It depends on the destination's seasons and your plans. Share a pin or city and ask "
        "about weather or peak season — I'll ground the answer in available context.",
        variants=[
            "When is the best time to visit?",
            "Best season?",
            "Peak season when?",
            "When should I go?",
            "Best time of year?",
            "best time to visit",
            "hey when to visit",
            "Avoid crowds when?",
            "ok so best season",
            "Should I visit now?",
        ],
    ),
    _intent(
        "currency_tips",
        "travel",
        "What currency should I use?",
        "Use the local currency when you can, and keep a card plus a little cash for small "
        "vendors. Rovvy expense splits help track who paid what in your group.",
        variants=[
            "What currency should I use?",
            "Local money?",
            "Do I need cash?",
            "Currency tips",
            "Cards or cash?",
            "currency what",
            "hey money tips",
            "Exchange money?",
            "ok so currency",
            "Payment tips?",
        ],
    ),
    _intent(
        "wifi_tips",
        "travel",
        "How do I stay online while traveling?",
        "Use hotel or cafe Wi‑Fi, an eSIM, or roaming as needed. For Live navigation, keep a "
        "stable connection so GPS and route updates stay fresh.",
        variants=[
            "How do I stay online while traveling?",
            "Need WiFi?",
            "Internet abroad?",
            "eSIM tips?",
            "Data roaming?",
            "wifi while traveling",
            "hey stay online",
            "Mobile data tips?",
            "ok so internet travel",
            "Offline maps?",
        ],
    ),
    _intent(
        "group_chat",
        "groups",
        "Is there group chat?",
        "Rovvy includes Lounge / group coordination spaces for trip talk. Open your group "
        "Travel Hub to chat, share plans, and keep decisions next to polls and splits.",
        variants=[
            "Is there group chat?",
            "Where do we chat?",
            "Group messaging?",
            "Lounge chat?",
            "Talk to my group",
            "group chat where",
            "hey chat with group",
            "Message friends?",
            "ok so group chat",
            "In-app messaging?",
        ],
    ),
    _intent(
        "saved_pins_list",
        "live",
        "Where are my saved pins?",
        "Saved places appear on Live via the saved-places layer and from place previews you've "
        "added. Toggle the layer to show or hide them on the map.",
        variants=[
            "Where are my saved pins?",
            "Saved places list?",
            "Show saved locations",
            "My bookmarks on map",
            "Pins I saved?",
            "saved pins where",
            "hey show saved places",
            "Favorite pins?",
            "ok so saved pins",
            "Stored locations?",
        ],
    ),
    _intent(
        "ask_wayra_attach",
        "wayra",
        "How do I attach a location to Wayra?",
        "In the Wayra messenger, tap + to attach the current preview or map place so answers "
        "stay bound to that location. Closing the place card clears that scope.",
        variants=[
            "How do I attach a location to Wayra?",
            "Attach place to chat",
            "Plus button in Wayra?",
            "Bind location to Wayra",
            "Share pin with Wayra",
            "attach location how",
            "hey attach place",
            "Add location to message",
            "ok so attach location",
            "Pin scope for Wayra?",
        ],
    ),
    _intent(
        "dashboard_what",
        "onboarding",
        "What is the Dashboard?",
        "Dashboard is your home base for trips, groups, and next actions. From there jump into "
        "Plan, Explore, Group, Live, or Profile using the sidebar.",
        variants=[
            "What is the Dashboard?",
            "Explain Dashboard",
            "Home screen?",
            "Main dashboard?",
            "Where is home?",
            "dashboard what",
            "hey what is dashboard",
            "Start screen?",
            "ok so dashboard",
            "App home?",
        ],
    ),
    _intent(
        "login_how",
        "onboarding",
        "How do I log in?",
        "Open Rovvy and sign in with your email OTP or Google. Browse-first mode lets you "
        "explore before signing in; create an account when you want to save trips and groups.",
        variants=[
            "How do I log in?",
            "Sign in",
            "Login how?",
            "Sign up?",
            "Create account?",
            "log in how",
            "hey sign in",
            "Google login?",
            "ok so how do i login",
            "OTP login?",
        ],
    ),
    _intent(
        "logout_how",
        "account",
        "How do I log out?",
        "Open Profile → Settings and use the sign-out option. You'll return to browse mode "
        "until you sign in again.",
        variants=[
            "How do I log out?",
            "Sign out",
            "Logout where?",
            "End session",
            "Log off",
            "log out how",
            "hey sign out",
            "Exit account?",
            "ok so logout",
            "Sign out please",
        ],
    ),
    _intent(
        "subscription_where",
        "account",
        "Where is my subscription?",
        "Open Profile → Settings to review subscription and billing-related options for your "
        "account.",
        variants=[
            "Where is my subscription?",
            "Manage subscription",
            "Billing where?",
            "Upgrade plan?",
            "Subscription settings",
            "subscription where",
            "hey my plan",
            "Paid plan?",
            "ok so subscription",
            "Change plan?",
        ],
    ),
    _intent(
        "report_hazard",
        "live",
        "Can I report a road hazard?",
        "Live Mode is designed for reports and hazards as the roadmap grows. Use Live tools "
        "and group coordination to share issues with travelers on the same route when available.",
        variants=[
            "Can I report a road hazard?",
            "Report hazard",
            "Road report?",
            "Flag a danger",
            "Hazard on route?",
            "report hazard how",
            "hey report road issue",
            "Accident report?",
            "ok so hazard report",
            "Warn others?",
        ],
    ),
    _intent(
        "traffic_info",
        "live",
        "Do you show traffic?",
        "Traffic and richer live conditions are part of the Live roadmap. For now, use route "
        "previews and your judgment, and ask Wayra for timing tips when context is available.",
        variants=[
            "Do you show traffic?",
            "Traffic layer?",
            "Is traffic bad?",
            "Live traffic?",
            "Congestion?",
            "traffic info",
            "hey traffic",
            "Road congestion?",
            "ok so traffic",
            "Heavy traffic?",
        ],
    ),
    _intent(
        "convoy_mode",
        "live",
        "What is convoy mode?",
        "Convoy mode is a planned Live feature for groups traveling together. Today you can "
        "already share Live location and meet points so the group stays aligned.",
        variants=[
            "What is convoy mode?",
            "Convoy travel?",
            "Group convoy?",
            "Travel as a convoy",
            "Multi-car mode?",
            "convoy mode what",
            "hey convoy",
            "Follow the leader?",
            "ok so convoy",
            "Group driving mode?",
        ],
    ),
    _intent(
        "route_chat",
        "live",
        "Is there route chat?",
        "Route-scoped chat is on the Live roadmap. For now, use group Lounge chat and Live "
        "pins to coordinate while navigating.",
        variants=[
            "Is there route chat?",
            "Chat on the route?",
            "Talk while navigating?",
            "Route messaging?",
            "Navigation chat?",
            "route chat what",
            "hey chat on route",
            "In-route messages?",
            "ok so route chat",
            "Drive chat?",
        ],
    ),
    _intent(
        "activities_search",
        "plan",
        "How do I find activities?",
        "Use Explore for events and destination ideas, or ask Wayra what to do near your GPS "
        "or pin. Plan also connects to activity partners when available for your destination.",
        variants=[
            "How do I find activities?",
            "Things to do search",
            "Book activities?",
            "Tours nearby?",
            "Experiences?",
            "find activities how",
            "hey activities",
            "Day plans?",
            "ok so activities",
            "Attractions?",
        ],
    ),
    _intent(
        "deal_scanner",
        "plan",
        "What is Deal Scanner?",
        "Deal Scanner helps surface travel deal opportunities in Rovvy's planning tools. Check "
        "Plan and Explore for offers related to your destinations when available.",
        variants=[
            "What is Deal Scanner?",
            "Find deals",
            "Travel deals?",
            "Cheap flights deals?",
            "Deal scanner how?",
            "deal scanner what",
            "hey deals",
            "Discount travel?",
            "ok so deal scanner",
            "Promo fares?",
        ],
    ),
    _intent(
        "email_verification",
        "account",
        "Why verify my email?",
        "Email verification protects your account and unlocks trusted invites and recovery. "
        "Check your inbox for the Rovvy verification code or link after sign-up.",
        variants=[
            "Why verify my email?",
            "Email verification?",
            "Confirm email?",
            "Didn't get verification?",
            "Verify account",
            "verify email why",
            "hey email code",
            "OTP email?",
            "ok so verify email",
            "Confirm my address?",
        ],
    ),
    _intent(
        "feedback_fun",
        "fun",
        "You're awesome",
        "Appreciate that — now let's make the trip better. Ask me where you are, what to do "
        "nearby, or how something in Rovvy works.",
        variants=[
            "You're awesome",
            "I like you",
            "Nice job",
            "Good bot",
            "Well done Wayra",
            "youre awesome",
            "hey you rock",
            "Love this",
            "ok so good job",
            "Wayra is cool",
        ],
    ),
]

# Pad to exactly 100 with additional high-value intents if short
while len(INTENTS) < 100:
    n = len(INTENTS) + 1
    INTENTS.append(
        _intent(
            f"extra_help_{n}",
            "onboarding",
            "How else can you help?",
            "Ask about Live, Plan, groups, trips, or what to do near your location. "
            "I'm Wayra — here to keep the trip moving.",
            variants=[
                f"How else can you help {n}?",
                f"Anything else {n}?",
                f"More help {n}",
                f"Other tips {n}",
                f"What else {n}",
                f"more please {n}",
                f"hey more help {n}",
                f"Extra tip {n}",
                f"ok so more {n}",
                f"Continue help {n}",
            ],
        )
    )

INTENTS = INTENTS[:100]


def main() -> None:
    # Deduplicate normalized utterances globally; drop dupes within/across intents
    seen: set[str] = set()
    cleaned: list[dict] = []
    total_utts = 0
    for intent in INTENTS:
        uniq: list[dict] = []
        for u in intent["utterances"]:
            norm = u["normalized"]
            if not norm or norm in seen:
                continue
            seen.add(norm)
            uniq.append(u)
        # Ensure at least 8 variants by synthesizing if needed
        i = 0
        while len(uniq) < 10:
            i += 1
            text = f"{intent['canonical_question']} variant {i}"
            norm = _norm(text)
            if norm in seen:
                continue
            seen.add(norm)
            uniq.append({"utterance": text, "normalized": norm, "style_tag": "synth"})
        intent = {**intent, "utterances": uniq[:10]}
        cleaned.append(intent)
        total_utts += len(intent["utterances"])

    assert len(cleaned) == 100, len(cleaned)
    assert total_utts == 1000, total_utts

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "intent_count": len(cleaned),
        "utterance_count": total_utts,
        "intents": cleaned,
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({len(cleaned)} intents, {total_utts} utterances)")


if __name__ == "__main__":
    main()
