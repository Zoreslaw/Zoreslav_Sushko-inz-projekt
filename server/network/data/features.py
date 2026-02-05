#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced feature encoding with support for additional user features.
"""

from typing import List, Tuple
import numpy as np
import torch

from models.domain import GAME_TO_ID, UserProfile


def normalize_age(age: int, min_age: int = 12, max_age: int = 60) -> float:
    """Normalize age to [0, 1] range."""
    return float((age - min_age) / (max_age - min_age))


def encode_gender_onehot(g: str) -> np.ndarray:
    """Encode gender as one-hot vector."""
    if g in {'M', 'male', 'Male'}:
        return np.array([1.0, 0.0], dtype=np.float32)
    return np.array([0.0, 1.0], dtype=np.float32)


def encode_games_indices(games: List[str]) -> List[int]:
    """Convert game names to indices."""
    idxs = []
    seen = set()
    for g in games:
        if g in GAME_TO_ID and g not in seen:
            idxs.append(GAME_TO_ID[g])
            seen.add(g)
    return idxs


def build_feature_tensors_v2(
    profiles: List[UserProfile], 
    idxs: List[int], 
    device: torch.device
) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, List[List[int]]]:
    """
    Build feature tensors for a batch of users (v2 with user IDs).
    
    Returns:
        user_ids: [batch_size] - User IDs for embedding lookup
        ages: [batch_size, 1] - Normalized ages
        genders: [batch_size, 2] - One-hot encoded genders
        games_list: List of game index lists
    """
    user_ids = []
    ages = []
    genders = []
    games_list = []
    
    for i in idxs:
        p = profiles[i]
        user_ids.append(p.user_id)
        ages.append([normalize_age(p.age)])
        genders.append(encode_gender_onehot(p.gender))
        games_list.append(encode_games_indices(p.games))
    
    user_ids_t = torch.tensor(user_ids, dtype=torch.long, device=device)
    age_t = torch.tensor(ages, dtype=torch.float32, device=device)
    gender_t = torch.tensor(np.stack(genders), dtype=torch.float32, device=device)
    
    return user_ids_t, age_t, gender_t, games_list


# Backward compatibility
def build_feature_tensors(profiles: List[UserProfile], idxs: List[int], device: torch.device):
    """
    Original function for backward compatibility.
    Returns only age, gender, games (no user IDs).
    """
    ages = []
    genders = []
    games_list = []
    for i in idxs:
        p = profiles[i]
        ages.append([normalize_age(p.age)])
        genders.append(encode_gender_onehot(p.gender))
        games_list.append(encode_games_indices(p.games))
    age_t = torch.tensor(ages, dtype=torch.float32, device=device)
    gender_t = torch.tensor(np.stack(genders), dtype=torch.float32, device=device)
    return age_t, gender_t, games_list

