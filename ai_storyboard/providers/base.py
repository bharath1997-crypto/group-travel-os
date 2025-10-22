from abc import ABC, abstractmethod
from typing import Optional


class LLMProvider(ABC):
    @abstractmethod
    def complete(self, user: str, system: Optional[str] = None) -> str:  # pragma: no cover
        raise NotImplementedError
