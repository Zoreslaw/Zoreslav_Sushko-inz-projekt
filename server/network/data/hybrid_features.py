#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hybrid feature vocabulary + encoding helpers for Two-Tower inference/training.
Keeps dynamic vocab built from backend data (no fixed game list).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple
import hashlib


def _normalize_token(value: str) -> str:
    return value.strip().lower()


def _normalize_language(value: str) -> str:
    return value.strip().lower()


def normalize_gender(value: str | None) -> str:
    if not value:
        return "other"
    v = value.strip().lower()
    if v in {"m", "male", "man", "masculine"}:
        return "male"
    if v in {"f", "female", "woman", "feminine"}:
        return "female"
    return "other"


def _dedup(items: Iterable[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def normalize_list(values: Iterable[str] | None, *, is_language: bool = False) -> List[str]:
    if not values:
        return []
    if isinstance(values, str):
        values = [values]
    if is_language:
        items = [_normalize_language(str(v)) for v in values if v and str(v).strip()]
    else:
        items = [_normalize_token(str(v)) for v in values if v and str(v).strip()]
    return _dedup(items)


def hash_user_id(user_id: str, buckets: int) -> int:
    if buckets <= 0:
        return 0
    digest = hashlib.sha256(user_id.encode("utf-8")).digest()
    as_int = int.from_bytes(digest[:8], "big", signed=False)
    return as_int % buckets


@dataclass
class HybridFeatureConfig:
    game_to_id: Dict[str, int]
    category_to_id: Dict[str, int]
    language_to_id: Dict[str, int]
    age_min: int
    age_max: int
    user_hash_buckets: int

    def to_dict(self) -> dict:
        return {
            "game_to_id": self.game_to_id,
            "category_to_id": self.category_to_id,
            "language_to_id": self.language_to_id,
            "age_min": self.age_min,
            "age_max": self.age_max,
            "user_hash_buckets": self.user_hash_buckets,
        }

    @staticmethod
    def from_dict(payload: dict) -> "HybridFeatureConfig":
        return HybridFeatureConfig(
            game_to_id={k: int(v) for k, v in payload.get("game_to_id", {}).items()},
            category_to_id={k: int(v) for k, v in payload.get("category_to_id", {}).items()},
            language_to_id={k: int(v) for k, v in payload.get("language_to_id", {}).items()},
            age_min=int(payload.get("age_min", 18)),
            age_max=int(payload.get("age_max", 100)),
            user_hash_buckets=int(payload.get("user_hash_buckets", 100_000)),
        )

    @property
    def game_vocab_size(self) -> int:
        return len(self.game_to_id) + 1

    @property
    def category_vocab_size(self) -> int:
        return len(self.category_to_id) + 1

    @property
    def language_vocab_size(self) -> int:
        return len(self.language_to_id) + 1


def build_feature_config(
    users: Iterable[Tuple[List[str], List[str], List[str], int]],
    *,
    user_hash_buckets: int = 100_000,
    min_age: int = 18,
    max_age: int = 100,
) -> HybridFeatureConfig:
    """
    Build vocabularies from tuples of (games, categories, languages, age).
    Tokens are lowercased and de-duplicated; IDs start at 1 (0 is unknown).
    """
    game_tokens: List[str] = []
    category_tokens: List[str] = []
    language_tokens: List[str] = []
    ages: List[int] = []

    for games, categories, languages, age in users:
        game_tokens.extend(games)
        category_tokens.extend(categories)
        language_tokens.extend(languages)
        if age:
            ages.append(int(age))

    game_tokens = _dedup(game_tokens)
    category_tokens = _dedup(category_tokens)
    language_tokens = _dedup(language_tokens)

    game_to_id = {tok: i + 1 for i, tok in enumerate(game_tokens)}
    category_to_id = {tok: i + 1 for i, tok in enumerate(category_tokens)}
    language_to_id = {tok: i + 1 for i, tok in enumerate(language_tokens)}

    if ages:
        min_age = min(min_age, min(ages))
        max_age = max(max_age, max(ages))

    if min_age >= max_age:
        min_age, max_age = 18, 100

    return HybridFeatureConfig(
        game_to_id=game_to_id,
        category_to_id=category_to_id,
        language_to_id=language_to_id,
        age_min=min_age,
        age_max=max_age,
        user_hash_buckets=user_hash_buckets,
    )


def encode_tokens(values: Iterable[str], vocab: Dict[str, int]) -> List[int]:
    if not values:
        return []
    out: List[int] = []
    for v in values:
        idx = vocab.get(v)
        if idx is not None:
            out.append(idx)
    return out


def normalize_age(age: int | None, cfg: HybridFeatureConfig) -> float:
    if age is None:
        return 0.0
    age_clamped = max(cfg.age_min, min(cfg.age_max, int(age)))
    denom = max(1, cfg.age_max - cfg.age_min)
    return float(age_clamped - cfg.age_min) / float(denom)


def encode_gender_onehot(value: str | None) -> List[float]:
    g = normalize_gender(value)
    if g == "male":
        return [1.0, 0.0, 0.0]
    if g == "female":
        return [0.0, 1.0, 0.0]
    return [0.0, 0.0, 1.0]
