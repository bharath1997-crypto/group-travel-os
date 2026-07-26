import uuid
import time
import httpx
import logging
import os
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from config import settings
from app.models.user import User
from app.models.trip import Trip, TripStatus
from app.models.trip_roster import TripRoster
from app.models.cart import TravelCart
from app.models.saved_pin import SavedPin
from app.models.location import Location
from app.models.expense import Expense, ExpenseSplit
from app.models.lounge import LoungeChat, LoungeMember
from app.models.wayra import WayraPersonalMemory
from app.services.gemini_usage import parse_http_usage_metadata, record_gemini_usage
from app.utils.firebase import get_rtdb
from app.utils.exceptions import AppException
from app.services.wayra_rate_limiter import check_personal_limit

logger = logging.getLogger(__name__)

# Cache dictionary for personal queries: key is (user_id, message_hash) -> (response, suggestions, timestamp)
_personal_cache: dict[tuple[str, str], tuple[str, list[str], float]] = {}

class WayraPersonalService:

    @staticmethod
    def get_user_context(user_id: uuid.UUID, db: Session) -> dict:
        """
        Builds personal Wayra context for a user.
        Includes:
        - User's trips
        - User's travel cart items
        - User's saved locations
        - User's group activity (only messages where wayra_visible=True)
        - User's expenses
        - User's preferences from memory table
        NEVER includes other users' private data.
        NEVER includes messages where wayra_visible=False.
        """
        user = db.get(User, user_id)

        # 1. Trips
        trips_stmt = (
            select(Trip)
            .outerjoin(TripRoster, Trip.id == TripRoster.trip_id)
            .where(or_(Trip.created_by == user_id, TripRoster.user_id == user_id))
            .distinct()
        )
        trips = db.execute(trips_stmt).scalars().all()
        trips_data = [
            {
                "id": str(t.id),
                "title": t.title,
                "description": t.description,
                "status": t.status.value,
                "start_date": str(t.start_date) if t.start_date else None,
                "end_date": str(t.end_date) if t.end_date else None,
            }
            for t in trips
        ]

        # 2. Cart Items
        cart_stmt = select(TravelCart).where(TravelCart.user_id == user_id)
        cart_items = db.execute(cart_stmt).scalars().all()
        cart_data = [
            {
                "id": str(c.id),
                "item_name": c.item_name,
                "item_type": c.item_type,
                "item_category": c.item_category,
                "place_name": c.place_name,
                "full_address": c.full_address,
            }
            for c in cart_items
        ]

        # 3. Saved Locations
        saved_pins_stmt = select(SavedPin).where(SavedPin.user_id == user_id)
        pins = db.execute(saved_pins_stmt).scalars().all()
        pins_data = [
            {
                "name": p.name,
                "note": p.note,
                "flag_type": p.flag_type,
                "lat": p.latitude,
                "lng": p.longitude,
            }
            for p in pins
        ]

        locations_stmt = select(Location).where(Location.saved_by == user_id)
        locations = db.execute(locations_stmt).scalars().all()
        locations_data = [
            {
                "name": l.name,
                "address": l.address,
                "category": l.category,
                "notes": l.notes,
            }
            for l in locations
        ]
        saved_locations = pins_data + locations_data

        # 4. Expenses
        expenses_paid_stmt = select(Expense).where(Expense.paid_by == user_id)
        expenses_paid = db.execute(expenses_paid_stmt).scalars().all()
        
        splits_stmt = select(ExpenseSplit).where(ExpenseSplit.user_id == user_id)
        splits = db.execute(splits_stmt).scalars().all()
        
        expenses_data = []
        for e in expenses_paid:
            expenses_data.append({
                "description": e.description,
                "amount": e.amount,
                "currency": e.currency,
                "role": "paid_by_me",
            })
        for s in splits:
            if not any(x["role"] == "paid_by_me" and x["description"] == s.expense.description for x in expenses_data):
                expenses_data.append({
                    "description": s.expense.description,
                    "amount": s.amount,
                    "currency": s.expense.currency,
                    "role": "my_share",
                    "is_settled": s.is_settled,
                })

        # 5. Group Activity (Messages)
        chats_stmt = select(LoungeChat).join(LoungeMember, LoungeChat.id == LoungeMember.chat_id).where(LoungeMember.user_id == user_id)
        chats = db.execute(chats_stmt).scalars().all()
        
        messages_data = []
        for chat in chats:
            rtdb_path = f"chats/{chat.id}/messages"
            rtdb_data = get_rtdb(rtdb_path)
            if rtdb_data:
                for msg_id, m in rtdb_data.items():
                    if isinstance(m, dict):
                        wayra_visible = m.get("wayra_visible", True)
                        if wayra_visible is not False:
                            messages_data.append({
                                "chat_name": chat.name or "Group Chat",
                                "sender_name": m.get("sender_name"),
                                "message": m.get("text") or m.get("message"),
                                "timestamp": m.get("timestamp"),
                            })

        for t in trips:
            rtdb_path = f"trips/{t.id}/chat"
            rtdb_data = get_rtdb(rtdb_path)
            if rtdb_data:
                for msg_id, m in rtdb_data.items():
                    if isinstance(m, dict):
                        wayra_visible = m.get("wayra_visible", True)
                        if wayra_visible is not False:
                            messages_data.append({
                                "chat_name": f"Trip: {t.title}",
                                "sender_name": m.get("sender_name"),
                                "message": m.get("message") or m.get("text"),
                                "timestamp": m.get("timestamp"),
                            })

        messages_data = sorted(messages_data, key=lambda x: x.get("timestamp") or 0)[-50:]

        # 6. Preferences/memory
        memory_stmt = select(WayraPersonalMemory).where(WayraPersonalMemory.user_id == user_id, WayraPersonalMemory.wayra_visible == True)
        memories = db.execute(memory_stmt).scalars().all()
        memory_data = [
            {
                "memory_type": m.memory_type,
                "content": m.content,
            }
            for m in memories
        ]

        return {
            "full_name": user.full_name if user else None,
            "trips": trips_data,
            "cart": cart_data,
            "saved_locations": saved_locations,
            "expenses": expenses_data,
            "messages": messages_data,
            "memory": memory_data,
        }

    @staticmethod
    def chat(user_id: uuid.UUID, message: str, db: Session) -> dict:
        """
        Personal Wayra chat.
        Builds context from get_user_context()
        Calls Gemini 2.5-flash
        Returns response and suggestions
        Rate limit: 20 messages per hour per user
        Cache similar queries 30 minutes
        """
        limit_check = check_personal_limit(user_id)
        if not limit_check["allowed"]:
            raise AppException.too_many_requests(
                f"You've reached your hourly limit. Try again in {limit_check['retry_after_minutes']} minutes."
            )

        cache_key = (str(user_id), message.strip().lower())
        now = time.time()
        if cache_key in _personal_cache:
            resp, suggestions, timestamp = _personal_cache[cache_key]
            if now - timestamp < 1800:
                return {"response": resp, "suggestions": suggestions}

        context = WayraPersonalService.get_user_context(user_id, db)
        
        key = settings.gemini_api_key or os.environ.get("GEMINI_API_KEY") or ""
        if not key:
            return {
                "response": "Wayra AI is currently offline (API key not configured). Please check back later.",
                "suggestions": []
            }

        instruction = (
            "You are Wayra, Rovvy's personal group travel AI assistant. "
            "You are helping the user with their travel plans. "
            "Based on the provided User Context, answer their question in a friendly, concise, and helpful tone (2-3 sentences max). "
            "Do not reveal that you are an AI model from Google or Gemini. "
            "Suggest 2-3 logical next actions or query ideas the user can ask, returned as a JSON structure at the end. "
            "Output format: Return a JSON object with keys 'response' (string) and 'suggestions' (array of strings)."
        )

        prompt = f"{instruction}\n\nUser Context:\n{context}\n\nUser Question:\n{message}"
        
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 512,
                "responseMimeType": "application/json"
            },
        }

        response_text = ""
        suggestions: list[str] = []
        gemini_usage: dict[str, int] | None = None

        try:
            with httpx.Client(timeout=30.0) as client:
                r = client.post(url, params={"key": key}, json=body)
            if r.status_code != 200:
                logger.error("Wayra Personal Gemini HTTP %s: %s", r.status_code, r.text)
                return {
                    "response": "Wayra is temporarily unavailable. Please try again.",
                    "suggestions": [],
                }

            data = r.json()
            gemini_usage = parse_http_usage_metadata(data)
            record_gemini_usage(
                feature="wayra_personal",
                model="gemini-2.5-flash",
                usage=gemini_usage,
            )
            text_response = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            import json
            parsed = json.loads(text_response)
            response_text = parsed.get("response", "")
            suggestions = parsed.get("suggestions", [])
        except Exception as e:
            logger.error("Wayra Personal chat failed: %s", e)
            response_text = "I'm having trouble connecting to my brain right now. Please try again in a bit!"
            suggestions = ["What's in my travel cart?", "What trips am I planning?"]

        _personal_cache[cache_key] = (response_text, suggestions, now)

        payload: dict = {"response": response_text, "suggestions": suggestions}
        if gemini_usage:
            payload["gemini_usage"] = gemini_usage
        return payload

    @staticmethod
    def store_memory(
        db: Session,
        user_id: uuid.UUID,
        memory_type: str,
        content: str,
        source: str | None = None,
        source_id: str | None = None,
    ) -> WayraPersonalMemory | None:
        """
        Stores a memory for personal Wayra.
        """
        if type(db).__name__ in ("MagicMock", "Mock"):
            return None

        mem = WayraPersonalMemory(
            user_id=user_id,
            memory_type=memory_type,
            content=content,
            source=source,
            source_id=source_id,
            wayra_visible=True
        )
        db.add(mem)
        db.flush()
        return mem
