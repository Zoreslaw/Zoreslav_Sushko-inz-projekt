import os
import logging
import sys
from dataclasses import replace
from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src.data_models import User
from src.io_backend import fetch_users_api, map_backend_to_user, BackendUserRow
from src.recommender import ContentBasedRecommender

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="TeamUp Content-Based Recommendation Service", version="1.0.0")

# Global recommender instance
recommender: Optional[ContentBasedRecommender] = None
users_cache: List[User] = []

# Pydantic models for API
class UserProfile(BaseModel):
    id: str
    age: int
    gender: str
    games: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)

class RecommendationRequest(BaseModel):
    targetUser: UserProfile
    candidates: List[UserProfile] = Field(default_factory=list)
    topK: int = Field(default=20, ge=1, le=100)
    mode: str = Field(default="feedback")
    targetLikedIds: Optional[List[str]] = None
    targetDislikedIds: Optional[List[str]] = None

class RecommendationResult(BaseModel):
    userId: str
    score: float

class RecommendationResponse(BaseModel):
    results: List[RecommendationResult]
    modelVersion: str = "content-based-v1"
    timestamp: str
    processingTimeMs: int
    totalCandidates: int

def _user_profile_to_user(
    profile: UserProfile,
    all_users: Optional[List[User]] = None,
    liked_override: Optional[List[str]] = None,
    disliked_override: Optional[List[str]] = None
) -> User:
    """Convert UserProfile to User domain model."""
    # Try to find full user data from cache if available
    if all_users:
        cached = next((u for u in all_users if u.id == profile.id), None)
        if cached:
            user = cached
        else:
            user = User(
                id=profile.id,
                age=profile.age,
                gender=profile.gender,
                favorite_games=profile.games,
                languages=profile.languages,
            )
    else:
        user = User(
            id=profile.id,
            age=profile.age,
            gender=profile.gender,
            favorite_games=profile.games,
            languages=profile.languages,
        )

    if liked_override is None and disliked_override is None:
        return user

    return replace(
        user,
        liked=list(liked_override if liked_override is not None else user.liked),
        disliked=list(disliked_override if disliked_override is not None else user.disliked),
    )

@app.on_event("startup")
async def startup_event():
    """Initialize recommender on startup."""
    global recommender, users_cache
    
    logger.info("[api] Starting Content-Based Recommendation Service")
    
    # Try to load users from backend API for initial fit
    backend_url = os.getenv("BACKEND_URL", "http://backend:8080")
    if not backend_url.endswith("/api/users"):
        backend_url = f"{backend_url}/api/users"
    try:
        logger.info(f"[api] Loading users from backend: {backend_url}")
        # Use longer timeout and retry logic for startup
        import time
        max_retries = 3
        for attempt in range(max_retries):
            try:
                users_cache = fetch_users_api(backend_url, timeout=15.0)
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.info(f"[api] Backend not ready, retrying in 5s... (attempt {attempt + 1}/{max_retries})")
                    time.sleep(5)
                else:
                    raise
        if users_cache:
            recommender = ContentBasedRecommender(alpha=1.0, beta=0.6, gamma=0.3)
            recommender.fit(users_cache)
            logger.info(f"[api] Recommender initialized with {len(users_cache)} users")
        else:
            logger.warning("[api] No users loaded, recommender will be lazy-initialized")
            recommender = ContentBasedRecommender(alpha=1.0, beta=0.6, gamma=0.3)
    except Exception as e:
        logger.warning(f"[api] Failed to load users on startup: {e}, will lazy-initialize")
        recommender = ContentBasedRecommender(alpha=1.0, beta=0.6, gamma=0.3)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model_loaded": recommender is not None and recommender.featurizer is not None,
        "model_version": "content-based-v1",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/ml/recommend", response_model=RecommendationResponse)
async def recommend(request: RecommendationRequest):
    """Generate content-based recommendations."""
    global recommender, users_cache
    
    start_time = datetime.utcnow()
    
    try:
        if not request.targetUser:
            raise HTTPException(status_code=400, detail="targetUser is required")
        if not request.candidates:
            raise HTTPException(status_code=400, detail="candidates list is required")
        
        logger.info(
            f"[api] Recommendation request: target={request.targetUser.id} "
            f"candidates={len(request.candidates)} topK={request.topK}"
        )
        
        # Ensure recommender is initialized
        if not recommender or not recommender.featurizer:
            # Try to reload users and fit
            backend_url = os.getenv("BACKEND_URL", "http://backend:8080")
            if not backend_url.endswith("/api/users"):
                backend_url = f"{backend_url}/api/users"
            try:
                users_cache = fetch_users_api(backend_url, timeout=10.0)
                if users_cache:
                    recommender = ContentBasedRecommender(alpha=1.0, beta=0.6, gamma=0.3)
                    recommender.fit(users_cache)
                    logger.info(f"[api] Recommender lazy-initialized with {len(users_cache)} users")
                else:
                    raise HTTPException(
                        status_code=503,
                        detail="No users available for recommendation service"
                    )
            except Exception as e:
                logger.error(f"[api] Failed to initialize recommender: {e}")
                raise HTTPException(
                    status_code=503,
                    detail=f"Recommendation service not ready: {str(e)}"
                )
        
        # Convert profiles to User objects
        target_user = _user_profile_to_user(
            request.targetUser,
            users_cache,
            liked_override=request.targetLikedIds,
            disliked_override=request.targetDislikedIds
        )
        candidates = [_user_profile_to_user(c, users_cache) for c in request.candidates]
        
        # Generate recommendations (using feedback mode by default)
        mode = request.mode or "feedback"
        if mode not in ("strict", "feedback"):
            logger.warning("[api] Unknown mode '%s', defaulting to feedback", mode)
            mode = "feedback"

        recommendations = recommender.recommend(
            target_user=target_user,
            candidates=candidates,
            top_k=request.topK,
            mode=mode
        )
        
        # Convert to response format
        results = [
            RecommendationResult(userId=uid, score=float(score))
            for uid, score in recommendations
        ]
        
        processing_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        # Log if we're returning fewer recommendations than requested
        if len(results) < request.topK:
            logger.warning(
                f"[api] Requested {request.topK} recommendations but only returning {len(results)} "
                f"(candidates provided: {len(candidates)})"
            )
        
        logger.info(
            f"[api] Generated {len(results)}/{request.topK} requested recommendations in {processing_time_ms}ms"
        )
        
        return RecommendationResponse(
            results=results,
            modelVersion="content-based-v1",
            timestamp=datetime.utcnow().isoformat(),
            processingTimeMs=processing_time_ms,
            totalCandidates=len(request.candidates)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[api] Error in /ml/recommend: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/ml/model-info")
async def model_info():
    """Get model information."""
    if not recommender or not recommender.featurizer:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    fe = recommender.featurizer
    return {
        "version": "content-based-v1",
        "architecture": "Content-Based (Sparse Vectors + Cosine Similarity)",
        "parameters": {
            "alpha": recommender.alpha,
            "beta": recommender.beta,
            "gamma": recommender.gamma,
            "dimension": fe.state.dim,
            "vocab_games": len(fe.state.vocab_games),
            "vocab_categories": len(fe.state.vocab_categories),
            "vocab_languages": len(fe.state.vocab_languages),
        },
        "users_fitted": len(users_cache)
    }

@app.post("/ml/metrics")
async def calculate_metrics_endpoint(request: Dict[str, Any]):
    """Calculate recommendation metrics (internal use, called by backend)."""
    from src.metrics import calculate_metrics, calculate_product_metrics
    
    try:
        recommended_ids = request.get("recommendedIds", [])
        ground_truth = set(request.get("groundTruth", []))
        mutual_accepts = set(request.get("mutualAccepts", []))
        chat_starts = set(request.get("chatStarts", []))
        k_values = request.get("kValues", [5, 10, 20])
        
        if not recommended_ids:
            raise HTTPException(status_code=400, detail="recommendedIds is required")
        
        # Calculate recommendation metrics
        rec_metrics = calculate_metrics(recommended_ids, ground_truth, k_values)
        
        # Calculate product metrics
        prod_metrics = calculate_product_metrics(
            recommended_ids, mutual_accepts, chat_starts, k_values
        )
        
        # Combine results
        return {
            "precision": rec_metrics["precision"],
            "recall": rec_metrics["recall"],
            "ndcg": rec_metrics["ndcg"],
            "hit_rate": rec_metrics["hit_rate"],
            "mutual_accept_rate": prod_metrics["mutual_accept_rate"],
            "chat_start_rate": prod_metrics["chat_start_rate"]
        }
    except Exception as e:
        logger.error(f"[api] Error calculating metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error calculating metrics: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
