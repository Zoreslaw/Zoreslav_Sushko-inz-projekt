#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Domain models and data structures for the matchmaking system.
"""

from dataclasses import dataclass, field
from typing import List, Tuple

# ---------------------------
# Constants
# ---------------------------

GAMES = [
    "dota2", "cs2", "valorant", "lol", "apex",
    "overwatch2", "fortnite", "pubg", "rocketleague", "minecraft",
    "hoi4", "rust", "phasmophobia", "battlefield1", "gta5rp"
]
GAME_TO_ID = {g: i for i, g in enumerate(GAMES)}
NUM_GAMES = len(GAMES)

# ---------------------------
# Data structures
# ---------------------------

@dataclass
class UserProfile:
    """Represents a user profile with demographics and game preferences."""
    user_id: int
    age: int           # 12..60
    gender: str        # 'M' or 'F'
    games: List[str]   # subset of GAMES or normalized tokens
    categories: List[str] = field(default_factory=list)
    languages: List[str] = field(default_factory=list)


@dataclass
class InteractionSet:
    """Stores positive and negative user interaction pairs."""
    positives: List[Tuple[int, int]] = field(default_factory=list)  # (u, v)
    negatives: List[Tuple[int, int]] = field(default_factory=list)  # (u, v)


# ---------------------------
# Data store
# ---------------------------

class DataStore:
    """In-memory container for user profiles and interactions."""
    
    def __init__(self):
        self.users: List[UserProfile] = []
        self.interactions = InteractionSet()

    def clear(self):
        """Clear all users and interactions."""
        self.users.clear()
        self.interactions = InteractionSet()

    def add_user(self, age: int, gender: str, games: List[str]) -> int:
        """Add a new user and return their ID."""
        uid = len(self.users)
        self.users.append(UserProfile(uid, age, gender, games))
        return uid

    def add_positive(self, u: int, v: int):
        """Add a positive interaction pair (u likes v)."""
        if u == v:
            return
        self.interactions.positives.append((u, v))

    def add_negative(self, u: int, v: int):
        """Add a negative interaction pair (u dislikes v)."""
        if u == v:
            return
        self.interactions.negatives.append((u, v))
