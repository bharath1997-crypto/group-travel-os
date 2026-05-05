"""Load and merge Group Travel app settings (JSON preferences per user)."""

from __future__ import annotations

import copy
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.blocked_user import BlockedUser
from app.models.subscription import Subscription
from app.models.user import User
from app.models.user_app_settings import UserAppSettings
from app.utils.exceptions import AppException


def _deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, val in patch.items():
        if (
            key in out
            and isinstance(out[key], dict)
            and isinstance(val, dict)
        ):
            out[key] = _deep_merge(out[key], val)
        else:
            out[key] = val
    return out


DEFAULT_PREFERENCES: dict[str, Any] = {
    "general": {
        "crossposting_enabled": False,
        "story_live_location_sharing": "friends_only",
        "activity_in_friends_tab": True,
    },
    "interactions": {
        "messages_from": "everyone",
        "story_replies_from": "followers",
        "tags_and_mentions": "everyone",
        "comments_from": "followers",
        "sharing_from": "everyone",
        "limit_interactions": False,
        "hidden_words_enabled": False,
        "hidden_words": "",
    },
    "usage": {
        "time_management_reminders": True,
        "tablet_optimized": False,
        "tv_optimized": False,
    },
    "content": {
        "muted_user_ids": [],
        "favorite_user_ids": [],
        "content_preferences_tags": [],
        "hide_like_share_counts": False,
        "creator_subscriptions": False,
    },
    "app_media": {
        "reduce_data_usage": False,
        "media_quality": "auto",
        "archiving_auto": True,
        "accessibility_large_text": False,
        "language": "en",
    },
    "privacy_extra": {
        "show_in_find_friends": True,
        "contact_me": "everyone",
        "activity_indicator": True,
        "trip_activity_indicator": True,
        "california_privacy": False,
        "florida_privacy": False,
        "generative_ai_features": True,
        "family_center_enabled": False,
        "comments_moderation_level": "standard",
        "restricted_user_ids": [],
        "my_data_export_requested": False,
    },
    "close_friends_user_ids": [],
    "notifications": {
        "push_enabled": True,
        "email_digest": True,
        "trip_updates": True,
        "group_invites": True,
        "marketing": False,
    },
    "security": {
        "two_factor_enabled": False,
        "lockscreen_shortcut": True,
        "saved_login_enabled": True,
    },
    "appearance": {
        "theme": "system",
    },
    "payments": {
        "save_payment_methods": False,
    },
    "integrations": {
        "partner_connections": True,
        "connected_apps_enabled": True,
        "connected_calendar": False,
    },
    "locale": {
        "preferred_currency": "INR",
        "timezone": "UTC",
    },
    "support": {
        "travel_streak_help_viewed": False,
        "bugs_contact_email": "",
    },
    "connect": {
        "account": {
            "security_notifications": True,
            "two_step_pin_set": False,
        },
        "privacy": {
            "last_seen": "everyone",  # everyone | contacts | nobody
            "profile_picture": "everyone",
            "about": "everyone",
            "status": "contacts",
            "groups": "everyone",
            "avatar_stickers": "contacts",
            "live_location": False,
            "silence_unknown_callers": False,
            "read_receipts": True,
            "default_disappearing_seconds": 0,  # 0 off, 86400 24h, 604800 7d, 7776000 90d
            "app_lock": False,
            "chat_lock": False,
            "camera_effects": True,
            "ip_protect_calls": False,
            "disable_link_previews": False,
        },
        "chats": {
            "theme": "system",  # light | dark | system
            "wallpaper": "default",
            "enter_is_send": False,
            "media_visibility": True,
            "font_size": "medium",  # small | medium | large
            "keep_archived": False,
        },
        "notifications": {
            "conversation_tones": True,
            "reminders": True,
            "notification_tone": "default",
            "vibrate": "default",  # off | default | short | long
            "light": "white",
            "high_priority": True,
            "reaction_notifications": True,
            "call_notifications": True,
        },
        "storage": {
            "use_less_data_for_calls": False,
            "media_upload_quality": "hd",  # standard | hd
            "auto_download_quality": "auto",
            "auto_download_mobile": ["photos"],  # photos | audio | video | docs
            "auto_download_wifi": ["photos", "audio", "video", "docs"],
            "auto_download_roaming": [],
        },
        "language": "en",
    },
}


def _merge_with_defaults(raw: dict[str, Any] | None) -> dict[str, Any]:
    if not raw:
        return copy.deepcopy(DEFAULT_PREFERENCES)
    return _deep_merge(copy.deepcopy(DEFAULT_PREFERENCES), raw)


def _blocked_count(db: Session, user_id: uuid.UUID) -> int:
    return int(
        db.execute(
            select(func.count()).select_from(BlockedUser).where(
                BlockedUser.blocker_id == user_id,
            ),
        ).scalar()
        or 0,
    )


def _subscription_plan(db: Session, user_id: uuid.UUID) -> str:
    row = db.execute(
        select(Subscription.plan).where(Subscription.user_id == user_id),
    ).scalar_one_or_none()
    return (row or "free").strip().lower()


def get_merged_preferences(db: Session, user: User) -> dict[str, Any]:
    row = db.execute(
        select(UserAppSettings).where(UserAppSettings.user_id == user.id),
    ).scalar_one_or_none()
    if row is None:
        return copy.deepcopy(DEFAULT_PREFERENCES)
    return _merge_with_defaults(row.preferences)


def get_settings_bundle(db: Session, user: User) -> dict[str, Any]:
    prefs = get_merged_preferences(db, user)
    content = prefs.get("content") or {}
    priv = prefs.get("privacy_extra") or {}
    close_ids = prefs.get("close_friends_user_ids")
    if not isinstance(close_ids, list):
        close_ids = []
    muted = content.get("muted_user_ids")
    if not isinstance(muted, list):
        muted = []
    fav = content.get("favorite_user_ids")
    if not isinstance(fav, list):
        fav = []
    restricted = priv.get("restricted_user_ids")
    if not isinstance(restricted, list):
        restricted = []

    return {
        "preferences": prefs,
        "counts": {
            "blocked": _blocked_count(db, user.id),
            "close_friends": len(close_ids),
            "muted": len(muted),
            "restricted": len(restricted),
            "favorites": len(fav),
        },
        "account": {
            "subscription_plan": _subscription_plan(db, user.id),
            "has_google": user.google_sub is not None,
            "has_facebook": user.facebook_sub is not None,
            "profile_public": user.profile_public,
        },
    }


def patch_preferences(db: Session, user: User, patch: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(patch, dict):
        AppException.bad_request("preferences must be an object")
    # shallow size guard
    if len(str(patch)) > 120_000:
        AppException.bad_request("preferences payload too large")

    row = db.execute(
        select(UserAppSettings).where(UserAppSettings.user_id == user.id),
    ).scalar_one_or_none()
    if row is None:
        merged = _merge_with_defaults(patch)
        row = UserAppSettings(user_id=user.id, preferences=merged)
        db.add(row)
    else:
        base = _merge_with_defaults(row.preferences)
        row.preferences = _deep_merge(base, patch)
    db.commit()
    db.refresh(row)
    return get_settings_bundle(db, user)
