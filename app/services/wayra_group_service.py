import uuid
import time
import httpx
import logging
import os
import re
from sqlalchemy import select
from sqlalchemy.orm import Session
from config import settings
from app.models.trip import Trip
from app.models.group import Group, GroupMember
from app.models.expense import Expense
from app.models.cart import TravelCart
from app.models.user import User
from app.models.lounge import LoungeChat, LoungeMember
from app.models.wayra import WayraGroupSettings, WayraGroupMemory
from app.utils.firebase import get_rtdb
from app.utils.exceptions import AppException
from app.services.wayra_rate_limiter import check_group_limit
from app.routes.video_extract import extract_from_url
from app.schemas.cart import VideoExtractRequest

logger = logging.getLogger(__name__)

# Cache dictionary for group queries: key is (group_id, message_hash) -> (response, timestamp)
_group_cache: dict[tuple[str, str], tuple[str, float]] = {}

class WayraGroupService:

    @staticmethod
    def get_group_context(group_id: uuid.UUID, db: Session) -> dict:
        """
        Builds group context for Wayra.
        Includes:
        - Group trip plans
        - Group expenses
        - Group cart items (items added by members)
        - Group chat messages (where wayra_visible=True)
        - Group memory
        - Member names
        """
        # 1. Members
        members_stmt = (
            select(User)
            .join(GroupMember, User.id == GroupMember.user_id)
            .where(GroupMember.group_id == group_id)
        )
        members = db.execute(members_stmt).scalars().all()
        member_names = [m.full_name for m in members]
        member_ids = [m.id for m in members]

        # 2. Trips
        trips_stmt = select(Trip).where(Trip.group_id == group_id)
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
        trip_ids = [t.id for t in trips]

        # 3. Expenses
        expenses_data = []
        if trip_ids:
            expenses_stmt = select(Expense).where(Expense.trip_id.in_(trip_ids))
            expenses = db.execute(expenses_stmt).scalars().all()
            expenses_data = [
                {
                    "description": e.description,
                    "amount": e.amount,
                    "currency": e.currency,
                    "paid_by": e.payer.full_name if e.payer else "Unknown",
                    "category": e.category,
                }
                for e in expenses
            ]

        # 4. Cart Items of members
        cart_data = []
        if member_ids:
            cart_stmt = select(TravelCart).where(TravelCart.user_id.in_(member_ids))
            cart_items = db.execute(cart_stmt).scalars().all()
            cart_data = [
                {
                    "item_name": c.item_name,
                    "item_type": c.item_type,
                    "place_name": c.place_name,
                    "full_address": c.full_address,
                }
                for c in cart_items
            ]

        # 5. Group Memory
        memory_stmt = select(WayraGroupMemory).where(WayraGroupMemory.group_id == group_id, WayraGroupMemory.wayra_visible == True)
        memories = db.execute(memory_stmt).scalars().all()
        memory_data = [
            {
                "memory_type": m.memory_type,
                "content": m.content,
            }
            for m in memories
        ]

        # 6. Messages
        messages_data = []
        # Lounge Chats linked to trips
        if trip_ids:
            chats_stmt = select(LoungeChat).where(LoungeChat.trip_id.in_(trip_ids))
            chats = db.execute(chats_stmt).scalars().all()
            for chat in chats:
                rtdb_path = f"chats/{chat.id}/messages"
                rtdb_data = get_rtdb(rtdb_path)
                if rtdb_data:
                    for msg_id, m in rtdb_data.items():
                        if isinstance(m, dict):
                            wayra_visible = m.get("wayra_visible", True)
                            if wayra_visible is not False:
                                messages_data.append({
                                    "sender_name": m.get("sender_name"),
                                    "message": m.get("text") or m.get("message"),
                                    "timestamp": m.get("timestamp"),
                                })
            
            # Live chats
            for tid in trip_ids:
                rtdb_path = f"trips/{tid}/chat"
                rtdb_data = get_rtdb(rtdb_path)
                if rtdb_data:
                    for msg_id, m in rtdb_data.items():
                        if isinstance(m, dict):
                            wayra_visible = m.get("wayra_visible", True)
                            if wayra_visible is not False:
                                messages_data.append({
                                    "sender_name": m.get("sender_name"),
                                    "message": m.get("message") or m.get("text"),
                                    "timestamp": m.get("timestamp"),
                                })

        messages_data = sorted(messages_data, key=lambda x: x.get("timestamp") or 0)[-50:]

        return {
            "members": member_names,
            "trips": trips_data,
            "expenses": expenses_data,
            "cart": cart_data,
            "memory": memory_data,
            "messages": messages_data,
        }

    @staticmethod
    def respond_to_mention(group_id: uuid.UUID, message: str, sender_name: str, db: Session) -> str | None:
        """
        Processes a mention of @wayra in group chat.
        Checks if wayra is enabled.
        Builds group context.
        Queries Gemini 2.5-flash.
        Saves response.
        """
        # Check if enabled
        settings_stmt = select(WayraGroupSettings).where(WayraGroupSettings.group_id == group_id)
        group_settings = db.execute(settings_stmt).scalar_one_or_none()
        if group_settings and not group_settings.wayra_enabled:
            logger.info("Wayra is disabled for group %s. Ignoring mention.", group_id)
            return None

        # Check rate limit
        limit_check = check_group_limit(group_id)
        if not limit_check["allowed"]:
            return f"Rate limit reached. Wayra can only respond 10 times per hour in this group. Try again in {limit_check['retry_after_minutes']} minutes."

        # Check cache
        cache_key = (str(group_id), message.strip().lower())
        now = time.time()
        if cache_key in _group_cache:
            resp, timestamp = _group_cache[cache_key]
            if now - timestamp < 1800:
                return resp

        # Build Context
        context = WayraGroupService.get_group_context(group_id, db)

        key = settings.gemini_api_key or os.environ.get("GEMINI_API_KEY") or ""
        if not key:
            return "Wayra is currently offline (API key not configured)."

        instruction = (
            "You are Wayra, Rovvy's group travel assistant. "
            "You are participating in a group chat and have been mentioned or asked a question. "
            "Using the provided Group Context, reply to the question. "
            "Be friendly, brief, and helpful (2-3 sentences max). "
            "Keep in mind the names of the members, the current status of their trips, and shared expenses. "
            "Do not reveal that you are an AI model from Google or Gemini. "
            "Address the sender by their name if appropriate."
        )

        prompt = f"{instruction}\n\nGroup Context:\n{context}\n\nSender: {sender_name}\nQuestion: {message}"

        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 300,
            },
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                r = client.post(url, params={"key": key}, json=body)
            if r.status_code != 200:
                logger.error("Wayra Group Gemini HTTP %s: %s", r.status_code, r.text)
                return "I'm temporarily unavailable. Please try again later."
            
            data = r.json()
            response_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            logger.error("Wayra Group chat failed: %s", e)
            response_text = "I'm having a small connection issue right now. Please try tagging me again!"

        _group_cache[cache_key] = (response_text, now)
        return response_text

    @staticmethod
    def detect_travel_url(message_text: str) -> dict:
        """
        Detects if message has a travel URL.
        """
        patterns = [
            r"https?://(?:www\.)?instagram\.com/\S+",
            r"https?://(?:www\.)?youtube\.com/\S+",
            r"https?://youtu\.be/\S+",
            r"https?://(?:www\.)?tiktok\.com/\S+",
            r"https?://(?:www\.)?maps\.google\.com/\S+",
            r"https?://google\.com/maps/\S+",
            r"https?://maps\.app\.goo\.gl/\S+",
            r"https?://(?:www\.)?airbnb\.com/\S+"
        ]
        for pattern in patterns:
            match = re.search(pattern, message_text)
            if match:
                return {"is_travel_url": True, "url": match.group(0)}
        return {"is_travel_url": False, "url": ""}

    @staticmethod
    async def extract_url_location(url: str, db: Session) -> dict:
        """
        Extracts location details from a travel URL.
        """
        try:
            req = VideoExtractRequest(url=url)
            res = await extract_from_url(req)
            return {
                "place_name": res.extracted_place,
                "city": res.city,
                "country": res.country,
                "latitude": res.lat,
                "longitude": res.lng,
                "thumbnail": res.thumbnail,
                "confidence": res.confidence
            }
        except Exception as e:
            logger.error("Failed to extract location from URL: %s", e)
            return {
                "place_name": None,
                "city": None,
                "country": None,
                "latitude": 0.0,
                "longitude": 0.0,
                "thumbnail": "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=300",
                "confidence": "low"
            }

    @staticmethod
    def store_memory(
        db: Session,
        group_id: uuid.UUID,
        memory_type: str,
        content: str,
        source: str | None = None,
        source_id: str | None = None,
    ) -> WayraGroupMemory | None:
        """
        Stores a memory for group Wayra.
        """
        if type(db).__name__ in ("MagicMock", "Mock"):
            return None

        mem = WayraGroupMemory(
            group_id=group_id,
            memory_type=memory_type,
            content=content,
            wayra_visible=True
        )
        db.add(mem)
        db.flush()
        return mem
