#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recommendation generation using trained two-tower models.
"""

from typing import List, Tuple, Optional
import torch

from models.domain import DataStore
from models.neural_network import TwoTowerV2
from data.features import build_feature_tensors_v2


def topk_recommend(
    model: TwoTowerV2,
    dat: DataStore,
    user_id: int,
    K: int = 5,
    device: Optional[torch.device] = None
) -> List[Tuple[int, float]]:
    """
    Generate top-K recommendations for a user.
    
    Args:
        model: Trained TwoTowerV2 model
        dat: DataStore with user profiles
        user_id: ID of user to generate recommendations for
        K: Number of recommendations to return
        device: PyTorch device
    
    Returns:
        List of (candidate_id, score) tuples, sorted by score descending
    """
    if device is None:
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    profiles = dat.users
    if user_id < 0 or user_id >= len(profiles):
        return []

    # Set model to evaluation mode (important for batch norm and dropout)
    model.eval()
    
    # Encode query user (V2 with user IDs)
    uid_u, age_u, gen_u, games_u = build_feature_tensors_v2(profiles, [user_id], device)
    with torch.no_grad():
        e_u = model.user_embed(uid_u, age_u, gen_u, games_u)

    # Encode all candidates (excluding the query user and users with existing interactions)
    # Exclude: the query user itself, users with positive interactions, users with negative interactions
    interacted_users = set()
    for (u, c) in dat.interactions.positives:
        if u == user_id:
            interacted_users.add(c)
    for (u, c) in dat.interactions.negatives:
        if u == user_id:
            interacted_users.add(c)
    
    cand_ids = [i for i in range(len(profiles)) if i != user_id and i not in interacted_users]
    uid_c, age_c, gen_c, games_c = build_feature_tensors_v2(profiles, cand_ids, device)
    with torch.no_grad():
        e_c = model.item_embed(uid_c, age_c, gen_c, games_c)
        scores = model.score(e_u.repeat(e_c.shape[0], 1), e_c).cpu().numpy().tolist()

    # Sort by score and return top-K
    pairs = list(zip(cand_ids, scores))
    pairs.sort(key=lambda t: t[1], reverse=True)
    return pairs[:K]

