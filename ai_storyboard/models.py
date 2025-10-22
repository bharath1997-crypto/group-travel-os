from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class StoryBeat:
    title: str
    description: str
    image_prompt: Optional[str] = None


@dataclass
class Storyboard:
    idea: str
    beats: List[StoryBeat] = field(default_factory=list)
    notes: Optional[str] = None
