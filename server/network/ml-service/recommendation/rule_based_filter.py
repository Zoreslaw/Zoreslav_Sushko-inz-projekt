#!/usr/bin/env python3
"""
Rule-Based Post-Processing Filter for Hybrid Recommendations.

⚠️ WARNING: Use this ONLY for EXTREMELY COMPLEX scenarios with multiple hard constraints!

For normal cases, let the neural network learn the rules itself. This hybrid approach
should be used only when you have very strict, non-negotiable rules that the NN
struggles to learn (e.g., "MUST have 2+ FPS games AND age 20-25 AND NOT dota2").

For simple preferences (age range, gender, common games), train the neural network better
instead of using rule-based post-processing!
"""

from typing import List, Tuple, Callable
from models.domain import UserProfile, DataStore


def apply_hybrid_filtering(
    neural_recs: List[Tuple[int, float]],
    user: UserProfile,
    dat: DataStore,
    K: int = 20,
    custom_filter: Callable[[UserProfile, UserProfile], Tuple[bool, str]] = None
) -> List[Tuple[int, float]]:
    """
    Apply rule-based filtering to neural network recommendations.
    
    Args:
        neural_recs: List of (user_id, score) from neural network
        user: The main user profile
        dat: DataStore with all user data
        K: Number of recommendations to return
        custom_filter: Optional custom filter function that takes (main_user, candidate)
                      and returns (passes, reason)
    
    Returns:
        List of (user_id, score) that pass all filters
    """
    
    if custom_filter is None:
        # Default: no filtering, just return top K
        return neural_recs[:K]
    
    filtered = []
    
    for user_id, score in neural_recs:
        candidate = dat.users[user_id]
        passes, reason = custom_filter(user, candidate)
        
        if passes:
            filtered.append((user_id, score))
            if len(filtered) >= K:
                break
    
    return filtered


def create_age_game_filter(
    min_age: int = None,
    max_age: int = None,
    required_games: List[str] = None,
    forbidden_games: List[str] = None,
    min_common_games: int = 0
):
    """
    Create a filter function for age and game constraints.
    
    Args:
        min_age: Minimum age (inclusive)
        max_age: Maximum age (inclusive)
        required_games: List of games candidate must have (any of them)
        forbidden_games: List of games candidate must NOT have
        min_common_games: Minimum number of common games required
    
    Returns:
        Filter function
    """
    
    def filter_fn(main_user: UserProfile, candidate: UserProfile) -> Tuple[bool, str]:
        # Check age
        if min_age is not None and candidate.age < min_age:
            return False, f"age {candidate.age} < {min_age}"
        
        if max_age is not None and candidate.age > max_age:
            return False, f"age {candidate.age} > {max_age}"
        
        # Check forbidden games
        if forbidden_games:
            for game in forbidden_games:
                if game in candidate.games:
                    return False, f"has forbidden game: {game}"
        
        # Check required games
        if required_games:
            has_required = any(game in candidate.games for game in required_games)
            if not has_required:
                return False, f"missing required games: {required_games}"
        
        # Check common games
        if min_common_games > 0:
            common = len(set(main_user.games) & set(candidate.games))
            if common < min_common_games:
                return False, f"only {common} common games (need {min_common_games})"
        
        return True, "passes all rules"
    
    return filter_fn


def create_complex_filter(rules: dict):
    """
    Create a complex filter with multiple conditional rules.
    
    Args:
        rules: Dictionary with conditional rules
    
    Returns:
        Filter function
    """
    
    def filter_fn(main_user: UserProfile, candidate: UserProfile) -> Tuple[bool, str]:
        # Example: implement custom logic based on rules dict
        # This is a template that can be customized per scenario
        
        return True, "passes"
    
    return filter_fn

