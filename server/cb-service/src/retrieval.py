from typing import Dict, List, Optional, Tuple
from src.features import SparseVector, add_scaled, _l2_normalize_sparse

def build_centroid(
    ids: List[str],
    pool: Dict[str, SparseVector],
    weights: Optional[Dict[str, float]] = None
) -> Optional[SparseVector]:
    """Average of L2-normalized vectors for given ids (optionally weighted).
       Returns None if no vectors found.
    """
    accum: SparseVector = {}
    sum_w = 0.0

    seen = set()

    for _id in ids:
        if not _id or _id in seen:
            continue
        seen.add(_id)

        v = pool.get(_id)

        if not v:
            continue

        w = 1.0

        if weights is not None:
            w = float(weights.get(_id, 1.0))

        add_scaled(accum, v, w)
        sum_w += w

    if sum_w == 0.0:
        return None

    avg: SparseVector = {k: val / sum_w for k, val in accum.items()}

    _l2_normalize_sparse(avg)
    return avg

def build_like_dislike_centroids(
    liked_ids: List[str],
    disliked_ids: List[str],
    pool: Dict[str, SparseVector],
    w_like: Optional[Dict[str, float]] = None,
    w_dislike: Optional[Dict[str, float]] = None
) -> Tuple[Optional[SparseVector], Optional[SparseVector]]:
    """Convenience wrapper to build both Lbar and Dbar."""
    lbar = build_centroid(liked_ids, pool, w_like)
    dbar = build_centroid(disliked_ids, pool, w_dislike)
    return lbar, dbar

def rocchio_query(
    q_base: SparseVector,
    lbar: Optional[SparseVector],
    dbar: Optional[SparseVector],
    alpha: float = 1.0,
    beta: float  = 0.6,
    gamma: float = 0.3
) -> SparseVector:
    """q' = alpha*q + beta*lbar - gamma*dbar, then L2-normalize."""

    accum: SparseVector = {}

    add_scaled(accum, q_base, alpha)

    if lbar:
        add_scaled(accum, lbar, beta)

    if dbar:
        add_scaled(accum, dbar, -gamma)

    _l2_normalize_sparse(accum)
    return accum
