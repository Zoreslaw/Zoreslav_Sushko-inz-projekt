from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime

@dataclass
class User:
    id: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
    favorite_category: Optional[str] = None
    preference_gender: Optional[str] = None
    preference_age_min: Optional[int] = None
    preference_age_max: Optional[int] = None
    favorite_games: List[str] = field(default_factory=list)
    languages: List[str] = field(default_factory=list)
    preference_categories: List[str] = field(default_factory=list)
    preference_languages: List[str] = field(default_factory=list)
    liked: List[str] = field(default_factory=list)
    disliked: List[str] = field(default_factory=list)
    created_at: Optional[datetime] = None