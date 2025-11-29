from typing import Dict, List, Tuple, Optional
from src.features import SparseVector, cosine_sparse

def score_against_pool(
    query: SparseVector,
    pool: Dict[str, SparseVector],
    exclude: Optional[str] = None
) -> List[Tuple[str, float]]:
    """Compute cosine(query, v) for each id->v in pool; optionally exclude one id."""
    scores: List[Tuple[str, float]] = []
    for uid, v in pool.items():
        if exclude and uid == exclude:
            continue
        scores.append((uid, cosine_sparse(query, v)))
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores

def topk(scores: List[Tuple[str, float]], k: int) -> List[Tuple[str, float]]:
    return scores[:k]