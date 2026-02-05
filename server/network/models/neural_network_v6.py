#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V6 EXTREME: Neural network for handling extremely complex scenarios.

NEW in V6:
1. Multi-hot game encoding for precise game combination matching
2. Gender-conditioned game processing (different weights for M/F)
3. Rejection-aware embeddings for toxic games
4. Game intersection features (explicit 2+, 3+ FPS counting)
5. Larger architecture with more capacity
6. Residual connections for better gradient flow
"""

from typing import Tuple, List, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F

from models.domain import NUM_GAMES


class GenderConditionedGameEncoder(nn.Module):
    """
    Encodes games differently based on gender.
    For complex scenarios where men/women have different game requirements.
    """
    
    def __init__(self, emb_dim: int = 64):
        super().__init__()
        self.emb_dim = emb_dim
        
        # Separate game encoders for each gender
        self.male_encoder = nn.Sequential(
            nn.Linear(NUM_GAMES, emb_dim * 2),
            nn.ReLU(),
            nn.Linear(emb_dim * 2, emb_dim)
        )
        
        self.female_encoder = nn.Sequential(
            nn.Linear(NUM_GAMES, emb_dim * 2),
            nn.ReLU(),
            nn.Linear(emb_dim * 2, emb_dim)
        )
        
        # Rejection game detector (rust, gta5rp, fortnite, etc.)
        self.rejection_detector = nn.Sequential(
            nn.Linear(NUM_GAMES, 32),
            nn.Tanh(),
            nn.Linear(32, 8)
        )
    
    def forward(self, game_vector: torch.Tensor, gender: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            game_vector: [batch, NUM_GAMES] multi-hot encoding
            gender: [batch, 2] one-hot encoding (M==[1,0], F==[0,1])
        
        Returns:
            game_features: [batch, emb_dim] gender-conditioned encoding
            rejection_score: [batch, 8] rejection indicators
        """
        # Get gender indicators
        is_male = gender[:, 0:1]  # [batch, 1]
        is_female = gender[:, 1:2]  # [batch, 1]
        
        # Encode games based on gender
        male_features = self.male_encoder(game_vector)
        female_features = self.female_encoder(game_vector)
        
        # Weighted combination based on gender
        game_features = is_male * male_features + is_female * female_features
        
        # Detect rejection games
        rejection_score = self.rejection_detector(game_vector)
        
        return game_features, rejection_score


class GameIntersectionFeatures(nn.Module):
    """
    Explicitly computes game intersection features.
    E.g., "number of common FPS games", "has 2+ common FPS", etc.
    """
    
    def __init__(self):
        super().__init__()
        # Define game categories (indices in GAMES list)
        # GAMES = ["dota2", "cs2", "valorant", "lol", "apex", 
        #          "overwatch2", "fortnite", "pubg", "rocketleague", "minecraft",
        #          "hoi4", "rust", "phasmophobia", "battlefield1", "gta5rp"]
        
        self.competitive_fps = {1, 2, 4, 5, 13}  # cs2, valorant, apex, overwatch2, battlefield1
        self.toxic_games = {0, 3, 11, 14}  # dota2, lol, rust, gta5rp
        self.casual_games = {6, 9}  # fortnite, minecraft
        self.bonus_games = {8, 10, 12}  # rocketleague, hoi4, phasmophobia
    
    def forward(self, user_games: torch.Tensor, candidate_games: torch.Tensor) -> torch.Tensor:
        """
        Args:
            user_games: [batch, NUM_GAMES] multi-hot
            candidate_games: [batch, NUM_GAMES] multi-hot
        
        Returns:
            features: [batch, 16] intersection features
        """
        batch_size = user_games.shape[0]
        device = user_games.device
        
        features = []
        
        # 1. Common competitive FPS count (0-5)
        competitive_mask = torch.zeros(NUM_GAMES, device=device)
        for idx in self.competitive_fps:
            competitive_mask[idx] = 1.0
        
        user_fps = user_games * competitive_mask
        cand_fps = candidate_games * competitive_mask
        common_fps = (user_fps * cand_fps).sum(dim=1, keepdim=True)  # [batch, 1]
        features.append(common_fps / 5.0)  # Normalize
        
        # 2. Has 2+ common FPS (binary)
        has_2plus_fps = (common_fps >= 2).float()
        features.append(has_2plus_fps)
        
        # 3. Has 3+ common FPS (binary)
        has_3plus_fps = (common_fps >= 3).float()
        features.append(has_3plus_fps)
        
        # 4. Candidate has toxic games
        toxic_mask = torch.zeros(NUM_GAMES, device=device)
        for idx in self.toxic_games:
            toxic_mask[idx] = 1.0
        
        cand_toxic = (candidate_games * toxic_mask).sum(dim=1, keepdim=True)
        has_toxic = (cand_toxic > 0).float()
        features.append(has_toxic)
        
        # 5. Candidate has only casual games
        casual_mask = torch.zeros(NUM_GAMES, device=device)
        for idx in self.casual_games:
            casual_mask[idx] = 1.0
        
        cand_casual = (candidate_games * casual_mask).sum(dim=1, keepdim=True)
        cand_total = candidate_games.sum(dim=1, keepdim=True)
        only_casual = (cand_casual == cand_total).float() * (cand_total > 0).float()
        features.append(only_casual)
        
        # 6. Common bonus games
        bonus_mask = torch.zeros(NUM_GAMES, device=device)
        for idx in self.bonus_games:
            bonus_mask[idx] = 1.0
        
        user_bonus = user_games * bonus_mask
        cand_bonus = candidate_games * bonus_mask
        common_bonus = (user_bonus * cand_bonus).sum(dim=1, keepdim=True)
        features.append(common_bonus / 3.0)  # Normalize
        
        # 7-16. Individual game overlaps for top games (binary)
        for game_idx in range(min(10, NUM_GAMES)):
            user_has = user_games[:, game_idx:game_idx+1]
            cand_has = candidate_games[:, game_idx:game_idx+1]
            both_have = (user_has * cand_has)
            features.append(both_have)
        
        return torch.cat(features, dim=1)  # [batch, 16]


class EnhancedTowerV6(nn.Module):
    """
    Enhanced tower with residual connections and larger capacity.
    """
    
    def __init__(
        self, 
        in_dim: int,
        hidden: Tuple[int, int, int] = (512, 256, 128),
        out_dim: int = 128,
        dropout: float = 0.3
    ):
        super().__init__()
        
        # Layer 1
        self.fc1 = nn.Linear(in_dim, hidden[0])
        self.bn1 = nn.BatchNorm1d(hidden[0])
        self.dropout1 = nn.Dropout(dropout)
        
        # Layer 2 with residual
        self.fc2 = nn.Linear(hidden[0], hidden[1])
        self.bn2 = nn.BatchNorm1d(hidden[1])
        self.dropout2 = nn.Dropout(dropout * 0.8)
        
        # Layer 3 with residual
        self.fc3 = nn.Linear(hidden[1], hidden[2])
        self.bn3 = nn.BatchNorm1d(hidden[2])
        self.dropout3 = nn.Dropout(dropout * 0.6)
        
        # Output layer
        self.fc4 = nn.Linear(hidden[2], out_dim)
        
        # Residual projection layers
        self.residual1 = nn.Linear(hidden[0], hidden[1]) if hidden[0] != hidden[1] else nn.Identity()
        self.residual2 = nn.Linear(hidden[1], hidden[2]) if hidden[1] != hidden[2] else nn.Identity()
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Layer 1
        h1 = self.dropout1(F.relu(self.bn1(self.fc1(x))))
        
        # Layer 2 with residual
        h2 = self.dropout2(F.relu(self.bn2(self.fc2(h1))))
        h2 = h2 + self.residual1(h1)  # Residual connection
        
        # Layer 3 with residual
        h3 = self.dropout3(F.relu(self.bn3(self.fc3(h2))))
        h3 = h3 + self.residual2(h2)  # Residual connection
        
        # Output with L2 normalization
        out = self.fc4(h3)
        out = F.normalize(out, p=2, dim=-1)
        
        return out


class TwoTowerV6Extreme(nn.Module):
    """
    V6 EXTREME: Two-Tower model for handling extremely complex scenarios.
    
    Key improvements:
    - Multi-hot game encoding instead of embeddings
    - Gender-conditioned game processing
    - Explicit game intersection features
    - Rejection-aware encoding
    - Larger architecture with residual connections
    - Multiple auxiliary objectives
    """
    
    def __init__(
        self,
        num_users: int,
        emb_user_dim: int = 64,
        emb_age_dim: int = 16,
        game_emb_dim: int = 64,
        tower_hidden: Tuple[int, int, int] = (512, 256, 128),
        out_dim: int = 128,
        dropout: float = 0.3,
        temperature: float = 0.07
    ):
        super().__init__()
        
        # User ID embeddings
        self.emb_users = nn.Embedding(num_users, emb_user_dim)
        nn.init.xavier_uniform_(self.emb_users.weight)
        
        # Age embeddings
        self.num_age_bins = 8
        self.emb_age = nn.Embedding(self.num_age_bins, emb_age_dim)
        nn.init.xavier_uniform_(self.emb_age.weight)
        
        # Gender-conditioned game encoder
        self.game_encoder = GenderConditionedGameEncoder(emb_dim=game_emb_dim)
        
        # Game intersection feature extractor
        self.intersection_features = GameIntersectionFeatures()
        
        # Tower input dimensions
        # user_id(emb_user_dim) + age(emb_age_dim) + gender(2) + 
        # game_features(game_emb_dim) + rejection_score(8)
        tower_in_dim = emb_user_dim + emb_age_dim + 2 + game_emb_dim + 8
        
        self.user_tower = EnhancedTowerV6(tower_in_dim, hidden=tower_hidden, 
                                          out_dim=out_dim, dropout=dropout)
        self.item_tower = EnhancedTowerV6(tower_in_dim, hidden=tower_hidden, 
                                          out_dim=out_dim, dropout=dropout)
        
        # Temperature for scoring
        self.temperature = nn.Parameter(torch.tensor(temperature))
        
        # Rejection classifier head (for auxiliary loss)
        self.rejection_head = nn.Sequential(
            nn.Linear(out_dim, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )
    
    def _age_to_bin(self, age_scalar: float) -> int:
        """Convert age to bin index."""
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
    
    def _games_to_multihot(self, game_indices: List[List[int]], device) -> torch.Tensor:
        """Convert game indices to multi-hot encoding."""
        batch_size = len(game_indices)
        multihot = torch.zeros(batch_size, NUM_GAMES, device=device)
        
        for i, indices in enumerate(game_indices):
            for idx in indices:
                if 0 <= idx < NUM_GAMES:
                    multihot[i, idx] = 1.0
        
        return multihot
    
    def encode_user(
        self,
        user_ids: torch.Tensor,
        age: torch.Tensor,
        gender: torch.Tensor,
        game_indices: List[List[int]]
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Encode user features.
        
        Returns:
            embedding: [batch, out_dim]
            rejection_score: [batch, 8]
        """
        batch_size = age.shape[0]
        device = age.device
        
        # User ID embeddings
        user_embeds = self.emb_users(user_ids)
        
        # Age embeddings
        age_bins = []
        for i in range(batch_size):
            age_val = age[i, 0].item() * 100  # Denormalize
            age_bin = self._age_to_bin(age_val)
            age_bins.append(age_bin)
        age_bins_tensor = torch.tensor(age_bins, dtype=torch.long, device=device)
        age_features = self.emb_age(age_bins_tensor)
        
        # Multi-hot game encoding
        game_vector = self._games_to_multihot(game_indices, device)
        
        # Gender-conditioned game encoding
        game_features, rejection_score = self.game_encoder(game_vector, gender)
        
        # Concatenate all features
        x = torch.cat([user_embeds, age_features, gender, game_features, rejection_score], dim=1)
        
        # Pass through tower
        embedding = self.user_tower(x)
        
        return embedding, rejection_score
    
    def encode_item(
        self,
        user_ids: torch.Tensor,
        age: torch.Tensor,
        gender: torch.Tensor,
        game_indices: List[List[int]]
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Encode item (candidate) features.
        
        Returns:
            embedding: [batch, out_dim]
            rejection_score: [batch, 8]
        """
        batch_size = age.shape[0]
        device = age.device
        
        # User ID embeddings
        user_embeds = self.emb_users(user_ids)
        
        # Age embeddings
        age_bins = []
        for i in range(batch_size):
            age_val = age[i, 0].item() * 100
            age_bin = self._age_to_bin(age_val)
            age_bins.append(age_bin)
        age_bins_tensor = torch.tensor(age_bins, dtype=torch.long, device=device)
        age_features = self.emb_age(age_bins_tensor)
        
        # Multi-hot game encoding
        game_vector = self._games_to_multihot(game_indices, device)
        
        # Gender-conditioned game encoding
        game_features, rejection_score = self.game_encoder(game_vector, gender)
        
        # Concatenate all features
        x = torch.cat([user_embeds, age_features, gender, game_features, rejection_score], dim=1)
        
        # Pass through tower
        embedding = self.item_tower(x)
        
        return embedding, rejection_score
    
    def score(self, u_vec: torch.Tensor, v_vec: torch.Tensor) -> torch.Tensor:
        """Compute similarity score with temperature scaling."""
        raw_score = torch.sum(u_vec * v_vec, dim=-1)
        return raw_score / self.temperature
    
    def predict_rejection(self, embedding: torch.Tensor) -> torch.Tensor:
        """Predict if this user should be rejected (auxiliary task)."""
        return self.rejection_head(embedding)
    
    def compute_intersection_features(
        self,
        user_game_indices: List[List[int]],
        cand_game_indices: List[List[int]]
    ) -> torch.Tensor:
        """Compute explicit intersection features between user and candidate."""
        device = self.emb_users.weight.device
        
        user_games = self._games_to_multihot(user_game_indices, device)
        cand_games = self._games_to_multihot(cand_game_indices, device)
        
        return self.intersection_features(user_games, cand_games)


