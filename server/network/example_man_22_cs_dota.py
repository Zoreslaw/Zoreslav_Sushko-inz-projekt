#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Man 22M preferences test: CS2 + Dota2 player with gender-specific game preferences.

Rules:
- Main user: 22M, plays CS2 and Dota2
- Women: Positive if plays CS2 (любые женщины с CS2)
- Men: Positive if plays Dota2 (любые мужчины с Dota2)
"""

import random
from models.domain import DataStore, GAMES
from training.trainer_v6 import train_model_v6_extreme
from recommendation.recommender_v6 import topk_recommend_v6


def generate_users_with_preferences(dat: DataStore, main_user_id: int, num_users: int = 600):
    """Generate users for 22M with gender-specific game preferences."""
    
    main_user = dat.users[main_user_id]
    main_games = set(main_user.games)
    
    print(f"\n{'='*60}")
    print(f"Generating {num_users} training users...")
    print(f"Main user: {main_user.age}M, games: {', '.join(main_user.games)}")
    print(f"Rules:")
    print(f"  - Women with CS2 -> POSITIVE")
    print(f"  - Men with Dota2 -> POSITIVE")
    print(f"  - Others -> NEGATIVE")
    print(f"{'='*60}\n")
    
    positives = []
    negatives = []
    
    for i in range(num_users):
        age = random.randint(14, 45)
        gender = random.choice(['M', 'F'])
        num_games = random.randint(1, 4)
        games = random.sample(GAMES, num_games)
        
        user_id = dat.add_user(age, gender, games)
        
        is_positive = False
        reason = ""
        
        # Women: must have CS2
        if gender == 'F':
            if 'cs2' in games:
                is_positive = True
                reason = f"F with CS2"
            else:
                reason = f"F without CS2"
        
        # Men: must have Dota2
        elif gender == 'M':
            if 'dota2' in games:
                is_positive = True
                reason = f"M with Dota2"
            else:
                reason = f"M without Dota2"
        
        if is_positive:
            dat.add_positive(main_user_id, user_id)
            positives.append((user_id, reason))
        else:
            dat.add_negative(main_user_id, user_id)
            negatives.append((user_id, reason))
    
    print(f"Generated: {len(positives)} positives, {len(negatives)} negatives")
    
    # Show distribution
    female_cs2 = sum(1 for uid, r in positives if 'F with CS2' in r)
    male_dota2 = sum(1 for uid, r in positives if 'M with Dota2' in r)
    print(f"  Positives: {female_cs2} women with CS2, {male_dota2} men with Dota2")
    
    return positives, negatives


def check_man_rules(user, main_user):
    """Check if user meets man's preference rules."""
    
    # Women: must have CS2
    if user.gender == 'F':
        if 'cs2' in user.games:
            return True, "F with CS2"
        else:
            return False, "F without CS2"
    
    # Men: must have Dota2
    elif user.gender == 'M':
        if 'dota2' in user.games:
            return True, "M with Dota2"
        else:
            return False, "M without Dota2"
    
    return False, "unknown"


def main():
    print("="*70)
    print("V6 EXTREME: Man 22M - Gender-Specific Game Preferences")
    print("="*70)
    print("\nScenario:")
    print("  Main: 22M, plays CS2 + Dota2")
    print("  Wants: Women who play CS2")
    print("  Wants: Men who play Dota2")
    print("="*70)
    
    # Create dataset
    dat = DataStore()
    main_user_id = dat.add_user(
        age=22,
        gender='M',
        games=['cs2', 'dota2']
    )
    
    # Generate training users
    positives, negatives = generate_users_with_preferences(dat, main_user_id, num_users=600)
    
    # Add test users
    print(f"\nAdding 1000 test users...")
    new_user_start = len(dat.users)
    for i in range(1000):
        age = random.randint(15, 40)
        gender = random.choice(['M', 'F'])
        num_games = random.randint(1, 3)
        games = random.sample(GAMES, num_games)
        dat.add_user(age, gender, games)
    
    print(f"Total users: {len(dat.users)}")
    
    # Train with OPTIMAL parameters
    print(f"\n{'='*70}")
    print("TRAINING MODEL")
    print(f"{'='*70}\n")
    
    model = train_model_v6_extreme(
        dat,
        epochs=80,
        lr=1e-4,
        batch_size=16,
        dropout=0.3,
        use_scheduler=True,
        focal_gamma=2.0,
        rejection_weight=0.5,
        intersection_weight=0.3,
        use_weighted_sampling=True,
        emb_age_dim=32,
        emb_user_dim=64,
        game_emb_dim=64,
        tower_hidden=(512, 256, 128),
        out_dim=128,
        temperature=0.07,
        log_fn=lambda msg: print(msg) if 'Epoch' in msg and 
               (int(msg.split()[1]) % 10 == 0 or int(msg.split()[1]) <= 5) else None
    )
    
    # Get recommendations
    print(f"\n{'='*70}")
    print("GENERATING RECOMMENDATIONS")
    print(f"{'='*70}\n")
    
    recommendations = topk_recommend_v6(
        model, 
        dat, 
        main_user_id, 
        K=30, 
        use_rejection_filter=False
    )
    
    # Analyze only NEW users
    new_recommendations = [(uid, score) for uid, score in recommendations if uid >= new_user_start]
    top_20_new = new_recommendations[:20]
    
    # Detailed analysis
    print(f"Top 20 Recommendations (from {len([u for u in range(new_user_start, len(dat.users))])} test users):\n")
    
    correct = 0
    wrong = 0
    female_cs2_count = 0
    female_no_cs2_count = 0
    male_dota2_count = 0
    male_no_dota2_count = 0
    
    for rank, (user_id, score) in enumerate(top_20_new, 1):
        user = dat.users[user_id]
        meets_rules, reason = check_man_rules(user, dat.users[main_user_id])
        
        status = "[OK]" if meets_rules else "[FAIL]"
        
        # Highlight specific games
        games_str = ', '.join(user.games)
        if user.gender == 'F' and 'cs2' in user.games:
            games_str = games_str.replace('cs2', '**CS2**')
        elif user.gender == 'M' and 'dota2' in user.games:
            games_str = games_str.replace('dota2', '**DOTA2**')
        
        print(f"{rank:2}. {status} {user.gender} {user.age:2} | "
              f"Games: {games_str:<35} | "
              f"{reason:<20} | Score: {score:.3f}")
        
        if meets_rules:
            correct += 1
            if user.gender == 'F':
                female_cs2_count += 1
            else:
                male_dota2_count += 1
        else:
            wrong += 1
            if user.gender == 'F':
                female_no_cs2_count += 1
            else:
                male_no_dota2_count += 1
    
    # Summary
    precision = correct / len(top_20_new) * 100 if top_20_new else 0
    
    print(f"\n{'='*70}")
    print("RESULTS")
    print(f"{'='*70}")
    print(f"\nPrecision: {precision:.1f}% ({correct}/{len(top_20_new)})")
    
    print(f"\nBreakdown:")
    print(f"  Correct:")
    print(f"    - Women with CS2: {female_cs2_count}")
    print(f"    - Men with Dota2: {male_dota2_count}")
    print(f"  Wrong:")
    print(f"    - Women without CS2: {female_no_cs2_count}")
    print(f"    - Men without Dota2: {male_no_dota2_count}")
    
    if precision == 100:
        print("\nStatus: PERFECT!")
    elif precision >= 80:
        print("\nStatus: EXCELLENT!")
    elif precision >= 60:
        print("\nStatus: GOOD")
    else:
        print("\nStatus: NEEDS IMPROVEMENT")
    
    print(f"{'='*70}\n")


if __name__ == "__main__":
    main()

