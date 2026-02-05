#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced neural network architectures with attention, dropout, and batch normalization.

This is an improved version of the original two-tower model with:
- Attention mechanism for game embeddings
- Dropout for regularization
- Batch normalization
- Temperature scaling
- Learnable user ID embeddings
"""

from typing import Tuple, List, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F

from models.domain import NUM_GAMES


class GameAttention(nn.Module):
    """Attention mechanism for aggregating game embeddings."""
    
    def __init__(self, embedding_dim: int):
        super().__init__()
        self.attention = nn.Sequential(
            nn.Linear(embedding_dim, embedding_dim // 2),
            nn.Tanh(),
            nn.Linear(embedding_dim // 2, 1)
        )
    
    def forward(self, game_embeddings: torch.Tensor) -> torch.Tensor:
        """
        Apply attention over game embeddings.
        
        Args:
            game_embeddings: [num_games, embedding_dim]
        
        Returns:
            Weighted sum: [embedding_dim]
        """
        if game_embeddings.shape[0] == 0:
            return torch.zeros(game_embeddings.shape[1], 
                             dtype=game_embeddings.dtype, 
                             device=game_embeddings.device)
        
        # Compute attention weights
        weights = self.attention(game_embeddings)  # [num_games, 1]
        weights = F.softmax(weights, dim=0)
        
        # Weighted sum
        return (game_embeddings * weights).sum(dim=0)


class TowerV2(nn.Module):
    """
    Enhanced tower with batch normalization and dropout.
    """
    
    def __init__(
        self, 
        in_dim: int, 
        hidden: Tuple[int, int] = (128, 64), 
        out_dim: int = 32,
        dropout: float = 0.3,
        use_bn: bool = True
    ):
        super().__init__()
        self.fc1 = nn.Linear(in_dim, hidden[0])
        self.bn1 = nn.BatchNorm1d(hidden[0]) if use_bn else nn.Identity()
        self.dropout1 = nn.Dropout(dropout)
        
        self.fc2 = nn.Linear(hidden[0], hidden[1])
        self.bn2 = nn.BatchNorm1d(hidden[1]) if use_bn else nn.Identity()
        self.dropout2 = nn.Dropout(dropout * 0.7)  # Less dropout in deeper layers
        
        self.fc3 = nn.Linear(hidden[1], out_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.dropout1(F.relu(self.bn1(self.fc1(x))))
        x = self.dropout2(F.relu(self.bn2(self.fc2(x))))
        e = self.fc3(x)
        # L2 normalization for better retrieval
        e = F.normalize(e, p=2, dim=-1)
        return e


class TwoTowerV2(nn.Module):
    """
    Enhanced Two-Tower architecture with modern improvements.
    
    Key improvements over v1:
    - Attention mechanism for game embeddings
    - User ID embeddings for personalization
    - Dropout and batch normalization
    - Temperature scaling
    - Deeper architecture
    """
    
    def __init__(
        self, 
        num_users: int,
        emb_games_dim: int = 16,
        emb_user_dim: int = 32,
        emb_age_dim: int = 16,
        tower_hidden: Tuple[int, int] = (128, 64), 
        out_dim: int = 32,
        dropout: float = 0.3,
        use_bn: bool = True,
        use_attention: bool = True,
        use_age_embedding: bool = True,
        temperature: float = 0.1
    ):
        super().__init__()
        
        # Embeddings
        self.emb_games = nn.Embedding(NUM_GAMES, emb_games_dim)
        self.emb_users = nn.Embedding(num_users, emb_user_dim)
        nn.init.xavier_uniform_(self.emb_games.weight)
        nn.init.xavier_uniform_(self.emb_users.weight)
        
        # Age embedding (discretize age into bins)
        self.use_age_embedding = use_age_embedding
        if use_age_embedding:
            # Age bins: 0-17, 18-22, 23-27, 28-32, 33-37, 38-42, 43-47, 48+
            self.num_age_bins = 8
            self.emb_age = nn.Embedding(self.num_age_bins, emb_age_dim)
            nn.init.xavier_uniform_(self.emb_age.weight)
            age_feature_dim = emb_age_dim
        else:
            age_feature_dim = 1
        
        # Attention for games
        self.use_attention = use_attention
        if use_attention:
            self.game_attention = GameAttention(emb_games_dim)
        
        # Temperature for scoring
        self.temperature = nn.Parameter(torch.tensor(temperature))
        
        # Tower input dimensions
        # user_id(emb_user_dim) + age(age_feature_dim) + gender(2) + games(emb_games_dim)
        in_dim = emb_user_dim + age_feature_dim + 2 + emb_games_dim
        
        self.user_tower = TowerV2(in_dim, hidden=tower_hidden, out_dim=out_dim, 
                                   dropout=dropout, use_bn=use_bn)
        self.item_tower = TowerV2(in_dim, hidden=tower_hidden, out_dim=out_dim, 
                                   dropout=dropout, use_bn=use_bn)

    def _age_to_bin(self, age_scalar: float) -> int:
        """Convert age to bin index."""
        # Age bins: 0-17, 18-22, 23-27, 28-32, 33-37, 38-42, 43-47, 48+
        if age_scalar < 18:
            return 0
        elif age_scalar < 23:
            return 1
        elif age_scalar < 28:
            return 2
        elif age_scalar < 33:
            return 3
        elif age_scalar < 38:
            return 4
        elif age_scalar < 43:
            return 5
        elif age_scalar < 48:
            return 6
        else:
            return 7
    
    def encode_vector(
        self, 
        user_ids: torch.Tensor,
        age: torch.Tensor, 
        gender: torch.Tensor, 
        game_indices: List[List[int]]
    ) -> torch.Tensor:
        """Encode user features into a single vector with attention."""
        B = age.shape[0]
        device = age.device
        
        # User ID embeddings
        user_embeds = self.emb_users(user_ids)
        
        # Age embeddings (if enabled)
        if self.use_age_embedding:
            # Convert normalized age back to actual age, then to bins
            # Assuming age is normalized by dividing by 100
            age_bins = []
            for i in range(B):
                age_val = age[i, 0].item() * 100  # Denormalize
                age_bin = self._age_to_bin(age_val)
                age_bins.append(age_bin)
            age_bins_tensor = torch.tensor(age_bins, dtype=torch.long, device=device)
            age_features = self.emb_age(age_bins_tensor)
        else:
            age_features = age
        
        # Game embeddings with attention or mean pooling
        game_embeds = []
        for i in range(B):
            idxs = game_indices[i]
            if len(idxs) == 0:
                gvec = torch.zeros(self.emb_games.embedding_dim, dtype=age.dtype, device=device)
            else:
                emb = self.emb_games(torch.tensor(idxs, dtype=torch.long, device=device))
                if self.use_attention:
                    gvec = self.game_attention(emb)
                else:
                    gvec = emb.mean(dim=0)
            game_embeds.append(gvec)
        game_embeds = torch.stack(game_embeds, dim=0)
        
        # V5: Scale game embeddings to give them more importance
        game_embeds = game_embeds * 2.0  # Double the weight of games!
        
        # Concatenate all features
        x = torch.cat([user_embeds, age_features, gender, game_embeds], dim=1)
        return x

    def aggregate_games(self, game_indices: List[List[int]]) -> torch.Tensor:
        """Aggregate per-user game indices into one embedding per user.
        Uses attention if enabled; otherwise mean pooling.
        Returns tensor of shape [batch, emb_games_dim].
        """
        device = self.emb_games.weight.device
        dtype = self.emb_games.weight.dtype
        batch_vectors: List[torch.Tensor] = []
        for idxs in game_indices:
            if len(idxs) == 0:
                gvec = torch.zeros(self.emb_games.embedding_dim, dtype=dtype, device=device)
            else:
                emb = self.emb_games(torch.tensor(idxs, dtype=torch.long, device=device))
                if self.use_attention:
                    gvec = self.game_attention(emb)
                else:
                    gvec = emb.mean(dim=0)
            batch_vectors.append(gvec)
        return torch.stack(batch_vectors, dim=0)

    def user_embed(
        self, 
        user_ids: torch.Tensor,
        age: torch.Tensor, 
        gender: torch.Tensor, 
        game_indices: List[List[int]]
    ) -> torch.Tensor:
        """Generate user embedding."""
        x = self.encode_vector(user_ids, age, gender, game_indices)
        return self.user_tower(x)

    def item_embed(
        self, 
        user_ids: torch.Tensor,
        age: torch.Tensor, 
        gender: torch.Tensor, 
        game_indices: List[List[int]]
    ) -> torch.Tensor:
        """Generate item (candidate) embedding."""
        x = self.encode_vector(user_ids, age, gender, game_indices)
        return self.item_tower(x)

    def score(self, u_vec: torch.Tensor, v_vec: torch.Tensor) -> torch.Tensor:
        """Compute similarity score with temperature scaling."""
        raw_score = torch.sum(u_vec * v_vec, dim=-1)
        return raw_score / self.temperature

    def forward(
        self,
        user_ids_u: torch.Tensor,
        age_u: torch.Tensor,
        gender_u: torch.Tensor,
        games_u: List[List[int]],
        user_ids_v: torch.Tensor,
        age_v: torch.Tensor,
        gender_v: torch.Tensor,
        games_v: List[List[int]]
    ) -> torch.Tensor:
        """
        Full forward pass for training.
        
        Returns:
            Scores between user and item pairs
        """
        u_emb = self.user_embed(user_ids_u, age_u, gender_u, games_u)
        v_emb = self.item_embed(user_ids_v, age_v, gender_v, games_v)
        return self.score(u_emb, v_emb)

