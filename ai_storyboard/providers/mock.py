from .base import LLMProvider


class MockProvider(LLMProvider):
    def complete(self, user: str, system: str | None = None) -> str:
        return '{"beats":[{"title":"Hook","description":"Introduce the main character and world.","image_prompt":"wide shot, cinematic"},{"title":"Inciting Incident","description":"A problem disrupts normal life.","image_prompt":"dramatic lighting"},{"title":"Decision","description":"The hero commits to a goal.","image_prompt":"close-up determination"},{"title":"Midpoint","description":"A twist changes the stakes.","image_prompt":"dynamic composition"},{"title":"All Is Lost","description":"The worst setback happens.","image_prompt":"low-key lighting"},{"title":"Climax","description":"Final confrontation resolves the conflict.","image_prompt":"high contrast"}],"notes":"Example output from MockProvider"}'
