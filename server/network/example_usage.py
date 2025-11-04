#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Example usage of the enhanced V2 two-tower model.

This demonstrates the improvements:
- Attention mechanism for games
- Multiple loss functions
- Better evaluation metrics
- Learning rate scheduling
"""

from models.domain import DataStore
from training.trainer import train_model_v2
from recommendation.recommender import topk_recommend
from recommendation.metrics import compute_all_metrics, aggregate_metrics


def main():
    print("=== Enhanced Two-Tower Model (V2) Example ===\n")
    
    # Step 1: Create data store
    print("1. Creating data store and adding users...")
    dat = DataStore()
    
    # Add more users for better training
    users_data = [
        (22, 'M', ['valorant', 'cs2']),
        (21, 'M', ['valorant', 'apex']),
        (35, 'F', ['lol']),
        (23, 'M', ['valorant', 'cs2', 'dota2']),
        (28, 'F', ['overwatch2', 'valorant']),
        (30, 'M', ['pubg', 'cs2']),
        (19, 'M', ['minecraft', 'rocketleague']),
        (26, 'F', ['fortnite', 'apex', 'overwatch2']),
        (33, 'M', ['lol', 'dota2']),
        (24, 'F', ['valorant', 'rocketleague']),
        (27, 'M', ['cs2', 'pubg']),
        (20, 'F', ['minecraft', 'fortnite']),
    ]
    
    for age, gender, games in users_data:
        dat.add_user(age, gender, games)
    
    print(f"   Added {len(dat.users)} users\n")
    
    # Step 2: Add interactions (simulating a realistic matchmaking scenario)
    print("2. Adding positive interactions...")
    interactions = [
        (0, 1), (0, 3), (0, 5),  # User 0 (22M, val/cs2) likes similar FPS players
        (1, 0), (1, 3), (1, 7),  # User 1 (21M, val/apex) 
        (2, 8),                   # User 2 (35F, lol) likes MOBA players
        (3, 0), (3, 1), (3, 5),  # User 3 (23M, val/cs2/dota2)
        (4, 0), (4, 1), (4, 9),  # User 4 (28F, ow2/val)
        (5, 0), (5, 3), (5, 10), # User 5 (30M, pubg/cs2)
        (6, 9), (6, 11),          # User 6 (19M, minecraft/rl)
        (7, 1), (7, 4),           # User 7 (26F, fortnite/apex/ow2)
        (8, 2),                   # User 8 (33M, lol/dota2)
        (9, 0), (9, 4), (9, 6),  # User 9 (24F, val/rl)
    ]
    
    for u, v in interactions:
        dat.add_positive(u, v)
    
    print(f"   Added {len(dat.interactions.positives)} positive interactions\n")
    
    # Step 3: Train with V5 GAME-FIRST + Auxiliary Loss
    print("=" * 60)
    print("3. Training V5 GAME-FIRST + Auxiliary Loss Model")
    print("=" * 60)
    print()
    
    print("--- V5 GAME-FIRST + Auxiliary Loss ---")
    print("Improvements:")
    print("  - Game embeddings: 64-dim (MAXIMUM)")
    print("  - Game weight: x2.0 (DOUBLE importance)")
    print("  - Learning rate: 0.0005 (fine-tuning)")
    print("  - InfoNCE loss + Age embedding")
    print("  - Auxiliary game-overlap loss (0.05 weight)")
    print()
    
    best_model = train_model_v2(
        dat,
        epochs=50,
        lr=5e-4,
        batch_size=32,
        log_fn=lambda msg: print(f"   {msg}"),
        use_attention=True,
        use_age_embedding=True,
        dropout=0.2,
        use_scheduler=True,
        loss_name='infonce',
        loss_kwargs={'temperature': 0.07},
        tower_hidden=(256, 128),
        out_dim=64,
        emb_games_dim=64,
        emb_user_dim=64,
        emb_age_dim=16,
        hard_negative_ratio=0.0,
        aux_overlap_weight=0.05
    )
    
    best_config = "V5 GAME-FIRST + Auxiliary Loss"
    print()
    
    # Step 4: Comprehensive Evaluation
    print("=" * 60)
    print("4. Evaluating Model with Multiple Metrics")
    print("=" * 60)
    print()
    
    test_users = [0, 1, 4, 9]  # Test on a few users
    
    for user_id in test_users:
        # Get recommendations
        recommendations = topk_recommend(best_model, dat, user_id=user_id, K=10)
        recommended_ids = [cand_id for cand_id, _ in recommendations]
        
        # Ground truth: users they actually interacted with
        relevant = {v for (u, v) in dat.interactions.positives if u == user_id}
        
        # Compute metrics
        metrics = compute_all_metrics(relevant, recommended_ids, k_values=[1, 3, 5, 10])
        
        print(f"User {user_id} ({dat.users[user_id].age}{dat.users[user_id].gender}, {','.join(dat.users[user_id].games[:2])}...)")
        print(f"  Ground truth relevant: {relevant}")
        print(f"  Top-5 recommendations: {recommended_ids[:5]}")
        print(f"  Metrics:")
        for metric_name in ['recall@5', 'precision@5', 'ndcg@5', 'mrr']:
            print(f"    {metric_name:15s}: {metrics[metric_name]:.4f}")
        print()
    
    # Step 5: Feature Importance Analysis
    print("=" * 60)
    print("5. Model Insights")
    print("=" * 60)
    print()
    
    print(f"Best Configuration: {best_config}")
    print(f"Model Architecture:")
    print(f"  - User Tower: Input({best_model.user_tower.fc1.in_features}) -> 128 -> 64 -> {best_model.user_tower.fc3.out_features}")
    print(f"  - Item Tower: Input({best_model.item_tower.fc1.in_features}) -> 128 -> 64 -> {best_model.item_tower.fc3.out_features}")
    print(f"  - Total Parameters: {sum(p.numel() for p in best_model.parameters()):,}")
    print(f"  - Trainable Parameters: {sum(p.numel() for p in best_model.parameters() if p.requires_grad):,}")
    print(f"  - Using Attention: {best_model.use_attention}")
    print(f"  - Temperature: {best_model.temperature.item():.4f}")
    print()
    
    # Step 6: Ablation Study Summary
    print("=" * 60)
    print("6. Key Improvements from V1 to V5")
    print("=" * 60)
    print()
    print("[V2] User ID Embeddings + Attention Mechanism")
    print("[V3] Age Embeddings (8 bins) + InfoNCE Loss")
    print("[V4] Hard Negative Mining + Larger Architecture")
    print("[V5] 64-dim Game Embeddings + x2.0 Game Weight")
    print("[V5+] Auxiliary Game-Overlap Loss (encourages common games)")
    print("[OK] Dropout & BatchNorm: Improved generalization")
    print("[OK] Temperature Scaling: Better calibrated scores")
    print("[OK] Learning Rate Scheduling: Smoother convergence")
    print("[OK] Multiple Loss Functions: BPR, BPR+Margin, Triplet, InfoNCE")
    print("[OK] Rich Metrics: Recall, Precision, NDCG, MRR")
    print()
    
    print("=" * 60)
    print("Example completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()

