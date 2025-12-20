"""
Recommendation evaluation metrics: Precision@K, Recall@K, NDCG, Hit Rate
"""
import math
from typing import List, Set, Dict, Tuple, Optional

def precision_at_k(recommended: List[str], relevant: Set[str], k: int) -> float:
    """
    Precision@K = |relevant items in top K| / min(K, |recommended|)
    
    Args:
        recommended: List of recommended user IDs (top K)
        relevant: Set of relevant (liked) user IDs
        k: Number of recommendations to consider
    
    Returns:
        Precision@K score (0.0 to 1.0)
    """
    if k == 0:
        return 0.0
    effective_k = min(k, len(recommended))
    if effective_k == 0:
        return 0.0
    top_k = recommended[:effective_k]
    relevant_in_topk = sum(1 for uid in top_k if uid in relevant)
    return relevant_in_topk / effective_k

def recall_at_k(recommended: List[str], relevant: Set[str], k: int) -> float:
    """
    Recall@K = |relevant items in top K| / |relevant items|
    
    Args:
        recommended: List of recommended user IDs (top K)
        relevant: Set of relevant (liked) user IDs
        k: Number of recommendations to consider
    
    Returns:
        Recall@K score (0.0 to 1.0), or 0.0 if no relevant items
    """
    if len(relevant) == 0:
        return 0.0
    top_k = recommended[:min(k, len(recommended))]
    relevant_in_topk = sum(1 for uid in top_k if uid in relevant)
    return relevant_in_topk / len(relevant)

def ndcg_at_k(recommended: List[str], relevant: Set[str], k: int) -> float:
    """
    Normalized Discounted Cumulative Gain@K
    
    NDCG@K = DCG@K / IDCG@K
    DCG@K = sum(rel_i / log2(i+1)) for i in [1, K]
    IDCG@K = DCG of ideal ranking (all relevant items first)
    
    Args:
        recommended: List of recommended user IDs (top K)
        relevant: Set of relevant (liked) user IDs
        k: Number of recommendations to consider
    
    Returns:
        NDCG@K score (0.0 to 1.0)
    """
    def dcg_at_k(ranking: List[str], rel_set: Set[str], k_val: int) -> float:
        """Calculate DCG for a ranking."""
        score = 0.0
        for i, uid in enumerate(ranking[:k_val], start=1):
            if uid in rel_set:
                # Binary relevance (1 if relevant, 0 otherwise)
                rel = 1.0
                score += rel / math.log2(i + 1)
        return score
    
    def idcg_at_k(num_relevant: int, k_val: int) -> float:
        """Calculate IDCG (ideal DCG) - all relevant items ranked first."""
        if num_relevant == 0:
            return 0.0
        score = 0.0
        for i in range(1, min(num_relevant, k_val) + 1):
            score += 1.0 / math.log2(i + 1)
        return score
    
    num_relevant = len(relevant)
    
    if num_relevant == 0:
        return 0.0
    
    dcg = dcg_at_k(recommended, relevant, k)
    idcg = idcg_at_k(num_relevant, k)
    
    if idcg == 0.0:
        return 0.0
    
    return dcg / idcg

def hit_rate_at_k(recommended: List[str], relevant: Set[str], k: int) -> float:
    """
    Hit Rate@K = 1 if at least one relevant item in top K, else 0
    
    Args:
        recommended: List of recommended user IDs (top K)
        relevant: Set of relevant (liked) user IDs
        k: Number of recommendations to consider
    
    Returns:
        1.0 if hit, 0.0 otherwise
    """
    if len(relevant) == 0:
        return 0.0
    top_k = recommended[:min(k, len(recommended))]
    return 1.0 if any(uid in relevant for uid in top_k) else 0.0

def _normalize_recommendations(recommended: List[str]) -> List[str]:
    seen = set()
    normalized = []
    for uid in recommended:
        if not uid or uid in seen:
            continue
        seen.add(uid)
        normalized.append(uid)
    return normalized

def calculate_metrics(
    recommendations: List[str],
    ground_truth: Set[str],
    k_values: List[int] = [5, 10, 20]
) -> Dict[str, Dict[int, float]]:
    """
    Calculate all metrics for multiple K values.
    
    Args:
        recommendations: List of recommended user IDs (ordered by score)
        ground_truth: Set of relevant (liked) user IDs
        k_values: List of K values to evaluate
    
    Returns:
        Dictionary with metrics for each K value
    """
    results = {
        "precision": {},
        "recall": {},
        "ndcg": {},
        "hit_rate": {}
    }
    
    normalized = _normalize_recommendations(recommendations)

    for k in k_values:
        results["precision"][k] = precision_at_k(normalized, ground_truth, k)
        results["recall"][k] = recall_at_k(normalized, ground_truth, k)
        results["ndcg"][k] = ndcg_at_k(normalized, ground_truth, k)
        results["hit_rate"][k] = hit_rate_at_k(normalized, ground_truth, k)
    
    return results

def calculate_product_metrics(
    recommendations: List[str],
    mutual_accepts: Set[str],
    chat_starts: Set[str],
    k_values: List[int] = [5, 10, 20]
) -> Dict[str, Dict[int, float]]:
    """
    Calculate product metrics: mutual accept rate and chat start rate.
    
    Args:
        recommendations: List of recommended user IDs
        mutual_accepts: Set of user IDs that resulted in mutual accepts (matches)
        chat_starts: Set of user IDs that resulted in chat starts
        k_values: List of K values to evaluate
    
    Returns:
        Dictionary with product metrics for each K value
    """
    results = {
        "mutual_accept_rate": {},
        "chat_start_rate": {}
    }
    
    normalized = _normalize_recommendations(recommendations)

    for k in k_values:
        effective_k = min(k, len(normalized))
        top_k = set(normalized[:effective_k])
        
        # Mutual accept rate = |mutual accepts in top K| / min(K, |recommended|)
        mutual_in_topk = len(top_k & mutual_accepts)
        results["mutual_accept_rate"][k] = mutual_in_topk / effective_k if effective_k > 0 else 0.0
        
        # Chat start rate = |chat starts in top K| / min(K, |recommended|)
        chat_in_topk = len(top_k & chat_starts)
        results["chat_start_rate"][k] = chat_in_topk / effective_k if effective_k > 0 else 0.0
    
    return results

