#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Trainer for the hybrid two-tower model with dynamic vocabularies.
"""

from typing import Callable, Dict, Optional
import numpy as np
import torch
from torch.utils.data import DataLoader

from models.domain import DataStore
from models.neural_network_hybrid import TwoTowerHybrid
from data.dataset import PairDataset, sample_triples
from data.hybrid_features import (
    HybridFeatureConfig,
    normalize_age,
    encode_gender_onehot,
    encode_tokens,
)
from training.losses import get_loss_function


def _build_feature_tensors(
    profiles,
    idxs,
    cfg: HybridFeatureConfig,
    device: torch.device,
):
    user_ids = []
    ages = []
    genders = []
    games_list = []
    categories_list = []
    languages_list = []

    for i in idxs:
        p = profiles[i]
        user_ids.append(int(p.user_id))
        ages.append([normalize_age(p.age, cfg)])
        genders.append(encode_gender_onehot(p.gender))
        games_list.append(encode_tokens(p.games, cfg.game_to_id))
        categories_list.append(encode_tokens(p.categories, cfg.category_to_id))
        languages_list.append(encode_tokens(p.languages, cfg.language_to_id))

    user_ids_t = torch.tensor(user_ids, dtype=torch.long, device=device)
    age_t = torch.tensor(ages, dtype=torch.float32, device=device)
    gender_t = torch.tensor(genders, dtype=torch.float32, device=device)

    return user_ids_t, age_t, gender_t, games_list, categories_list, languages_list


def train_model_hybrid(
    dat: DataStore,
    cfg: HybridFeatureConfig,
    epochs: int = 40,
    lr: float = 2e-4,
    batch_size: int = 64,
    device: Optional[torch.device] = None,
    log_fn: Optional[Callable[[str], None]] = None,
    loss_name: str = "bpr",
    loss_kwargs: Optional[Dict] = None,
    dropout: float = 0.3,
    tower_hidden: tuple = (256, 128),
    out_dim: int = 64,
    emb_user_dim: int = 32,
    emb_token_dim: int = 32,
    hard_negative_ratio: float = 0.3,
    gradient_clip: float = 1.0,
) -> TwoTowerHybrid:
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if log_fn is None:
        log_fn = print
    if loss_kwargs is None:
        loss_kwargs = {}

    if len(dat.users) < 3 or len(dat.interactions.positives) < 1:
        raise ValueError("Need at least 3 users and 1 positive interaction to train.")

    triples = sample_triples(dat, neg_per_pos=3, hard_negative_ratio=hard_negative_ratio)
    ds = PairDataset(triples)
    dl = DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=True)

    model = TwoTowerHybrid(
        user_hash_buckets=cfg.user_hash_buckets,
        game_vocab_size=cfg.game_vocab_size,
        category_vocab_size=cfg.category_vocab_size,
        language_vocab_size=cfg.language_vocab_size,
        emb_user_dim=emb_user_dim,
        emb_token_dim=emb_token_dim,
        tower_hidden=tower_hidden,
        out_dim=out_dim,
        dropout=dropout,
    ).to(device)

    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    loss_fn = get_loss_function(loss_name, **loss_kwargs)

    profiles = dat.users
    for epoch in range(1, epochs + 1):
        model.train()
        losses = []
        for u_idx, vpos_idx, vneg_idx in dl:
            u_idx = u_idx.tolist()
            vpos_idx = vpos_idx.tolist()
            vneg_idx = vneg_idx.tolist()

            uid_u, age_u, gen_u, games_u, cats_u, langs_u = _build_feature_tensors(
                profiles, u_idx, cfg, device
            )
            uid_p, age_p, gen_p, games_p, cats_p, langs_p = _build_feature_tensors(
                profiles, vpos_idx, cfg, device
            )
            uid_n, age_n, gen_n, games_n, cats_n, langs_n = _build_feature_tensors(
                profiles, vneg_idx, cfg, device
            )

            eu = model.encode_user(uid_u, age_u, gen_u, games_u, cats_u, langs_u)
            ep = model.encode_item(uid_p, age_p, gen_p, games_p, cats_p, langs_p)
            en = model.encode_item(uid_n, age_n, gen_n, games_n, cats_n, langs_n)

            s_pos = model.score(eu, ep)
            s_neg = model.score(eu, en)
            loss = loss_fn(s_pos, s_neg)

            opt.zero_grad()
            loss.backward()
            if gradient_clip > 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=gradient_clip)
            opt.step()
            losses.append(loss.item())

        avg = float(np.mean(losses)) if losses else float("nan")
        log_fn(f"Epoch {epoch:02d} | Loss: {avg:.4f}")

    model.eval()
    return model

