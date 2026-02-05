#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Two-Tower Hybrid model using dynamic vocabularies for games/categories/languages.
Designed for production: no fixed game list, no hard-coded constraints.
"""

from typing import List, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F


class Tower(nn.Module):
    def __init__(
        self,
        in_dim: int,
        hidden: Tuple[int, int] = (256, 128),
        out_dim: int = 64,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.fc1 = nn.Linear(in_dim, hidden[0])
        self.bn1 = nn.BatchNorm1d(hidden[0])
        self.dropout1 = nn.Dropout(dropout)

        self.fc2 = nn.Linear(hidden[0], hidden[1])
        self.bn2 = nn.BatchNorm1d(hidden[1])
        self.dropout2 = nn.Dropout(dropout * 0.7)

        self.fc3 = nn.Linear(hidden[1], out_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.dropout1(F.relu(self.bn1(self.fc1(x))))
        x = self.dropout2(F.relu(self.bn2(self.fc2(x))))
        out = self.fc3(x)
        return F.normalize(out, p=2, dim=-1)


class TwoTowerHybrid(nn.Module):
    def __init__(
        self,
        user_hash_buckets: int,
        game_vocab_size: int,
        category_vocab_size: int,
        language_vocab_size: int,
        emb_user_dim: int = 32,
        emb_token_dim: int = 32,
        tower_hidden: Tuple[int, int] = (256, 128),
        out_dim: int = 64,
        dropout: float = 0.3,
        w_games: float = 1.0,
        w_categories: float = 0.6,
        w_languages: float = 0.5,
        temperature: float = 0.1,
    ):
        super().__init__()
        self.emb_users = nn.Embedding(max(1, user_hash_buckets), emb_user_dim)
        self.emb_games = nn.Embedding(max(1, game_vocab_size), emb_token_dim)
        self.emb_categories = nn.Embedding(max(1, category_vocab_size), emb_token_dim)
        self.emb_languages = nn.Embedding(max(1, language_vocab_size), emb_token_dim)

        nn.init.xavier_uniform_(self.emb_users.weight)
        nn.init.xavier_uniform_(self.emb_games.weight)
        nn.init.xavier_uniform_(self.emb_categories.weight)
        nn.init.xavier_uniform_(self.emb_languages.weight)

        self.w_games = w_games
        self.w_categories = w_categories
        self.w_languages = w_languages
        self.temperature = nn.Parameter(torch.tensor(float(temperature)))

        # user_id + age + gender(3) + game + category + language
        in_dim = emb_user_dim + 1 + 3 + emb_token_dim * 3
        self.user_tower = Tower(in_dim, hidden=tower_hidden, out_dim=out_dim, dropout=dropout)
        self.item_tower = Tower(in_dim, hidden=tower_hidden, out_dim=out_dim, dropout=dropout)

    def _mean_embed(
        self,
        emb: nn.Embedding,
        batch_indices: List[List[int]],
        device: torch.device,
        dtype: torch.dtype,
    ) -> torch.Tensor:
        vectors: List[torch.Tensor] = []
        dim = emb.embedding_dim
        for idxs in batch_indices:
            if not idxs:
                vectors.append(torch.zeros(dim, device=device, dtype=dtype))
                continue
            idx_t = torch.tensor(idxs, dtype=torch.long, device=device)
            vectors.append(emb(idx_t).mean(dim=0))
        return torch.stack(vectors, dim=0)

    def encode(
        self,
        user_ids: torch.Tensor,
        age: torch.Tensor,
        gender: torch.Tensor,
        games: List[List[int]],
        categories: List[List[int]],
        languages: List[List[int]],
        tower: nn.Module,
    ) -> torch.Tensor:
        device = age.device
        dtype = age.dtype

        user_emb = self.emb_users(user_ids)
        game_vec = self._mean_embed(self.emb_games, games, device, dtype) * self.w_games
        cat_vec = self._mean_embed(self.emb_categories, categories, device, dtype) * self.w_categories
        lang_vec = self._mean_embed(self.emb_languages, languages, device, dtype) * self.w_languages

        x = torch.cat([user_emb, age, gender, game_vec, cat_vec, lang_vec], dim=1)
        return tower(x)

    def encode_user(
        self,
        user_ids: torch.Tensor,
        age: torch.Tensor,
        gender: torch.Tensor,
        games: List[List[int]],
        categories: List[List[int]],
        languages: List[List[int]],
    ) -> torch.Tensor:
        return self.encode(user_ids, age, gender, games, categories, languages, self.user_tower)

    def encode_item(
        self,
        user_ids: torch.Tensor,
        age: torch.Tensor,
        gender: torch.Tensor,
        games: List[List[int]],
        categories: List[List[int]],
        languages: List[List[int]],
    ) -> torch.Tensor:
        return self.encode(user_ids, age, gender, games, categories, languages, self.item_tower)

    def score(self, u_vec: torch.Tensor, v_vec: torch.Tensor) -> torch.Tensor:
        raw = torch.sum(u_vec * v_vec, dim=-1)
        return raw / self.temperature

