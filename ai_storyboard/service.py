from typing import List, Optional
import json
import re

from .models import StoryBeat, Storyboard
from .providers.base import LLMProvider


STORY_PROMPT_TEMPLATE = (
    "You are a storyboard writer. Given an idea, outline 6-10 concise beats. "
    "For each beat, provide a short title, a 1-2 sentence description, and an illustrative image prompt. "
    "Respond in JSON with keys: beats:[{title, description, image_prompt}], notes. Keep it compact."
)


class StoryboardService:
    def __init__(self, provider: LLMProvider):
        self.provider = provider

    def generate(self, idea: str) -> Storyboard:
        system = "You generate structured storyboards."
        user = f"Idea: {idea}\n\n{STORY_PROMPT_TEMPLATE}"
        text = self.provider.complete(user=user, system=system)
        try:
            data = json.loads(text)
        except Exception:
            match = re.search(r"\{[\s\S]*\}", text)
            if not match:
                raise
            data = json.loads(match.group(0))
        beats = [StoryBeat(**b) for b in data.get("beats", [])]
        return Storyboard(idea=idea, beats=beats, notes=data.get("notes"))


def beats_to_pages(beats, pages: int = 5, panels_per_page: int = 4):
    """Expand a list of beats into pages and panels.

    Rule: 2 beats per page; each beat -> 2 panels (caption/dialogue placeholders)
    Ensures 4 panels per page. If beats are exhausted, fill with ellipses.
    """
    out_pages = []
    beat_index = 0
    for page_index in range(pages):
        panels = []
        # 2 beats per page, each beat contributes 2 panels
        for _ in range(panels_per_page // 2):
            if beat_index < len(beats):
                b = beats[beat_index]
                panels.append({
                    "i": len(panels) + 1,
                    "caption": b["description"],
                    "dialogue": "",
                })
                panels.append({
                    "i": len(panels) + 1,
                    "caption": f"Image: {b.get('image_prompt', '')}",
                    "dialogue": "",
                })
                beat_index += 1
            else:
                panels.append({"i": len(panels) + 1, "caption": "…", "dialogue": ""})
                panels.append({"i": len(panels) + 1, "caption": "…", "dialogue": ""})
        out_pages.append({"page": page_index + 1, "panels": panels})
    return out_pages
