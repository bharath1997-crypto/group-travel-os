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
