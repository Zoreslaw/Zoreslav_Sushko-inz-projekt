import logging
from typing import Dict, List, Tuple
from src.data_models import User
from src.features import Featurizer, SparseVector
from src.filters import make_eligibility_filter
from src.retrieval import build_like_dislike_centroids, rocchio_query
from src.ranking import score_against_pool, topk

logger = logging.getLogger(__name__)

def _build_pool_vecs(users: List[User], fe: Featurizer) -> Dict[str, SparseVector]:
    """id -> L2-normalized vector (from Featurizer)."""
    pool: Dict[str, SparseVector] = {}
    for u in users:
        pool[u.id] = fe.transform(u)
    return pool

def _pick_probe(users: List[User]) -> User:
    """Pick a probe user for demo. For now: first user with non-empty vector later."""
    return users[0]

def _print_topk(label: str, probe_id: str, scores: List[Tuple[str, float]], k: int) -> None:
    logger.info("[%s] top-%d for probe=%s", label, k, probe_id)
    for uid, sc in scores[:k]:
        logger.info("  %s  score=%.4f", uid, sc)

def preview_content_based(users: List[User], args) -> None:
    # 1) Fit featurizer and log layout
    fe = Featurizer().fit(users)
    logger.info(
        "[eval] Featurizer: dim=%d (games=%d, cats=%d, langs=%d) | offsets: games=%d, cats=%d, langs=%d",
        fe.state.dim,
        len(fe.state.vocab_games),
        len(fe.state.vocab_categories),
        len(fe.state.vocab_languages),
        fe.state.offset_games,
        fe.state.offset_categories,
        fe.state.offset_languages,
    )

    # 2) Pick probe
    probe = _pick_probe(users)
    q_base_all = fe.transform(probe)
    if not q_base_all:
        logger.warning("[eval] probe=%s produced empty vector — no features; abort preview.", probe.id)
        return

    # 3)
    elig = make_eligibility_filter(probe)
    users_filtered = [u for u in users if u.id != probe.id and elig(u)]
    if not users_filtered:
        logger.warning("[eval] No eligible candidates after filtering for probe=%s", probe.id)
        return

    # 4) Build pool
    pool_vecs = _build_pool_vecs(users_filtered, fe)

    # 5)
    q_base = q_base_all

    # 6) Strict vs Feedback
    if args.cb_mode == "strict":
        q_query = q_base
        label = "eval/strict"
        logger.info("[eval] CB mode: strict (only profile)")
    else:

        Lbar, Dbar = build_like_dislike_centroids(probe.liked, probe.disliked, pool_vecs)
        q_query = rocchio_query(q_base, Lbar, Dbar, alpha=args.alpha, beta=args.beta, gamma=args.gamma)
        label = "eval/feedback"
        logger.info("[eval] CB mode: feedback (Rocchio)  α=%.2f β=%.2f γ=%.2f", args.alpha, args.beta, args.gamma)
        if Lbar:
            logger.info("[diag] Lbar nnz=%d", len(Lbar))
        if Dbar:
            logger.info("[diag] Dbar nnz=%d", len(Dbar))

    # 7) Rank and print
    scores = score_against_pool(q_query, pool_vecs, exclude=None)
    _print_topk(label, probe.id, scores, args.k)