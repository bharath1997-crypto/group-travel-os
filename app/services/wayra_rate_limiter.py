import time
from typing import Any, TypedDict

class RateLimitResult(TypedDict):
    allowed: bool
    remaining: int
    retry_after_minutes: int

personal_limits: dict[str, list[float]] = {}
group_limits: dict[str, list[float]] = {}

def check_personal_limit(user_id: Any) -> RateLimitResult:
    uid = str(user_id)
    now = time.time()
    hour_ago = now - 3600
    
    timestamps = [t for t in personal_limits.get(uid, []) if t > hour_ago]
    
    if len(timestamps) >= 20:
        oldest = min(timestamps)
        retry_after = int((oldest + 3600 - now) / 60)
        if retry_after <= 0:
            retry_after = 1
        personal_limits[uid] = timestamps
        return {
            "allowed": False,
            "remaining": 0,
            "retry_after_minutes": retry_after
        }
    
    timestamps.append(now)
    personal_limits[uid] = timestamps
    return {
        "allowed": True,
        "remaining": 20 - len(timestamps),
        "retry_after_minutes": 0
    }

def check_group_limit(group_id: Any) -> RateLimitResult:
    gid = str(group_id)
    now = time.time()
    hour_ago = now - 3600
    
    timestamps = [t for t in group_limits.get(gid, []) if t > hour_ago]
    
    if len(timestamps) >= 10:
        oldest = min(timestamps)
        retry_after = int((oldest + 3600 - now) / 60)
        if retry_after <= 0:
            retry_after = 1
        group_limits[gid] = timestamps
        return {
            "allowed": False,
            "remaining": 0,
            "retry_after_minutes": retry_after
        }
    
    timestamps.append(now)
    group_limits[gid] = timestamps
    return {
        "allowed": True,
        "remaining": 10 - len(timestamps),
        "retry_after_minutes": 0
    }
