#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced loss functions for two-tower training.

Includes:
- BPR loss (original)
- BPR loss with margin
- Triplet loss
- InfoNCE (contrastive learning)
"""

import torch
import torch.nn.functional as F


def bpr_loss(s_pos: torch.Tensor, s_neg: torch.Tensor) -> torch.Tensor:
    """
    Bayesian Personalized Ranking loss (original).
    
    Encourages positive pair scores to be higher than negative pair scores.
    
    Args:
        s_pos: Scores for positive pairs
        s_neg: Scores for negative pairs
    
    Returns:
        BPR loss value
    """
    return -torch.log(torch.sigmoid(s_pos - s_neg) + 1e-8).mean()


def bpr_loss_with_margin(
    s_pos: torch.Tensor, 
    s_neg: torch.Tensor, 
    margin: float = 0.5
) -> torch.Tensor:
    """
    BPR loss with margin.
    
    Forces positive scores to be at least 'margin' higher than negative scores.
    
    Args:
        s_pos: Scores for positive pairs
        s_neg: Scores for negative pairs
        margin: Minimum desired gap between positive and negative scores
    
    Returns:
        BPR loss with margin
    """
    return -torch.log(torch.sigmoid(s_pos - s_neg - margin) + 1e-8).mean()


def triplet_loss(
    anchor: torch.Tensor,
    positive: torch.Tensor,
    negative: torch.Tensor,
    margin: float = 1.0
) -> torch.Tensor:
    """
    Triplet loss (used in face recognition, metric learning).
    
    Minimizes distance between anchor-positive while maximizing
    distance between anchor-negative.
    
    Args:
        anchor: Anchor embeddings (query users)
        positive: Positive embeddings (liked candidates)
        negative: Negative embeddings (disliked candidates)
        margin: Minimum desired distance gap
    
    Returns:
        Triplet loss value
    """
    distance_positive = torch.sum((anchor - positive) ** 2, dim=-1)
    distance_negative = torch.sum((anchor - negative) ** 2, dim=-1)
    losses = F.relu(distance_positive - distance_negative + margin)
    return losses.mean()


def infonce_loss(
    query_emb: torch.Tensor,
    positive_emb: torch.Tensor,
    all_candidate_embs: torch.Tensor,
    temperature: float = 0.07
) -> torch.Tensor:
    """
    InfoNCE loss (contrastive learning - used in SimCLR, MoCo).
    
    Treats all other items in the batch as negatives.
    Very effective for retrieval tasks.
    
    Args:
        query_emb: Query embeddings [batch_size, emb_dim]
        positive_emb: Positive embeddings [batch_size, emb_dim]
        all_candidate_embs: All candidate embeddings [num_candidates, emb_dim]
        temperature: Temperature for scaling (lower = harder)
    
    Returns:
        InfoNCE loss value
    """
    # Compute similarities
    pos_sim = torch.sum(query_emb * positive_emb, dim=-1) / temperature  # [batch_size]
    
    # Similarity to all candidates
    all_sim = torch.matmul(query_emb, all_candidate_embs.T) / temperature  # [batch_size, num_candidates]
    
    # InfoNCE: -log(exp(pos) / sum(exp(all)))
    loss = -pos_sim + torch.logsumexp(all_sim, dim=-1)
    return loss.mean()


def contrastive_loss(
    anchor: torch.Tensor,
    positive: torch.Tensor,
    negative: torch.Tensor,
    temperature: float = 0.1
) -> torch.Tensor:
    """
    Simple contrastive loss.
    
    Maximizes similarity between anchor-positive,
    minimizes similarity between anchor-negative.
    
    Args:
        anchor: Anchor embeddings
        positive: Positive embeddings
        negative: Negative embeddings
        temperature: Temperature for scaling
    
    Returns:
        Contrastive loss value
    """
    pos_sim = torch.sum(anchor * positive, dim=-1) / temperature
    neg_sim = torch.sum(anchor * negative, dim=-1) / temperature
    
    # LogSumExp for numerical stability
    logits = torch.stack([pos_sim, neg_sim], dim=1)
    labels = torch.zeros(logits.shape[0], dtype=torch.long, device=logits.device)
    
    return F.cross_entropy(logits, labels)


def weighted_bpr_loss(
    s_pos: torch.Tensor,
    s_neg: torch.Tensor,
    weights: torch.Tensor
) -> torch.Tensor:
    """
    Weighted BPR loss.
    
    Allows different importance for different user-item pairs
    (e.g., based on interaction strength, recency, etc.)
    
    Args:
        s_pos: Scores for positive pairs
        s_neg: Scores for negative pairs
        weights: Importance weights for each pair
    
    Returns:
        Weighted BPR loss
    """
    losses = -torch.log(torch.sigmoid(s_pos - s_neg) + 1e-8)
    return (losses * weights).sum() / weights.sum()


def hinge_loss(
    s_pos: torch.Tensor,
    s_neg: torch.Tensor,
    margin: float = 1.0
) -> torch.Tensor:
    """
    Hinge loss for ranking.
    
    Similar to SVM loss.
    
    Args:
        s_pos: Scores for positive pairs
        s_neg: Scores for negative pairs
        margin: Desired margin
    
    Returns:
        Hinge loss value
    """
    return F.relu(margin - (s_pos - s_neg)).mean()


def gender_weighted_bpr_loss(
    s_pos: torch.Tensor,
    s_neg: torch.Tensor,
    gender_match: torch.Tensor,
    weight_same_gender: float = 1.5
) -> torch.Tensor:
    """
    Gender-weighted BPR loss.
    
    Gives higher weight to same-gender positive pairs to capture gender preferences.
    
    Args:
        s_pos: Scores for positive pairs
        s_neg: Scores for negative pairs
        gender_match: Boolean tensor indicating if gender matches preference (1.0 if match, 0.0 if not)
        weight_same_gender: Weight multiplier for same-gender pairs
    
    Returns:
        Gender-weighted BPR loss
    """
    losses = -torch.log(torch.sigmoid(s_pos - s_neg) + 1e-8)
    
    # Apply weights: higher weight for preferred gender
    weights = torch.where(gender_match > 0.5, 
                         torch.tensor(weight_same_gender, device=losses.device),
                         torch.tensor(1.0, device=losses.device))
    
    return (losses * weights).mean()


# Loss registry for easy switching
LOSS_REGISTRY = {
    'bpr': bpr_loss,
    'bpr_margin': bpr_loss_with_margin,
    'triplet': triplet_loss,
    'infonce': infonce_loss,
    'contrastive': contrastive_loss,
    'weighted_bpr': weighted_bpr_loss,
    'hinge': hinge_loss,
    'gender_weighted_bpr': gender_weighted_bpr_loss
}


def get_loss_function(loss_name: str, **kwargs):
    """
    Get loss function by name.
    
    Args:
        loss_name: Name of the loss function
        **kwargs: Additional arguments for the loss function
    
    Returns:
        Loss function
    """
    if loss_name not in LOSS_REGISTRY:
        raise ValueError(f"Unknown loss: {loss_name}. Available: {list(LOSS_REGISTRY.keys())}")
    
    loss_fn = LOSS_REGISTRY[loss_name]
    
    # Return wrapped function with kwargs
    if kwargs:
        return lambda *args: loss_fn(*args, **kwargs)
    return loss_fn

