#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced model training with modern techniques.

Improvements:
- Multiple loss functions
- Learning rate scheduling
- Gradient clipping
- Hard negative mining
- Better evaluation metrics
"""

from typing import Optional, Callable, Dict
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import torch.nn.functional as F
from torch.optim.lr_scheduler import CosineAnnealingWarmRestarts

from models.domain import DataStore
from models.neural_network import TwoTowerV2
from data.dataset import PairDataset, sample_triples
from data.features import build_feature_tensors_v2
from training.losses import get_loss_function


def train_model_v2(
    dat: DataStore,
    epochs: int = 10,
    lr: float = 1e-3,
    batch_size: int = 64,
    device: Optional[torch.device] = None,
    log_fn: Optional[Callable[[str], None]] = None,
    loss_name: str = 'bpr',
    loss_kwargs: Optional[Dict] = None,
    dropout: float = 0.3,
    use_bn: bool = True,
    use_attention: bool = True,
    use_age_embedding: bool = True,
    use_scheduler: bool = True,
    gradient_clip: float = 1.0,
    tower_hidden: tuple = (128, 64),
    out_dim: int = 32,
    emb_games_dim: int = 16,
    emb_user_dim: int = 32,
    emb_age_dim: int = 16,
    hard_negative_ratio: float = 0.5,
    aux_overlap_weight: float = 0.05
) -> TwoTowerV2:
    """
    Train an enhanced two-tower model with modern techniques.
    
    Args:
        dat: DataStore with users and interactions
        epochs: Number of training epochs
        lr: Learning rate
        batch_size: Training batch size
        device: PyTorch device
        log_fn: Logging function
        loss_name: Name of loss function ('bpr', 'bpr_margin', 'triplet', etc.)
        loss_kwargs: Additional arguments for loss function
        dropout: Dropout rate
        use_bn: Use batch normalization
        use_attention: Use attention for game embeddings
        use_age_embedding: Use age embedding layer instead of raw age
        use_scheduler: Use learning rate scheduling
        gradient_clip: Max gradient norm (0 = no clipping)
        tower_hidden: Hidden layer sizes
        out_dim: Output embedding dimension
        emb_games_dim: Game embedding dimension
        emb_user_dim: User ID embedding dimension
        emb_age_dim: Age embedding dimension
        hard_negative_ratio: Fraction of negatives that should be "hard" (similar to positives)
    
    Returns:
        Trained TwoTowerV2 model
    """
    if device is None:
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    if log_fn is None:
        log_fn = print
    if loss_kwargs is None:
        loss_kwargs = {}

    if len(dat.users) < 3 or len(dat.interactions.positives) < 1:
        raise ValueError("Need at least 3 users and ≥1 positive interaction to train.")

    # Prepare training data
    triples = sample_triples(dat, neg_per_pos=3, hard_negative_ratio=hard_negative_ratio)
    ds = PairDataset(triples)
    dl = DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=True)

    # Initialize model
    num_users = len(dat.users)
    model = TwoTowerV2(
        num_users=num_users,
        emb_games_dim=emb_games_dim,
        emb_user_dim=emb_user_dim,
        emb_age_dim=emb_age_dim,
        tower_hidden=tower_hidden,
        out_dim=out_dim,
        dropout=dropout,
        use_bn=use_bn,
        use_attention=use_attention,
        use_age_embedding=use_age_embedding
    ).to(device)

    # Optimizer
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    
    # Learning rate scheduler
    if use_scheduler:
        scheduler = CosineAnnealingWarmRestarts(
            opt,
            T_0=max(5, epochs // 4),  # Restart every quarter of training
            T_mult=2,
            eta_min=lr * 0.01
        )
    
    # Loss function
    loss_fn = get_loss_function(loss_name, **loss_kwargs)

    profiles = dat.users

    # Training loop
    for epoch in range(1, epochs + 1):
        model.train()
        losses = []
        
        for (u_idx, vpos_idx, vneg_idx) in dl:
            u_idx = u_idx.tolist()
            vpos_idx = vpos_idx.tolist()
            vneg_idx = vneg_idx.tolist()

            # Build feature tensors (v2 with user IDs)
            uid_u, age_u, gen_u, games_u = build_feature_tensors_v2(profiles, u_idx, device)
            uid_p, age_p, gen_p, games_p = build_feature_tensors_v2(profiles, vpos_idx, device)
            uid_n, age_n, gen_n, games_n = build_feature_tensors_v2(profiles, vneg_idx, device)

            # Forward pass
            eu = model.user_embed(uid_u, age_u, gen_u, games_u)
            ep = model.item_embed(uid_p, age_p, gen_p, games_p)
            en = model.item_embed(uid_n, age_n, gen_n, games_n)

            # Compute scores and loss
            if loss_name in ['bpr', 'bpr_margin', 'hinge', 'weighted_bpr', 'gender_weighted_bpr']:
                s_pos = model.score(eu, ep)
                s_neg = model.score(eu, en)
                base_loss = loss_fn(s_pos, s_neg)
            elif loss_name in ['triplet', 'contrastive']:
                base_loss = loss_fn(eu, ep, en)
            elif loss_name == 'infonce':
                # InfoNCE: use both positive and negative as candidates
                all_candidates = torch.cat([ep, en], dim=0)  # Combine pos and neg as all candidates
                base_loss = loss_fn(eu, ep, all_candidates)
            else:
                raise ValueError(f"Unsupported loss for this trainer: {loss_name}")

            # Auxiliary loss: encourage shared games between user and positive more than user and negative
            # Compute cosine similarity between aggregated game embeddings of (u, pos) and (u, neg)
            g_u = model.aggregate_games(games_u)
            g_p = model.aggregate_games(games_p)
            g_n = model.aggregate_games(games_n)
            cos_up = F.cosine_similarity(g_u, g_p, dim=-1)
            cos_un = F.cosine_similarity(g_u, g_n, dim=-1)
            # We want cos_up > cos_un => maximize margin
            # Small margin encourages cos_up >= cos_un without overpowering main loss
            aux_margin = F.relu(0.05 - (cos_up - cos_un)).mean()

            loss = base_loss + aux_overlap_weight * aux_margin

            # Backward pass
            opt.zero_grad()
            loss.backward()
            
            # Gradient clipping
            if gradient_clip > 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=gradient_clip)
            
            opt.step()
            losses.append(loss.item())

        # Learning rate scheduling
        if use_scheduler:
            scheduler.step()
            current_lr = scheduler.get_last_lr()[0]
        else:
            current_lr = lr

        avg = float(np.mean(losses)) if losses else float('nan')
        log_fn(f"Epoch {epoch:02d} | Loss: {avg:.4f} | LR: {current_lr:.6f}")

    return model

