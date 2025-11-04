#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Example: Man 22 years old with specific game and partner preferences.

Main user: 22M, [cs2, overwatch2, minecraft, valorant]

Preference rules:
- MEN: age 16-30, must have cs2 OR overwatch2, must NOT have dota2
- WOMEN: age 18-24, no game restrictions
"""

import random
from models.domain import DataStore, GAMES
from training.trainer import train_model_v2
from recommendation.recommender import topk_recommend


def generate_users_with_preferences(dat: DataStore, main_user_id: int, num_users: int = 600):
    """
    Generates users and interactions based on preferences.
    
    Main user: 22M, [cs2, overwatch2, minecraft, valorant]
    
    Preferences:
    - POSITIVE MEN: age 16-30 + (has cs2 OR overwatch2) + (does NOT have dota2)
    - POSITIVE WOMEN: age 18-24 (no game restrictions)
    - NEGATIVE: everyone else
    """
    
    main_user = dat.users[main_user_id]
    main_games = set(main_user.games)  # {cs2, overwatch2, minecraft, valorant}
    
    print(f"\n{'='*60}")
    print(f"Generating {num_users} users for:")
    print(f"  ID: {main_user_id}")
    print(f"  Age: {main_user.age}")
    print(f"  Gender: {main_user.gender}")
    print(f"  Games: {', '.join(main_user.games)}")
    print(f"{'='*60}\n")
    
    positives = []
    negatives = []
    
    # Generate diverse users
    for i in range(num_users):
        # Random characteristics
        age = random.randint(14, 45)  # Wide range
        gender = random.choice(['M', 'F'])
        
        # Random set of games (1-4 games)
        num_games = random.randint(1, 4)
        games = random.sample(GAMES, num_games)
        
        # Add user
        user_id = dat.add_user(age, gender, games)
        
        # Check games
        has_cs2 = 'cs2' in games
        has_overwatch2 = 'overwatch2' in games
        has_dota2 = 'dota2' in games
        has_cs2_or_ow2 = has_cs2 or has_overwatch2
        
        # Determine positive or negative by rules
        is_positive = False
        reason = ""
        
        if gender == 'M':
            # MEN: age 16-30, must have cs2 OR overwatch2, must NOT have dota2
            if 16 <= age <= 30:
                if has_cs2_or_ow2 and not has_dota2:
                    is_positive = True
                    common_games = []
                    if has_cs2:
                        common_games.append('cs2')
                    if has_overwatch2:
                        common_games.append('overwatch2')
                    reason = f"M {age}, games: {', '.join(common_games)}"
                elif not has_cs2_or_ow2:
                    reason = f"M {age}, no cs2/overwatch2"
                elif has_dota2:
                    reason = f"M {age}, has dota2 (rejected)"
            else:
                if age < 16:
                    reason = f"M {age} - too young (<16)"
                else:
                    reason = f"M {age} - too old (>30)"
        
        else:  # gender == 'F'
            # WOMEN: age 18-24, no game restrictions
            if 18 <= age <= 24:
                is_positive = True
                reason = f"F {age}, games: {', '.join(games)}"
            else:
                if age < 18:
                    reason = f"F {age} - too young (<18)"
                else:
                    reason = f"F {age} - too old (>24)"
        
        # Add interaction
        if is_positive:
            dat.add_positive(main_user_id, user_id)
            positives.append((user_id, reason))
        else:
            dat.add_negative(main_user_id, user_id)
            negatives.append((user_id, reason))
    
    return positives, negatives


def main():
    print("="*70)
    print("EXPERIMENT: Recommendations for man with specific preferences")
    print("="*70)
    
    # 1. Create main user
    print("\n1. Creating main user...")
    dat = DataStore()
    main_user_id = dat.add_user(
        age=22,
        gender='M',
        games=['cs2', 'overwatch2', 'minecraft', 'valorant']
    )
    print(f"   [OK] Created user ID={main_user_id}: 22M, games: cs2, overwatch2, minecraft, valorant")
    
    # 2. Generate users with interactions
    print("\n2. Generating 600 users with preference rules...")
    positives, negatives = generate_users_with_preferences(dat, main_user_id, num_users=600)
    
    print(f"\n   Interaction statistics:")
    print(f"   [+] Positives: {len(positives)}")
    print(f"   [-] Negatives: {len(negatives)}")
    print(f"   [TOTAL] Users: {len(dat.users)}")
    
    # Show positive examples
    print(f"\n   Examples of POSITIVE users:")
    for user_id, reason in positives[:5]:
        user = dat.users[user_id]
        print(f"     [+] ID {user_id}: {reason}")
    
    # Show negative examples
    print(f"\n   Examples of NEGATIVE users:")
    for user_id, reason in negatives[:5]:
        user = dat.users[user_id]
        print(f"     [-] ID {user_id}: {reason}")
    
    # 2.5. Add new random users BEFORE training
    print("\n2.5. Adding 1000 random new users (for testing)...")
    new_user_start = len(dat.users)
    
    for i in range(1000):
        age = random.randint(15, 40)
        gender = random.choice(['M', 'F'])
        num_games = random.randint(1, 3)
        games = random.sample(GAMES, num_games)
        dat.add_user(age, gender, games)
    
    print(f"   [OK] Added users: {new_user_start} -> {len(dat.users)}")
    print(f"   [!] These users did NOT participate in training (no interactions)")
    
    # 3. Train model with V5 GAME-FIRST improvements
    print(f"\n3. Training V5 GAME-FIRST + Auxiliary Loss model on {len(dat.interactions.positives)} positives...")
    print("   V5+ improvements:")
    print("     - Game embeddings: 64-dim (MAXIMUM game representation)")
    print("     - Game weight: x2.0 in input (DOUBLE importance)")
    print("     - Learning rate: 0.0005 (fine-tuning for games)")
    print("     - Temperature: 0.07 (balanced for game focus)")
    print("     - Auxiliary game-overlap loss (0.10 weight - INCREASED for game focus)")
    print("   V3 improvements:")
    print("     - Age embedding: 8 bins x 16-dim, InfoNCE loss")
    print("   V2 improvements:")
    print("     - User ID: 64, Hidden: (256,128), Out: 64, Dropout: 0.2")
    print("   (this will take ~90-120 seconds)\n")
    
    model = train_model_v2(
        dat,
        epochs=100,
        lr=5e-4,  # V5: Lower LR for fine-tuning (was 1e-3)
        batch_size=32,
        log_fn=lambda msg: print(f"   {msg}"),
        use_attention=True,
        use_age_embedding=True,
        dropout=0.2,
        use_scheduler=True,
        loss_name='infonce',
        loss_kwargs={'temperature': 0.07},  # V5: back to 0.07 for game focus
        tower_hidden=(256, 128),
        out_dim=64,
        emb_games_dim=64,  # V5: MAXIMUM game embeddings (was 48)
        emb_user_dim=64,
        emb_age_dim=16,
        hard_negative_ratio=0.0,  # NO hard negatives
        aux_overlap_weight=0.10  # V5+: Auxiliary game-overlap loss (INCREASED for game focus)
    )
    
    print("\n   [OK] Training completed!")
    
    # 4. Get recommendations from 1000 new users
    print("\n4. Getting TOP-20 recommendations (from 1000 new users)...")
    print("="*70)
    
    recommendations = topk_recommend(model, dat, main_user_id, K=20)
    
    print(f"\nTOP-20 recommendations for user {main_user_id} (22M, cs2/overwatch2/minecraft/valorant):\n")
    
    for rank, (user_id, score) in enumerate(recommendations, 1):
        user = dat.users[user_id]
        games_str = ', '.join(user.games)
        
        # Check if this was in training
        was_positive = (main_user_id, user_id) in dat.interactions.positives
        was_negative = (main_user_id, user_id) in dat.interactions.negatives
        
        label = ""
        if was_positive:
            label = " [+] [WAS POSITIVE]"
        elif was_negative:
            label = " [-] [WAS NEGATIVE]"
        else:
            label = " [*] [NEW]"
        
        # Check game criteria
        has_cs2 = 'cs2' in user.games
        has_ow2 = 'overwatch2' in user.games
        has_dota2 = 'dota2' in user.games
        
        game_info = ""
        if user.gender == 'M':
            if has_cs2 or has_ow2:
                common = []
                if has_cs2:
                    common.append('cs2')
                if has_ow2:
                    common.append('overwatch2')
                game_info = f" [Has: {', '.join(common)}]"
                if has_dota2:
                    game_info += " [!DOTA2]"
            else:
                game_info = " [NO cs2/ow2]"
        else:
            game_info = " [F: no restrictions]"
        
        print(f"  #{rank:2d}. ID {user_id:4d} | {user.gender} {user.age:2d}y | "
              f"Score: {score:+.3f} | {games_str}{game_info}{label}")
    
    # 5. DETAILED ANALYSIS
    print("\n" + "="*70)
    print("DETAILED RECOMMENDATION ANALYSIS")
    print("="*70)
    
    # Analyze only NEW users (not seen during training)
    new_recommendations = [(uid, score) for uid, score in recommendations if uid >= new_user_start]
    top_20_new = new_recommendations[:20]
    
    print(f"\n[A] TOP-20 FROM NEW USERS (1000 candidates):")
    print(f"    Total new users in recommendations: {len(new_recommendations)}")
    
    # Check if new users meet preferences
    correct_by_rules = 0
    wrong_by_rules = 0
    error_details = []
    
    for user_id, score in top_20_new:
        user = dat.users[user_id]
        
        has_cs2 = 'cs2' in user.games
        has_ow2 = 'overwatch2' in user.games
        has_dota2 = 'dota2' in user.games
        has_cs2_or_ow2 = has_cs2 or has_ow2
        
        # Apply preference rules
        should_be_positive = False
        if user.gender == 'M':
            # MEN: age 16-30, must have cs2 OR overwatch2, must NOT have dota2
            if 16 <= user.age <= 30 and has_cs2_or_ow2 and not has_dota2:
                should_be_positive = True
        else:  # F
            # WOMEN: age 18-24, no game restrictions
            if 18 <= user.age <= 24:
                should_be_positive = True
        
        if should_be_positive:
            correct_by_rules += 1
        else:
            wrong_by_rules += 1
            # Save error details
            reason = ""
            if user.gender == 'M':
                if user.age < 16:
                    reason = "male age < 16"
                elif user.age > 30:
                    reason = "male age > 30"
                elif not has_cs2_or_ow2:
                    reason = "male: no cs2/overwatch2"
                elif has_dota2:
                    reason = "male: has dota2"
            else:  # F
                if user.age < 18:
                    reason = "female age < 18"
                elif user.age > 24:
                    reason = "female age > 24"
            error_details.append((user_id, user.gender, user.age, ', '.join(user.games), reason))
    
    precision = correct_by_rules / len(top_20_new) * 100 if top_20_new else 0
    
    print(f"\n    Precision (meets preferences): {correct_by_rules}/{len(top_20_new)} = {precision:.1f}%")
    print(f"    Errors (violates preferences): {wrong_by_rules}/{len(top_20_new)}")
    
    if error_details:
        print(f"\n    Error details (violations):")
        for uid, gender, age, games, reason in error_details[:5]:
            print(f"      - ID {uid}: {gender} {age}y, {games} -> {reason}")
    
    # Gender distribution in new users
    print(f"\n[B] GENDER DISTRIBUTION (TOP-20 new users):")
    females_new = sum(1 for uid, _ in top_20_new if dat.users[uid].gender == 'F')
    males_new = sum(1 for uid, _ in top_20_new if dat.users[uid].gender == 'M')
    female_pct = females_new / len(top_20_new) * 100 if top_20_new else 0
    male_pct = males_new / len(top_20_new) * 100 if top_20_new else 0
    
    print(f"    Females: {females_new}/20 ({female_pct:.0f}%)")
    print(f"    Males:   {males_new}/20 ({male_pct:.0f}%)")
    
    # Age distribution
    print(f"\n[C] AGE DISTRIBUTION (TOP-20 new users):")
    ages = [dat.users[uid].age for uid, _ in top_20_new]
    avg_age = sum(ages) / len(ages) if ages else 0
    min_age = min(ages) if ages else 0
    max_age = max(ages) if ages else 0
    
    # Check age ranges by gender
    males_in_range = sum(1 for uid, _ in top_20_new 
                         if dat.users[uid].gender == 'M' and 16 <= dat.users[uid].age <= 30)
    females_in_range = sum(1 for uid, _ in top_20_new 
                           if dat.users[uid].gender == 'F' and 18 <= dat.users[uid].age <= 24)
    
    print(f"    Average age: {avg_age:.1f} years")
    print(f"    Age range: {min_age} - {max_age} years")
    print(f"    Males in range (16-30): {males_in_range}/{males_new}")
    print(f"    Females in range (18-24): {females_in_range}/{females_new}")
    
    # Game analysis for MEN
    print(f"\n[D] GAME ANALYSIS FOR MEN (TOP-20 new users):")
    men_with_cs2_or_ow2 = 0
    men_with_dota2 = 0
    
    for uid, _ in top_20_new:
        user = dat.users[uid]
        if user.gender == 'M':
            has_cs2 = 'cs2' in user.games
            has_ow2 = 'overwatch2' in user.games
            has_dota2 = 'dota2' in user.games
            
            if has_cs2 or has_ow2:
                men_with_cs2_or_ow2 += 1
            if has_dota2:
                men_with_dota2 += 1
    
    print(f"    Men with cs2 OR overwatch2: {men_with_cs2_or_ow2}/{males_new}")
    print(f"    Men with dota2 (rejected): {men_with_dota2}/{males_new}")
    
    if men_with_cs2_or_ow2 == males_new and men_with_dota2 == 0:
        print(f"    [OK] All men meet game criteria!")
    else:
        print(f"    [!] Some men don't meet game criteria")
    
    # Score distribution
    print(f"\n[E] SCORE DISTRIBUTION (TOP-20):")
    scores = [score for _, score in top_20_new]
    avg_score = sum(scores) / len(scores) if scores else 0
    score_range = max(scores) - min(scores) if scores else 0
    
    print(f"    Average score: {avg_score:.2f}")
    print(f"    Score range:   {score_range:.2f}")
    print(f"    Best score:    {max(scores):.2f}")
    print(f"    Worst score:   {min(scores):.2f}")
    
    if score_range < 0.5:
        print(f"    [!] Low score variance - model might be underfitting")
    
    # 6. RECOMMENDATIONS
    print("\n" + "="*70)
    print("RECOMMENDATIONS TO IMPROVE MODEL")
    print("="*70)
    
    print(f"\n1. DATA IMPROVEMENTS:")
    print(f"   - Current training size: {len(positives)} positives")
    print(f"   - Positive/Negative ratio: {len(positives)}/{len(negatives)}")
    
    if precision < 70:
        print(f"\n2. MODEL ARCHITECTURE:")
        print(f"   [!] LOW PRECISION - try:")
        print(f"       - Increase aux_overlap_weight (0.05 -> 0.08)")
        print(f"       - Lower temperature (0.07 -> 0.05)")
        print(f"       - More epochs (100 -> 150)")
    
    if men_with_dota2 > 0:
        print(f"\n3. DOTA2 REJECTION:")
        print(f"   [!] Model recommends men with dota2 - try:")
        print(f"       - Add negative penalty for dota2 in loss")
        print(f"       - Increase training data with more dota2 negatives")
    
    print("\n" + "="*70)
    print(f"EXPERIMENT COMPLETED - Precision: {precision:.1f}%")
    print("="*70)


if __name__ == "__main__":
    main()

