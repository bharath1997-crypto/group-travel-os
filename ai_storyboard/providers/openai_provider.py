import os
from .base import LLMProvider


class OpenAIProvider(LLMProvider):
    def __init__(self, model: str | None = None):
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def complete(self, user: str, system: str | None = None) -> str:
        from openai import OpenAI
        client = OpenAI()
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": user})
        resp = client.chat.completions.create(
            model=self.model, messages=messages, temperature=0.2
        )
        return resp.choices[0].message.content
