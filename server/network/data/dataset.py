#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyTorch dataset classes for training.
"""

import random
from typing import List, Tuple
from torch.utils.data import Dataset

from models.domain import DataStore


class PairDataset(Dataset):
    """Dataset of (user, positive_item, negative_item) triples for BPR training."""
    
    def __init__(self, triples: List[Tuple[int, int, int]]):
        self.triples = triples
    
    def __len__(self):
        return len(self.triples)
    
    def __getitem__(self, idx):
        return self.triples[idx]


def _compute_similarity(user1, user2) -> float:
    """Compute similarity between two users for hard negative mining."""
    score = 0.0
    
    # Age similarity (closer age = higher score)
    age_diff = abs(user1.age - user2.age)
    if age_diff < 5:
        score += 3.0
    elif age_diff < 10:
        score += 2.0
    elif age_diff < 15:
        score += 1.0
    
    # Gender match
    if user1.gender == user2.gender:
        score += 2.0
    
    # Common games (most important!)
    common_games = len(set(user1.games) & set(user2.games))
    score += common_games * 5.0  # High weight for game overlap

    # Common categories/languages (soft signals)
    common_categories = len(set(getattr(user1, "categories", [])) & set(getattr(user2, "categories", [])))
    common_languages = len(set(getattr(user1, "languages", [])) & set(getattr(user2, "languages", [])))
    score += common_categories * 2.0
    score += common_languages * 1.0
    
    return score


def sample_triples(
    dat: DataStore, 
    neg_per_pos: int = 3, 
    seed: int = 42,
    hard_negative_ratio: float = 0.5
) -> List[Tuple[int, int, int]]:
    """
    Generate training triples (user, positive_item, negative_item) for BPR loss.
    
    Uses hard negative mining: selects negatives that are similar to positives
    to make the model learn finer distinctions.
    
    Args:
        dat: DataStore containing users and interactions
        neg_per_pos: Number of negative samples per positive interaction
        seed: Random seed for reproducibility
        hard_negative_ratio: Fraction of negatives that should be "hard" (similar)
    
    Returns:
        List of (u, v_pos, v_neg) triples
    """
    random.seed(seed)
    all_ids = list(range(len(dat.users)))
    pos = dat.interactions.positives.copy()
    positives_set = set(pos)
    negatives_set = set(dat.interactions.negatives)
    triples = []
    
    # Generate negatives for each positive
    for (u, vp) in pos:
        # Get all valid negative candidates (not self, not positive, not explicit negative)
        candidates = [x for x in all_ids 
                     if x != u 
                     and (u, x) not in positives_set 
                     and (u, x) not in negatives_set]
        
        # Split into hard and easy negatives
        num_hard = int(neg_per_pos * hard_negative_ratio)
        num_easy = neg_per_pos - num_hard
        
        # Hard negatives: similar to positive
        if num_hard > 0 and candidates:
            user = dat.users[u]
            vp_profile = dat.users[vp]
            
            # Score all candidates by similarity to positive
            similarities = [(c, _compute_similarity(dat.users[c], vp_profile)) 
                           for c in candidates]
            similarities.sort(key=lambda x: x[1], reverse=True)  # Most similar first
            
            # Take top similar candidates as hard negatives
            hard_negs = [c for c, _ in similarities[:min(num_hard * 3, len(similarities))]]
            random.shuffle(hard_negs)
            hard_negs = hard_negs[:num_hard]
        else:
            hard_negs = []
        
        # Easy negatives: random
        remaining = [c for c in candidates if c not in hard_negs]
        random.shuffle(remaining)
        easy_negs = remaining[:num_easy]
        
        # Combine
        selected_negs = hard_negs + easy_negs
        for vn in selected_negs:
            triples.append((u, vp, vn))
    
    # Use explicit negatives
    for (u, vn) in dat.interactions.negatives:
        u_pos = [vp for (uu, vp) in dat.interactions.positives if uu == u]
        if not u_pos:
            continue
        vp = random.choice(u_pos)
        triples.append((u, vp, vn))
    
    return triples

