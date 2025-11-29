import logging
from typing import Dict, List, Tuple, Optional
from src.data_models import User
from src.features import Featurizer, SparseVector
from src.filters import make_eligibility_filter
from src.retrieval import build_like_dislike_centroids, rocchio_query
from src.ranking import score_against_pool, topk

logger = logging.getLogger(__name__)

class ContentBasedRecommender:
    """Content-based recommender using sparse feature vectors and cosine similarity."""
    
    def __init__(self, alpha: float = 1.0, beta: float = 0.6, gamma: float = 0.3):
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma
        self.featurizer: Optional[Featurizer] = None
        self._users_cache: List[User] = []
    
    def fit(self, users: List[User]) -> "ContentBasedRecommender":
        """Fit the featurizer on training users."""
        self.featurizer = Featurizer().fit(users)
        self._users_cache = users
        logger.info(
            "[recommender] Featurizer fitted: dim=%d (games=%d, cats=%d, langs=%d)",
            self.featurizer.state.dim,
            len(self.featurizer.state.vocab_games),
            len(self.featurizer.state.vocab_categories),
            len(self.featurizer.state.vocab_languages),
        )
        return self
    
    def recommend(
        self,
        target_user: User,
        candidates: List[User],
        top_k: int = 20,
        mode: str = "strict"
    ) -> List[Tuple[str, float]]:
        """
        Generate recommendations for target_user from candidates.
        
        Args:
            target_user: User to generate recommendations for
            candidates: List of candidate users
            top_k: Number of recommendations to return
            mode: "strict" (profile only) or "feedback" (Rocchio with likes/dislikes)
        
        Returns:
            List of (user_id, score) tuples sorted by score descending
        """
        if not self.featurizer:
            logger.error("[recommender] Featurizer not fitted")
            return []
        
        # Transform target user
        q_base_all = self.featurizer.transform(target_user)
        if not q_base_all:
            logger.warning("[recommender] target_user=%s produced empty vector", target_user.id)
            return []
        
        # Filter candidates
        elig = make_eligibility_filter(target_user)
        users_filtered = [u for u in candidates if u.id != target_user.id and elig(u)]
        if not users_filtered:
            logger.warning("[recommender] No eligible candidates after filtering for target_user=%s", target_user.id)
            return []
        
        # Build pool vectors
        pool_vecs: Dict[str, SparseVector] = {}
        for u in users_filtered:
            vec = self.featurizer.transform(u)
            if vec:  # Only include users with non-empty vectors
                pool_vecs[u.id] = vec
        
        if not pool_vecs:
            logger.warning("[recommender] No valid candidate vectors for target_user=%s", target_user.id)
            return []
        
        # Build query vector
        if mode == "strict":
            q_query = q_base_all
        else:  # feedback mode
            Lbar, Dbar = build_like_dislike_centroids(
                target_user.liked,
                target_user.disliked,
                pool_vecs
            )
            q_query = rocchio_query(
                q_base_all,
                Lbar,
                Dbar,
                alpha=self.alpha,
                beta=self.beta,
                gamma=self.gamma
            )
        
        # Score and rank
        scores = score_against_pool(q_query, pool_vecs, exclude=None)
        return topk(scores, top_k)

