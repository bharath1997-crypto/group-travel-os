"""Sample routing checks for questions outside the JSONL skeleton."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.wayra_discovery import classify_discovery_expects
from app.services.wayra_intent import (
    WayraMode,
    classify_mode,
    is_live_map_context_question,
    is_live_place_deep_question,
    normalize_query,
    resolve_app_intent,
)

EXPECTED = {
    "What's at Kitikmeot Region?": ("llm", WayraMode.TRAVEL, True),
    "What is the special out there?": ("llm", WayraMode.TRAVEL, True),
    "How do I create a group?": ("app_guide", WayraMode.APP_GUIDE, False),
    "What should I prepare for this trip?": ("llm", WayraMode.TRAVEL, True),
    "anything fun around here?": ("llm", WayraMode.TRAVEL, True),
    "What's at Paris?": ("llm", WayraMode.TRAVEL, True),
    "tell me about this place": ("llm", WayraMode.TRAVEL, True),
    "How far is this from me?": ("llm", WayraMode.TRAVEL, True),
}

for q, (exp_discovery, exp_mode, exp_deep) in EXPECTED.items():
    discovery = classify_discovery_expects(q)
    mode = classify_mode(q)
    deep = is_live_place_deep_question(q)
    ok = discovery == exp_discovery and mode == exp_mode and deep == exp_deep
    status = "OK" if ok else "FAIL"
    print(f"{status} {q}")
    if not ok:
        print(f"  normalized: {normalize_query(q)!r}")
        print(f"  discovery: {discovery} (expected {exp_discovery})")
        print(f"  mode: {mode} (expected {exp_mode})")
        print(f"  deep: {deep} (expected {exp_deep})")
        print(f"  context_q: {is_live_map_context_question(q)}")
        print(f"  app_intent: {resolve_app_intent(q)}")
    print()
