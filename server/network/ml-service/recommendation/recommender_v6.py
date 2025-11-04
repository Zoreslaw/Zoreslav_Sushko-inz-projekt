#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V6 EXTREME Recommender with post-processing filters.
"""

from typing import List, Tuple, Optional
import torch

from models.domain import DataStore
from models.neural_network_v6 import TwoTowerV6Extreme
from data.features import build_feature_tensors_v2


def topk_recommend_v6(
    model: TwoTowerV6Extreme,
    dat: DataStore,
    user_id: int,
    K: int = 20,
    device: Optional[torch.device] = None,
    use_rejection_filter: bool = True,
    rejection_threshold: float = 0.5
) -> List[Tuple[int, float]]:
    """
    Get top-K recommendations with optional rejection filtering.
    
    Args:
        use_rejection_filter: If True, filter out candidates with high rejection scores
        rejection_threshold: Threshold for rejection (0-1)
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    model.eval()
    model.to(device)
    
    profiles = dat.users
    if user_id < 0 or user_id >= len(profiles):
        return []
    
    # Exclude users with existing interactions
    interacted_users = set()
    for (u, c) in dat.interactions.positives:
        if u == user_id:
            interacted_users.add(c)
    for (u, c) in dat.interactions.negatives:
        if u == user_id:
            interacted_users.add(c)
    
    cand_ids = [i for i in range(len(profiles)) 
                if i != user_id and i not in interacted_users]
    
    if not cand_ids:
        return []
    
    with torch.no_grad():
        # Encode query user
        user_ids_q, age_q, gender_q, games_q = build_feature_tensors_v2(profiles, [user_id], device)
        q_emb, q_rej = model.encode_user(user_ids_q, age_q, gender_q, games_q)
        
        # Encode all candidates
        user_ids_c, age_c, gender_c, games_c = build_feature_tensors_v2(profiles, cand_ids, device)
        c_emb, c_rej = model.encode_item(user_ids_c, age_c, gender_c, games_c)
        
        # Compute scores
        scores = model.score(
            q_emb.expand(len(cand_ids), -1),
            c_emb
        ).cpu().numpy()
        
        # Optional: filter by rejection score
        if use_rejection_filter:
            # Compute rejection indicator (high score = should be rejected)
            rejection_indicator = c_rej.mean(dim=1).cpu().numpy()  # Average across rejection features
            
            # Penalize candidates with high rejection scores
            scores = scores - rejection_indicator * 10.0  # Heavy penalty
        
        # Sort by score
        sorted_indices = scores.argsort()[::-1]
        
        # Return top-K
        results = []
        for idx in sorted_indices[:K]:
            cid = cand_ids[idx]
            score = float(scores[idx])
            results.append((cid, score))
        
        return results


