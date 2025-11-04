#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Evaluation metrics for recommendation systems.

Includes:
- Recall@K
- Precision@K
- NDCG@K
- MRR (Mean Reciprocal Rank)
- Hit Rate@K
"""

from typing import List, Set, Dict
import numpy as np


def recall_at_k(relevant: Set[int], recommended: List[int], k: int) -> float:
    """
    Recall@K: Fraction of relevant items in top-K recommendations.
    
    Args:
        relevant: Set of relevant item IDs
        recommended: List of recommended item IDs (ranked)
        k: Number of top recommendations to consider
    
    Returns:
        Recall@K score
    """
    if len(relevant) == 0:
        return 0.0
    
    top_k = set(recommended[:k])
    hits = len(relevant & top_k)
    return hits / len(relevant)


def precision_at_k(relevant: Set[int], recommended: List[int], k: int) -> float:
    """
    Precision@K: Fraction of top-K recommendations that are relevant.
    
    Args:
        relevant: Set of relevant item IDs
        recommended: List of recommended item IDs (ranked)
        k: Number of top recommendations to consider
    
    Returns:
        Precision@K score
    """
    if k == 0:
        return 0.0
    
    top_k = set(recommended[:k])
    hits = len(relevant & top_k)
    return hits / k


def ndcg_at_k(relevant: Set[int], recommended: List[int], k: int) -> float:
    """
    NDCG@K: Normalized Discounted Cumulative Gain at K.
    
    Accounts for position of relevant items (higher positions = better).
    
    Args:
        relevant: Set of relevant item IDs
        recommended: List of recommended item IDs (ranked)
        k: Number of top recommendations to consider
    
    Returns:
        NDCG@K score
    """
    if len(relevant) == 0:
        return 0.0
    
    # DCG: sum of relevances discounted by log position
    dcg = 0.0
    for i, item_id in enumerate(recommended[:k]):
        if item_id in relevant:
            dcg += 1.0 / np.log2(i + 2)  # +2 because log2(1) = 0
    
    # IDCG: ideal DCG (all relevant items at top)
    idcg = sum(1.0 / np.log2(i + 2) for i in range(min(len(relevant), k)))
    
    return dcg / idcg if idcg > 0 else 0.0


def mean_reciprocal_rank(relevant: Set[int], recommended: List[int]) -> float:
    """
    MRR: Mean Reciprocal Rank - position of first relevant item.
    
    Args:
        relevant: Set of relevant item IDs
        recommended: List of recommended item IDs (ranked)
    
    Returns:
        Reciprocal rank (1/rank of first relevant item)
    """
    for i, item_id in enumerate(recommended):
        if item_id in relevant:
            return 1.0 / (i + 1)
    return 0.0


def hit_rate_at_k(relevant: Set[int], recommended: List[int], k: int) -> float:
    """
    Hit Rate@K: Binary indicator of whether any relevant item is in top-K.
    
    Args:
        relevant: Set of relevant item IDs
        recommended: List of recommended item IDs (ranked)
        k: Number of top recommendations to consider
    
    Returns:
        1.0 if hit, 0.0 otherwise
    """
    top_k = set(recommended[:k])
    return 1.0 if len(relevant & top_k) > 0 else 0.0


def average_precision(relevant: Set[int], recommended: List[int]) -> float:
    """
    Average Precision: Mean of precision@k for each relevant item in recommendations.
    
    Args:
        relevant: Set of relevant item IDs
        recommended: List of recommended item IDs (ranked)
    
    Returns:
        Average precision score
    """
    if len(relevant) == 0:
        return 0.0
    
    score = 0.0
    num_hits = 0
    
    for i, item_id in enumerate(recommended):
        if item_id in relevant:
            num_hits += 1
            score += num_hits / (i + 1)
    
    return score / len(relevant)


def compute_all_metrics(
    relevant: Set[int],
    recommended: List[int],
    k_values: List[int] = [1, 5, 10, 20]
) -> Dict[str, float]:
    """
    Compute all metrics for a single query.
    
    Args:
        relevant: Set of relevant item IDs
        recommended: List of recommended item IDs (ranked)
        k_values: List of K values for @K metrics
    
    Returns:
        Dictionary of metric names and scores
    """
    metrics = {}
    
    for k in k_values:
        metrics[f'recall@{k}'] = recall_at_k(relevant, recommended, k)
        metrics[f'precision@{k}'] = precision_at_k(relevant, recommended, k)
        metrics[f'ndcg@{k}'] = ndcg_at_k(relevant, recommended, k)
        metrics[f'hit_rate@{k}'] = hit_rate_at_k(relevant, recommended, k)
    
    metrics['mrr'] = mean_reciprocal_rank(relevant, recommended)
    metrics['map'] = average_precision(relevant, recommended)
    
    return metrics


def aggregate_metrics(all_metrics: List[Dict[str, float]]) -> Dict[str, float]:
    """
    Aggregate metrics across multiple queries.
    
    Args:
        all_metrics: List of metric dictionaries
    
    Returns:
        Dictionary of averaged metrics
    """
    if not all_metrics:
        return {}
    
    aggregated = {}
    metric_names = all_metrics[0].keys()
    
    for name in metric_names:
        values = [m[name] for m in all_metrics]
        aggregated[name] = np.mean(values)
    
    return aggregated

