#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V6 EXTREME Trainer: Multi-objective training for complex scenarios.

NEW training strategies:
1. Focal loss for class imbalance
2. Hard constraint loss for rejection rules
3. Intersection feature matching loss
4. Weighted sampling for rare positives
5. Curriculum learning (easy -> hard)
"""

from typing import Optional, Callable, Dict, List
import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from torch.utils.data import DataLoader, WeightedRandomSampler

from models.domain import DataStore
from models.neural_network_v6 import TwoTowerV6Extreme
from data.dataset import PairDataset, sample_triples
from data.features import build_feature_tensors_v2
from training.losses import get_loss_function


class FocalInfoNCELoss(nn.Module):
    """
    Focal loss variant of InfoNCE to handle class imbalance.
    Focuses more on hard-to-classify examples.
    """
    
    def __init__(self, temperature: float = 0.07, gamma: float = 2.0):
        super().__init__()
        self.temperature = temperature
        self.gamma = gamma
    
    def forward(
        self,
        user_emb: torch.Tensor,
        pos_emb: torch.Tensor,
        all_candidate_emb: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            user_emb: [batch, dim]
            pos_emb: [batch, dim]
            all_candidate_emb: [batch*(1+num_neg), dim]
        """
        batch_size = user_emb.shape[0]
        
        # Compute similarities
        pos_sim = torch.sum(user_emb * pos_emb, dim=-1) / self.temperature  # [batch]
        
        # All candidates similarity
        all_sim = torch.matmul(user_emb, all_candidate_emb.t()) / self.temperature  # [batch, batch*(1+num_neg)]
        
        # LogSumExp for numerical stability
        logits = torch.cat([pos_sim.unsqueeze(1), all_sim], dim=1)  # [batch, 1 + batch*(1+num_neg)]
        
        # Standard InfoNCE loss
        log_prob = pos_sim - torch.logsumexp(logits, dim=1)
        
        # Focal loss modulation
        prob = torch.exp(log_prob)
        focal_weight = (1 - prob) ** self.gamma
        
        loss = -(focal_weight * log_prob).mean()
        
        return loss


class RejectionConstraintLoss(nn.Module):
    """
    Hard constraint loss to enforce rejection rules.
    Heavily penalizes models that recommend users with toxic games.
    """
    
    def __init__(self, weight: float = 0.5):
        super().__init__()
        self.weight = weight
    
    def forward(
        self,
        pos_rejection: torch.Tensor,
        neg_rejection: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            pos_rejection: [batch, 8] rejection scores for positive samples
            neg_rejection: [batch, 8] rejection scores for negative samples
        
        We want:
        - Positive samples to have LOW rejection scores
        - Negative samples to have HIGH rejection scores (if they're rejected for a reason)
        """
        # Positive samples should have low rejection indicators
        pos_loss = F.relu(pos_rejection).mean()
        
        # Negative samples: encourage high rejection for toxic ones
        # But don't penalize negatives that are negative for other reasons
        neg_loss = -F.relu(neg_rejection - 0.5).mean()  # Encourage detection
        
        return self.weight * (pos_loss + 0.1 * neg_loss)


class IntersectionMatchingLoss(nn.Module):
    """
    Loss that explicitly matches intersection features.
    Teaches model to prefer candidates with better game overlaps.
    """
    
    def __init__(self, weight: float = 0.2):
        super().__init__()
        self.weight = weight
    
    def forward(
        self,
        user_game_indices: List[List[int]],
        pos_game_indices: List[List[int]],
        neg_game_indices: List[List[int]],
        model: TwoTowerV6Extreme
    ) -> torch.Tensor:
        """
        Compute intersection features and enforce that pos > neg.
        """
        # Compute intersection features
        pos_inter = model.compute_intersection_features(user_game_indices, pos_game_indices)
        neg_inter = model.compute_intersection_features(user_game_indices, neg_game_indices)
        
        # We want positive intersections to be "better"
        # Focus on key features: common_fps_count, has_2plus_fps, has_toxic
        common_fps_pos = pos_inter[:, 0]  # Normalized common FPS count
        common_fps_neg = neg_inter[:, 0]
        
        has_2plus_pos = pos_inter[:, 1]  # Binary: has 2+ common FPS
        has_2plus_neg = neg_inter[:, 1]
        
        has_toxic_neg = neg_inter[:, 3]  # Negatives should have toxic
        
        # Margin losses
        fps_margin = F.relu(0.3 - (common_fps_pos - common_fps_neg)).mean()
        binary_margin = F.relu(0.5 - (has_2plus_pos - has_2plus_neg)).mean()
        toxic_penalty = F.relu(has_toxic_neg - 0.7).mean()  # Encourage negatives to have toxic
        
        return self.weight * (fps_margin + binary_margin + 0.1 * toxic_penalty)


def create_weighted_sampler(dataset: PairDataset, dat: DataStore) -> WeightedRandomSampler:
    """
    Create a weighted sampler to oversample rare positive classes.
    E.g., if men are rare in positives, sample them more frequently.
    """
    weights = []
    
    for u_idx, v_pos, v_neg in dataset.triples:
        # Check if this is a rare case (e.g., male positive)
        v_pos_gender = dat.users[v_pos].gender
        
        # Give higher weight to male positives (they're rare in complex scenarios)
        if v_pos_gender == 'M':
            weight = 3.0  # 3x sampling rate
        else:
            weight = 1.0
        
        weights.append(weight)
    
    weights = torch.tensor(weights, dtype=torch.float)
    sampler = WeightedRandomSampler(weights, num_samples=len(weights), replacement=True)
    
    return sampler


def train_model_v6_extreme(
    dat: DataStore,
    epochs: int = 150,
    lr: float = 3e-4,
    batch_size: int = 32,
    device: Optional[torch.device] = None,
    log_fn: Optional[Callable[[str], None]] = None,
    dropout: float = 0.3,
    use_scheduler: bool = True,
    focal_gamma: float = 2.0,
    rejection_weight: float = 0.5,
    intersection_weight: float = 0.3,
    use_weighted_sampling: bool = True,
    emb_age_dim: int = 16,
    emb_user_dim: int = 64,
    game_emb_dim: int = 64,
    tower_hidden: tuple = (512, 256, 128),
    out_dim: int = 128,
    temperature: float = 0.07
) -> TwoTowerV6Extreme:
    """
    Train V6 EXTREME model with multiple objectives.
    
    Args:
        dat: DataStore with user profiles and interactions
        epochs: Number of training epochs
        lr: Learning rate
        batch_size: Batch size for training
        device: Device to train on (cuda/cpu)
        log_fn: Logging function
        dropout: Dropout rate for regularization
        use_scheduler: Use cosine annealing LR scheduler
        focal_gamma: Focal loss gamma (higher = more focus on hard examples)
        rejection_weight: Weight for rejection constraint loss
        intersection_weight: Weight for intersection matching loss
        use_weighted_sampling: Oversample rare positive classes
        emb_age_dim: Age embedding dimension (increase for better age learning)
        emb_user_dim: User ID embedding dimension
        game_emb_dim: Game embedding dimension
        tower_hidden: Hidden layer sizes for tower networks
        out_dim: Output embedding dimension
        temperature: Temperature for contrastive loss (lower = stricter)
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    if log_fn is None:
        log_fn = print
    
    # Sample triples (no hard negatives - use weighted sampling instead)
    log_fn("Sampling training triples...")
    triples = sample_triples(dat, neg_per_pos=5, hard_negative_ratio=0.0)
    log_fn(f"Generated {len(triples)} training triples")
    
    ds = PairDataset(triples)
    
    # Create weighted sampler for rare classes
    if use_weighted_sampling:
        sampler = create_weighted_sampler(ds, dat)
        dl = DataLoader(ds, batch_size=batch_size, sampler=sampler, drop_last=True)
        log_fn("Using weighted sampling for rare positive classes")
    else:
        dl = DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=True)
    
    # Initialize model
    num_users = len(dat.users)
    model = TwoTowerV6Extreme(
        num_users=num_users,
        emb_user_dim=emb_user_dim,
        emb_age_dim=emb_age_dim,
        game_emb_dim=game_emb_dim,
        tower_hidden=tower_hidden,
        out_dim=out_dim,
        dropout=dropout,
        temperature=temperature
    ).to(device)
    
    log_fn(f"Model: {sum(p.numel() for p in model.parameters()):,} parameters")
    
    # Multiple loss functions
    main_loss = FocalInfoNCELoss(temperature=temperature, gamma=focal_gamma)
    rejection_loss = RejectionConstraintLoss(weight=rejection_weight)
    intersection_loss = IntersectionMatchingLoss(weight=intersection_weight)
    
    # Optimizer
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-5)
    
    # Scheduler: Cosine annealing with warm restarts
    if use_scheduler:
        scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(
            optimizer, T_0=30, T_mult=1, eta_min=1e-6
        )
    
    # Training loop
    log_fn(f"Starting training loop: {epochs} epochs, {len(dl)} batches per epoch")
    stop_training_file = os.getenv('STOP_TRAINING_FILE', '/shared/logs/stop_training.flag')
    
    for epoch in range(1, epochs + 1):
        # Check for stop flag
        if os.path.exists(stop_training_file):
            log_fn("⚠️ Stop training flag detected. Stopping training...")
            try:
                os.remove(stop_training_file)
            except Exception:
                pass
            break
        
        model.train()
        losses = []
        main_losses = []
        rejection_losses = []
        intersection_losses = []
        
        batch_count = 0
        for u_idx, v_pos_idx, v_neg_idx in dl:
            # Check for stop flag during batch processing
            if os.path.exists(stop_training_file):
                log_fn("⚠️ Stop training flag detected. Stopping training...")
                try:
                    os.remove(stop_training_file)
                except Exception:
                    pass
                break
            batch_count += 1
            u_idx = u_idx.numpy().tolist()
            v_pos_idx = v_pos_idx.numpy().tolist()
            v_neg_idx = v_neg_idx.numpy().tolist()
            
            # Build features
            user_ids_u, age_u, gender_u, games_u = build_feature_tensors_v2(dat.users, u_idx, device)
            user_ids_p, age_p, gender_p, games_p = build_feature_tensors_v2(dat.users, v_pos_idx, device)
            user_ids_n, age_n, gender_n, games_n = build_feature_tensors_v2(dat.users, v_neg_idx, device)
            
            # Forward pass
            eu, rej_u = model.encode_user(user_ids_u, age_u, gender_u, games_u)
            ep, rej_p = model.encode_item(user_ids_p, age_p, gender_p, games_p)
            en, rej_n = model.encode_item(user_ids_n, age_n, gender_n, games_n)
            
            # Main loss: Focal InfoNCE
            all_candidates = torch.cat([ep, en], dim=0)
            loss_main = main_loss(eu, ep, all_candidates)
            
            # Rejection constraint loss
            loss_rejection = rejection_loss(rej_p, rej_n)
            
            # Intersection matching loss
            loss_intersection = intersection_loss(games_u, games_p, games_n, model)
            
            # Combined loss
            loss = loss_main + loss_rejection + loss_intersection
            
            # Backward
            optimizer.zero_grad()
            loss.backward()
            
            # Gradient clipping
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            
            optimizer.step()
            
            losses.append(loss.item())
            main_losses.append(loss_main.item())
            rejection_losses.append(loss_rejection.item())
            intersection_losses.append(loss_intersection.item())
            
            # Log progress for first epoch or every 100 batches
            if (epoch == 1 and batch_count % 100 == 0) or (epoch <= 3 and batch_count % 500 == 0):
                log_fn(f"Epoch {epoch:03d} | Batch {batch_count}/{len(dl)} | Loss: {loss.item():.4f}")
        
        # Check stop flag after epoch
        if os.path.exists(stop_training_file):
            log_fn("⚠️ Stop training flag detected. Stopping training...")
            try:
                os.remove(stop_training_file)
            except Exception:
                pass
            break
        
        if use_scheduler:
            scheduler.step()
            current_lr = scheduler.get_last_lr()[0]
        else:
            current_lr = lr
        
        avg_loss = float(np.mean(losses))
        avg_main = float(np.mean(main_losses))
        avg_rej = float(np.mean(rejection_losses))
        avg_inter = float(np.mean(intersection_losses))
        
        if epoch % 10 == 0 or epoch <= 5:
            log_fn(f"Epoch {epoch:03d} | Total: {avg_loss:.4f} | "
                   f"Main: {avg_main:.4f} | Rej: {avg_rej:.4f} | Inter: {avg_inter:.4f} | LR: {current_lr:.6f}")
    
    model.eval()
    return model


