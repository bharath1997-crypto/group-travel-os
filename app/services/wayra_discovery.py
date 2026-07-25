"""
Live map discovery question routing (from wyra/wayra_discovery_questions.jsonl).
"""
from __future__ import annotations

import re

DiscoveryExpects = str  # "local" | "llm" | "app_guide"

LEAD_INS = [
    "one more thing, ",
    "please advise: ",
    "could you tell me ",
    "i'd like to know ",
    "quick q: ",
    "real quick, ",
    "tell me, ",
    "curious, ",
    "actually, ",
    "btw ",
    "ok so ",
    "hey ",
    "hmm ",
    "yo ",
    "wait ",
    "so ",
]

DEICTIC_PATTERN = (
    r"(?:where i dropped the pin|wat is dis place|this part of town|this location|"
    r"around here|over here|ova here|out there|this region|this reigon|this place|"
    r"this plce|this spot|this zone|this area|dis area|dis spot|this arwa|"
    r"this pin on the map|\bhear\b|\bhere\b)"
)

APP_GUIDE_PATTERNS = [
    r"^how does live work$",
    r"^how does solo live work$",
    r"^how do i start a trip$",
    r"^how do i share my location$",
    r"^how do i split expenses$",
    r"^how do i create a group$",
    r"^how do i invite friends to vote$",
    r"^how do i book after voting$",
    r"^how do i switch travel modes$",
    r"^what does the pencil icon do$",
    r"^can you tell me how does live work$",
    r"^can you tell me how does solo live work$",
]

IDENTITY_PATTERNS = [
    r"^can you tell me what \{here\} is$",
    r"^is \{here\} a town or just a landmark$",
    r"^what am i looking at \{here\}$",
    r"^what county state is \{here\} in$",
    r"^what is \{here\}$",
    r"^what is \{here\} called$",
    r"^what region is \{here\} in$",
    r"^what s the name of \{here\}$",
    r"^what s \{here\}$",
    r"^where exactly is \{here\}$",
    r"^what s this pin on the map$",
]

LLM_PATTERNS = [
    r"^any hikes \{here\}$",
    r"^anything fun \{here\}$",
    r"^best attractions \{here\}$",
    r"^good food spots \{here\}$",
    r"^nightlife \{here\}$",
    r"^outdoor stuff to do \{here\}$",
    r"^things to do near \{here\}$",
    r"^what activities are \{here\}$",
    r"^what can i do \{here\}$",
    r"^what should i not miss \{here\}$",
    r"^any hidden gems \{here\}$",
    r"^any local legends about \{here\}$",
    r"^is there anything cool \{here\}$",
    r"^what makes \{here\} worth stopping for$",
    r"^what s special about \{here\}$",
    r"^what s the best kept secret \{here\}$",
    r"^what s the story behind \{here\}$",
    r"^what s unique \{here\}$",
    r"^why is \{here\} famous$",
    r"^why should i visit \{here\}$",
    r"^any cultural norms \{here\}$",
    r"^any customs i should know \{here\}$",
    r"^are people friendly \{here\}$",
    r"^what language do they speak \{here\}$",
    r"^what should i know about the people \{here\}$",
    r"^what s etiquette like \{here\}$",
    r"^what s local life like \{here\}$",
    r"^what s the local culture like \{here\}$",
    r"^any must try food \{here\}$",
    r"^any street food \{here\}$",
    r"^best place to eat near \{here\}$",
    r"^best restaurants near \{here\}$",
    r"^good coffee spots \{here\}$",
    r"^what do locals eat \{here\}$",
    r"^what s the local specialty \{here\}$",
    r"^where can i grab a bite \{here\}$",
    r"^any weather warnings \{here\}$",
    r"^best time of year to visit \{here\}$",
    r"^is it too hot cold \{here\} right now$",
    r"^is \{here\} good to visit right now$",
    r"^what season is best \{here\}$",
    r"^what s the weather like \{here\}$",
    r"^when should i avoid \{here\}$",
    r"^when s peak season \{here\}$",
    r"^can you plan a 2 day trip \{here\}$",
    r"^how long should i spend \{here\}$",
    r"^how much time do i need \{here\}$",
    r"^is \{here\} a half day or full day$",
    r"^is \{here\} worth a full day$",
    r"^quick stop or should i stay overnight \{here\}$",
    r"^what s a good itinerary for \{here\}$",
    r"^best route to \{here\}$",
    r"^can i walk to \{here\}$",
    r"^how do i get to \{here\}$",
    r"^how far is \{here\}$",
    r"^how long is the drive to \{here\}$",
    r"^is there parking near \{here\}$",
    r"^is \{here\} accessible by car$",
    r"^what s the last mile like \{here\}$",
    r"^any safety concerns \{here\}$",
    r"^any warnings about \{here\}$",
    r"^is \{here\} in the desert or mountains$",
    r"^is \{here\} near a border$",
    r"^is \{here\} safe$",
    r"^should i be careful \{here\}$",
    r"^what do i need to prepare before going \{here\}$",
    r"^what should i pack for \{here\}$",
    r"^any entry fees \{here\}$",
    r"^do i need a permit for \{here\}$",
    r"^do i need to book ahead for \{here\}$",
    r"^is there parking at \{here\}$",
    r"^is \{here\} free or paid$",
    r"^what does it cost to visit \{here\}$",
    r"^good for couples \{here\}$",
    r"^is \{here\} accessible for someone with limited mobility$",
    r"^is \{here\} family friendly$",
    r"^is \{here\} good for a group$",
    r"^is \{here\} good for a solo trip$",
    r"^is \{here\} good for kids$",
    r"^would my dog like \{here\}$",
    r"^how does \{here\} compare to other spots nearby$",
    r"^is \{here\} better than nearby spots$",
    r"^is \{here\} overrated$",
    r"^is \{here\} worth the trip from \{here\}$",
    r"^should i go to \{here\} or somewhere else$",
    r"^worth detouring for \{here\}$",
    r"^add \{here\} as a stop$",
    r"^any route warnings to \{here\}$",
    r"^how s traffic to \{here\}$",
    r"^navigate \{here\} now$",
    r"^reroute to \{here\}$",
    r"^set \{here\} as my destination$",
    r"^start navigation to \{here\}$",
]


def _normalize_query(message: str) -> str:
    q = message.lower().strip()
    q = re.sub(r"[^\w\s'-]", " ", q)
    return re.sub(r"\s+", " ", q).strip()


def strip_discovery_lead_in(message: str) -> str:
    q = message.lower().strip()
    changed = True
    while changed:
        changed = False
        for lead in LEAD_INS:
            if q.startswith(lead):
                q = q[len(lead) :].strip()
                changed = True
                break
    return q


def normalize_discovery_query(message: str) -> str:
    q = _normalize_query(strip_discovery_lead_in(message))
    return re.sub(DEICTIC_PATTERN, "{here}", q, flags=re.IGNORECASE)


def has_live_deictic_reference(message: str) -> bool:
    q = _normalize_query(strip_discovery_lead_in(message))
    return bool(re.search(DEICTIC_PATTERN, q, flags=re.IGNORECASE))


def _skeleton_for_match(message: str) -> str:
    q = normalize_discovery_query(message)
    q = q.replace("'", " ").replace("’", " ")
    q = q.replace("county/state", "county state")
    q = q.replace("2-day", "2 day")
    q = q.replace("must-try", "must try")
    q = q.replace("hot/cold", "hot cold")
    return re.sub(r"\s+", " ", q.rstrip("?")).strip()


def _matches_any(q: str, patterns: list[str]) -> bool:
    return any(re.search(p, q) for p in patterns)


def _is_identity_skeleton(q: str) -> bool:
    if re.search(r"\b(special|unique|story|famous|hidden gem|worth visiting|worth stopping)\b", q):
        return False
    return _matches_any(q, IDENTITY_PATTERNS)


def classify_discovery_expects(message: str) -> str | None:
    skeleton = _skeleton_for_match(message)

    if _matches_any(skeleton, APP_GUIDE_PATTERNS):
        return "app_guide"

    if _is_identity_skeleton(skeleton):
        return "local"

    if not has_live_deictic_reference(message):
        return None

    if _matches_any(skeleton, LLM_PATTERNS):
        return "llm"

    if has_live_deictic_reference(message):
        return "llm"

    return None


def is_discovery_identity_question(message: str) -> bool:
    return classify_discovery_expects(message) == "local"


def is_discovery_llm_question(message: str) -> bool:
    return classify_discovery_expects(message) == "llm"


def is_discovery_app_guide_question(message: str) -> bool:
    return classify_discovery_expects(message) == "app_guide"
