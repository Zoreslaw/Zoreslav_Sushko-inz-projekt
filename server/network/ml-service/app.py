#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TeamUp ML Service - Flask API for Two-Tower V6 Recommendation Model
Refactor: safer feature building & batch embed shapes.
"""

import os
import sys
import logging
import math
from datetime import datetime
from typing import Dict, Any, List

from flask import Flask, request, jsonify
import torch
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models.domain import DataStore, GAMES
from models.neural_network_v6 import TwoTowerV6Extreme

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

MODEL = None
DEVICE = None
MODEL_VERSION = "v6-optimal"
GAME_NAME_TO_INDEX = {game: idx for idx, game in enumerate(GAMES)}

def load_model():
    global MODEL, DEVICE
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {DEVICE}")

    model_path = os.getenv('MODEL_PATH', '/app/models/twotower_v6_optimal.pt')

    MODEL = TwoTowerV6Extreme(
        num_users=10000,
        emb_user_dim=64,
        emb_age_dim=32,
        game_emb_dim=64,
        tower_hidden=(512, 256, 128),
        out_dim=128,
        dropout=0.3,
        temperature=0.07
    ).to(DEVICE)

    if os.path.exists(model_path):
        ckpt = torch.load(model_path, map_location=DEVICE)
        model_dict = MODEL.state_dict()
        filtered = {k: v for k, v in ckpt.items() if k in model_dict and model_dict[k].shape == v.shape}
        model_dict.update(filtered)
        MODEL.load_state_dict(model_dict)
        logger.info(f"Model loaded from {model_path} ({len(filtered)}/{len(ckpt)} tensors)")
    else:
        logger.warning(f"Model file not found at {model_path}, using untrained model")

    MODEL.eval()
    logger.info("Model initialization complete")

def user_dict_to_features(user: Dict[str, Any], user_id_idx: int = 0):
    age = int(user.get('age', 25))
    gender = user.get('gender', 'Male')
    gender_numeric = 0 if gender == 'Male' else 1
    games_names = user.get('games', []) or user.get('favoriteGames', []) or []
    game_indices = [GAME_NAME_TO_INDEX[g] for g in games_names if g in GAME_NAME_TO_INDEX] or [0]
    return user_id_idx, age, gender_numeric, game_indices

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

        # target
        uid_t, age_t, gen_t, games_t = user_dict_to_features(target_user, user_id_idx=0)
        uid_t = torch.tensor([uid_t], dtype=torch.long, device=DEVICE)
        age_t = torch.tensor([[age_t / 100.0]], dtype=torch.float32, device=DEVICE)
        gen_t = torch.tensor([[1.0, 0.0] if gen_t == 0 else [0.0, 1.0]], dtype=torch.float32, device=DEVICE)

        with torch.no_grad():
            target_emb, _ = MODEL.encode_user(uid_t, age_t, gen_t, [games_t])

        scores = []
        for idx, cand in enumerate(candidates):
            uid_c, age_c, gen_c, games_c = user_dict_to_features(cand, user_id_idx=idx + 1)
            uid_c = torch.tensor([uid_c], dtype=torch.long, device=DEVICE)
            age_c = torch.tensor([[age_c / 100.0]], dtype=torch.float32, device=DEVICE)
            gen_c = torch.tensor([[1.0, 0.0] if gen_c == 0 else [0.0, 1.0]], dtype=torch.float32, device=DEVICE)
            with torch.no_grad():
                cand_emb, _ = MODEL.encode_item(uid_c, age_c, gen_c, [games_c])
                score = MODEL.score(target_emb, cand_emb).item()
            scores.append({'userId': cand['id'], 'score': float(score)})

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

        for idx, user in enumerate(users):
            uid, age, gen, games = user_dict_to_features(user, user_id_idx=idx)
            uid_t = torch.tensor([uid], dtype=torch.long, device=DEVICE)
            age_t = torch.tensor([[age / 100.0]], dtype=torch.float32, device=DEVICE)
            gen_t = torch.tensor([[1.0, 0.0] if gen == 0 else [0.0, 1.0]], dtype=torch.float32, device=DEVICE)
            with torch.no_grad():
                emb, _ = MODEL.encode_user(uid_t, age_t, gen_t, [games])
                embeddings[user['id']] = emb.cpu().numpy().flatten().tolist()

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
        'architecture': 'TwoTowerV6Extreme',
        'parameters': {
            'emb_age_dim': 32,
            'emb_user_dim': 64,
            'game_emb_dim': 64,
            'tower_hidden': [512, 256, 128],
            'out_dim': 128,
            'temperature': 0.07
        },
        'device': str(DEVICE),
        'games': GAMES,
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
        
        # Import metrics calculation (simple implementation)
        def precision_at_k(rec, rel, k):
            if k == 0: return 0.0
            top_k = rec[:k]
            return sum(1 for uid in top_k if uid in rel) / k
        
        def recall_at_k(rec, rel, k):
            if len(rel) == 0: return 0.0
            top_k = rec[:k]
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
            return 1.0 if any(uid in rel for uid in rec[:k]) else 0.0
        
        results = {
            "precision": {},
            "recall": {},
            "ndcg": {},
            "hit_rate": {},
            "mutual_accept_rate": {},
            "chat_start_rate": {}
        }
        
        for k in k_values:
            results["precision"][k] = precision_at_k(recommended_ids, ground_truth, k)
            results["recall"][k] = recall_at_k(recommended_ids, ground_truth, k)
            results["ndcg"][k] = ndcg_at_k(recommended_ids, ground_truth, k)
            results["hit_rate"][k] = hit_rate_at_k(recommended_ids, ground_truth, k)
            
            top_k_set = set(recommended_ids[:k])
            results["mutual_accept_rate"][k] = len(top_k_set & mutual_accepts) / k if k > 0 else 0.0
            results["chat_start_rate"][k] = len(top_k_set & chat_starts) / k if k > 0 else 0.0
        
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
