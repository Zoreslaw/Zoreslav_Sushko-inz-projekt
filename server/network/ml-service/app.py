#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TeamUp ML Service - Flask API for Hybrid Two-Tower Recommendation Model.
"""

import os
import sys
import logging
import math
from datetime import datetime
from typing import Dict, Any, List

from flask import Flask, request, jsonify
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data.hybrid_features import (
    HybridFeatureConfig,
    encode_gender_onehot,
    encode_tokens,
    normalize_age,
    normalize_list,
    hash_user_id,
)
from models.neural_network_hybrid import TwoTowerHybrid

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

MODEL = None
DEVICE = None
MODEL_VERSION = "hybrid-v1"
FEATURE_CONFIG = None

def _default_feature_config() -> HybridFeatureConfig:
    return HybridFeatureConfig(
        game_to_id={},
        category_to_id={},
        language_to_id={},
        age_min=18,
        age_max=100,
        user_hash_buckets=100_000,
    )

def load_model():
    global MODEL, DEVICE
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {DEVICE}")

    model_path = os.getenv('MODEL_PATH', '/app/models/twotower_v6_optimal.pt')

    cfg = _default_feature_config()
    if os.path.exists(model_path):
        ckpt = torch.load(model_path, map_location=DEVICE)
        if isinstance(ckpt, dict) and "state_dict" in ckpt:
            cfg = HybridFeatureConfig.from_dict(ckpt.get("feature_config", {}))
            state_dict = ckpt.get("state_dict", {})
            model_version = ckpt.get("model_version")
            if model_version:
                global MODEL_VERSION
                MODEL_VERSION = str(model_version)
        else:
            state_dict = ckpt
        MODEL = TwoTowerHybrid(
            user_hash_buckets=cfg.user_hash_buckets,
            game_vocab_size=cfg.game_vocab_size,
            category_vocab_size=cfg.category_vocab_size,
            language_vocab_size=cfg.language_vocab_size,
            emb_user_dim=32,
            emb_token_dim=32,
            tower_hidden=(256, 128),
            out_dim=64,
            dropout=0.3,
            temperature=0.1
        ).to(DEVICE)
        model_dict = MODEL.state_dict()
        filtered = {k: v for k, v in state_dict.items() if k in model_dict and model_dict[k].shape == v.shape}
        model_dict.update(filtered)
        MODEL.load_state_dict(model_dict)
        logger.info(f"Model loaded from {model_path} ({len(filtered)}/{len(state_dict)} tensors)")
    else:
        MODEL = TwoTowerHybrid(
            user_hash_buckets=cfg.user_hash_buckets,
            game_vocab_size=cfg.game_vocab_size,
            category_vocab_size=cfg.category_vocab_size,
            language_vocab_size=cfg.language_vocab_size,
            emb_user_dim=32,
            emb_token_dim=32,
            tower_hidden=(256, 128),
            out_dim=64,
            dropout=0.3,
            temperature=0.1
        ).to(DEVICE)
        logger.warning(f"Model file not found at {model_path}, using untrained model")

    global FEATURE_CONFIG
    FEATURE_CONFIG = cfg

    MODEL.eval()
    logger.info("Model initialization complete")

def user_dict_to_features(user: Dict[str, Any], cfg: HybridFeatureConfig):
    raw_games = (user.get('games') or user.get('favoriteGames') or [])
    raw_games += user.get('otherGames') or []
    raw_games += user.get('steamGames') or []
    games = normalize_list(raw_games)

    categories = []
    if user.get('favoriteCategory'):
        categories.append(user.get('favoriteCategory'))
    categories += user.get('steamCategories') or []
    categories = normalize_list(categories)

    languages = normalize_list(user.get('languages') or [], is_language=True)

    user_id = str(user.get('id') or "")
    uid_hash = hash_user_id(user_id, cfg.user_hash_buckets)
    age = int(user.get('age') or cfg.age_min)
    gender = user.get('gender')

    return {
        "user_id": uid_hash,
        "age": normalize_age(age, cfg),
        "gender": encode_gender_onehot(gender),
        "games": encode_tokens(games, cfg.game_to_id),
        "categories": encode_tokens(categories, cfg.category_to_id),
        "languages": encode_tokens(languages, cfg.language_to_id),
        "raw_id": user_id,
    }

def build_batch_tensors(features: List[Dict[str, Any]]):
    user_ids = [f["user_id"] for f in features]
    ages = [[f["age"]] for f in features]
    genders = [f["gender"] for f in features]
    games = [f["games"] for f in features]
    categories = [f["categories"] for f in features]
    languages = [f["languages"] for f in features]

    user_ids_t = torch.tensor(user_ids, dtype=torch.long, device=DEVICE)
    age_t = torch.tensor(ages, dtype=torch.float32, device=DEVICE)
    gender_t = torch.tensor(genders, dtype=torch.float32, device=DEVICE)

    return user_ids_t, age_t, gender_t, games, categories, languages

@app.get('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'model_loaded': MODEL is not None,
        'device': str(DEVICE),
        'model_version': MODEL_VERSION,
        'timestamp': datetime.utcnow().isoformat()
    }), 200

@app.post('/ml/recommend')
def recommend():
    try:
        start = datetime.utcnow()
        data = request.get_json() or {}
        target_user = data.get('targetUser')
        candidates = data.get('candidates', [])
        top_k = int(data.get('topK', 20))

        if not target_user:
            return jsonify({'error': 'targetUser is required'}), 400
        if not candidates:
            return jsonify({'error': 'candidates list is required'}), 400

        logger.info(f"Recommendation: target={target_user.get('id')} candidates={len(candidates)} topK={top_k}")

        if FEATURE_CONFIG is None:
            return jsonify({'error': 'Model feature config unavailable'}), 503

        target_features = user_dict_to_features(target_user, FEATURE_CONFIG)
        candidate_features = [user_dict_to_features(c, FEATURE_CONFIG) for c in candidates]

        uid_t, age_t, gen_t, games_t, cats_t, langs_t = build_batch_tensors([target_features])
        uid_c, age_c, gen_c, games_c, cats_c, langs_c = build_batch_tensors(candidate_features)

        with torch.no_grad():
            target_emb = MODEL.encode_user(uid_t, age_t, gen_t, games_t, cats_t, langs_t)
            cand_emb = MODEL.encode_item(uid_c, age_c, gen_c, games_c, cats_c, langs_c)
            scores_tensor = MODEL.score(target_emb.expand(cand_emb.shape[0], -1), cand_emb)

        scores_list = scores_tensor.cpu().numpy().tolist()
        scores = [
            {'userId': candidates[i]['id'], 'score': float(scores_list[i])}
            for i in range(len(candidates))
        ]

        scores.sort(key=lambda x: x['score'], reverse=True)
        top = scores[:top_k]
        ms = int((datetime.utcnow() - start).total_seconds() * 1000)

        return jsonify({
            'results': top,
            'modelVersion': MODEL_VERSION,
            'timestamp': datetime.utcnow().isoformat(),
            'processingTimeMs': ms,
            'totalCandidates': len(candidates)
        }), 200

    except Exception as e:
        logger.error("Error in /ml/recommend", exc_info=True)
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@app.post('/ml/batch-embed')
def batch_embed():
    try:
        data = request.get_json() or {}
        users = data.get('users', [])
        if not users:
            return jsonify({'error': 'users list is required'}), 400

        embeddings: Dict[str, List[float]] = {}

        if FEATURE_CONFIG is None:
            return jsonify({'error': 'Model feature config unavailable'}), 503

        encoded = [user_dict_to_features(u, FEATURE_CONFIG) for u in users]
        uid_t, age_t, gen_t, games_t, cats_t, langs_t = build_batch_tensors(encoded)
        with torch.no_grad():
            emb = MODEL.encode_user(uid_t, age_t, gen_t, games_t, cats_t, langs_t)
            emb_np = emb.cpu().numpy()
            for idx, user in enumerate(users):
                embeddings[user['id']] = emb_np[idx].flatten().tolist()

        dim = len(next(iter(embeddings.values())))
        return jsonify({'embeddings': embeddings, 'dimension': dim, 'modelVersion': MODEL_VERSION}), 200

    except Exception as e:
        logger.error("Error in /ml/batch-embed", exc_info=True)
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@app.get('/ml/model-info')
def model_info():
    if MODEL is None:
        return jsonify({'error': 'Model not loaded'}), 503
    return jsonify({
        'version': MODEL_VERSION,
        'architecture': 'TwoTowerHybrid',
        'parameters': {
            'emb_user_dim': 32,
            'emb_token_dim': 32,
            'tower_hidden': [256, 128],
            'out_dim': 64,
            'temperature': 0.1
        },
        'device': str(DEVICE),
        'vocab': {
            'games': len(FEATURE_CONFIG.game_to_id) if FEATURE_CONFIG else 0,
            'categories': len(FEATURE_CONFIG.category_to_id) if FEATURE_CONFIG else 0,
            'languages': len(FEATURE_CONFIG.language_to_id) if FEATURE_CONFIG else 0,
        },
        'totalParameters': sum(p.numel() for p in MODEL.parameters())
    }), 200

@app.post('/ml/reload-model')
def reload_model():
    """Reload the model from disk. Useful when model file is updated."""
    try:
        logger.info("Reloading model from disk...")
        load_model()
        return jsonify({
            'message': 'Model reloaded successfully',
            'model_loaded': MODEL is not None,
            'device': str(DEVICE),
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Failed to reload model: {e}", exc_info=True)
        return jsonify({
            'error': 'Failed to reload model',
            'message': str(e)
        }), 500

@app.errorhandler(404)
def nf(e): return jsonify({'error': 'Endpoint not found'}), 404

@app.post('/ml/metrics')
def calculate_metrics():
    """Calculate recommendation metrics (internal use, called by backend)."""
    try:
        data = request.get_json() or {}
        recommended_ids = data.get('recommendedIds', [])
        ground_truth = set(data.get('groundTruth', []))
        mutual_accepts = set(data.get('mutualAccepts', []))
        chat_starts = set(data.get('chatStarts', []))
        k_values = data.get('kValues', [5, 10, 20])
        
        if not recommended_ids:
            return jsonify({'error': 'recommendedIds is required'}), 400

        def normalize(rec):
            seen = set()
            out = []
            for uid in rec:
                if not uid or uid in seen:
                    continue
                seen.add(uid)
                out.append(uid)
            return out
        
        # Import metrics calculation (simple implementation)
        def precision_at_k(rec, rel, k):
            if k == 0: return 0.0
            effective_k = min(k, len(rec))
            if effective_k == 0: return 0.0
            top_k = rec[:effective_k]
            return sum(1 for uid in top_k if uid in rel) / effective_k
        
        def recall_at_k(rec, rel, k):
            if len(rel) == 0: return 0.0
            top_k = rec[:min(k, len(rec))]
            return sum(1 for uid in top_k if uid in rel) / len(rel)
        
        def ndcg_at_k(rec, rel, k):
            if len(rel) == 0: return 0.0
            def dcg(ranking, rel_set, k_val):
                score = 0.0
                for i, uid in enumerate(ranking[:k_val], start=1):
                    if uid in rel_set:
                        score += 1.0 / math.log2(i + 1)
                return score
            def idcg(num_rel, k_val):
                if num_rel == 0: return 0.0
                score = 0.0
                for i in range(1, min(num_rel, k_val) + 1):
                    score += 1.0 / math.log2(i + 1)
                return score
            dcg_val = dcg(rec, rel, k)
            idcg_val = idcg(len(rel), k)
            return dcg_val / idcg_val if idcg_val > 0 else 0.0
        
        def hit_rate_at_k(rec, rel, k):
            if len(rel) == 0: return 0.0
            return 1.0 if any(uid in rel for uid in rec[:min(k, len(rec))]) else 0.0
        
        normalized = normalize(recommended_ids)

        results = {
            "precision": {},
            "recall": {},
            "ndcg": {},
            "hit_rate": {},
            "mutual_accept_rate": {},
            "chat_start_rate": {}
        }
        
        for k in k_values:
            results["precision"][k] = precision_at_k(normalized, ground_truth, k)
            results["recall"][k] = recall_at_k(normalized, ground_truth, k)
            results["ndcg"][k] = ndcg_at_k(normalized, ground_truth, k)
            results["hit_rate"][k] = hit_rate_at_k(normalized, ground_truth, k)
            
            effective_k = min(k, len(normalized))
            top_k_set = set(normalized[:effective_k])
            results["mutual_accept_rate"][k] = len(top_k_set & mutual_accepts) / effective_k if effective_k > 0 else 0.0
            results["chat_start_rate"][k] = len(top_k_set & chat_starts) / effective_k if effective_k > 0 else 0.0
        
        return jsonify(results), 200
    except Exception as e:
        logger.error("Error in /ml/metrics", exc_info=True)
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

@app.errorhandler(500)
def ie(e):
    logger.error(f"Internal server error: {e}")
    return jsonify({'error': 'Internal server error'}), 500

try:
    load_model()
except Exception as e:
    logger.error(f"Failed to initialize ML service: {e}")
    sys.exit(1)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
