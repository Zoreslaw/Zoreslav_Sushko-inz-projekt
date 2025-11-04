#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Example: Woman 24 years old with specific game and partner preferences.

Preference rules:
- Positive: at least 1 common game + age 17-30
- For men: age up to 28
- Slight preference for women
"""

import random
from models.domain import DataStore, GAMES
from training.trainer import train_model_v2
from recommendation.recommender import topk_recommend


def generate_users_with_preferences(dat: DataStore, main_user_id: int, num_users: int = 150):
    """
    Generates users and interactions based on preferences.
    
    Main user: 24F, [overwatch2, minecraft, cs2]
    
    Preferences:
    - POSITIVE: at least 1 common game + age 17-30 (men up to 28)
    - NEGATIVE: no common games OR age <17 or >30 OR men >28
    """
    
    main_user = dat.users[main_user_id]
    main_games = set(main_user.games)  # {overwatch2, minecraft, cs2}
    
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
        
        # Check if there are common games
        common_games = main_games & set(games)
        has_common_game = len(common_games) > 0
        
        # Determine positive or negative by rules
        is_positive = False
        reason = ""
        
        if has_common_game:
            # Has common game - check age
            if 17 <= age <= 30:
                if gender == 'F':
                    # Women 17-30 with common game - always positive
                    is_positive = True
                    reason = f"F {age}, common games: {', '.join(common_games)}"
                elif gender == 'M' and age <= 28:
                    # Men 17-28 with common game - positive
                    is_positive = True
                    reason = f"M {age}, common games: {', '.join(common_games)}"
                else:
                    # Men 29-30 - negative (too old)
                    reason = f"M {age} - too old (>28)"
            else:
                # Age doesn't fit
                if age < 17:
                    reason = f"{gender} {age} - too young (<17)"
                else:
                    reason = f"{gender} {age} - too old (>30)"
        else:
            # No common games - negative
            reason = f"{gender} {age}, no common games"
        
        # Record interaction
        if is_positive:
            positives.append((user_id, reason))
            dat.add_positive(main_user_id, user_id)
        else:
            negatives.append((user_id, reason))
            dat.add_negative(main_user_id, user_id)
    
    return positives, negatives


def main():
    print("="*70)
    print("EXPERIMENT: Recommendations for woman with specific preferences")
    print("="*70)
    
    dat = DataStore()
    
    # 1. Create main user
    print("\n1. Creating main user...")
    main_user_id = dat.add_user(
        age=24,
        gender='F',
        games=['overwatch2', 'minecraft', 'cs2']
    )
    print(f"   [OK] Created user ID={main_user_id}: 24F, games: overwatch2, minecraft, cs2")
    
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
    print(f"\n3. Training V5 GAME-FIRST model on {len(dat.interactions.positives)} positives...")
    print("   NEW V5 GAME-FIRST improvements:")
    print("     - Game embeddings: 64-dim (MAXIMUM game representation)")
    print("     - Game weight: x2.0 in input (DOUBLE importance)")
    print("     - Learning rate: 0.0005 (fine-tuning for games)")
    print("     - Temperature: 0.07 (balanced for game focus)")
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
        hard_negative_ratio=0.0  # NO hard negatives
    )
    
    print("\n   [OK] Training completed!")
    
    # 4. Get recommendations from 1000 new users
    print("\n4. Getting TOP-20 recommendations (from 1000 new users)...")
    print("="*70)
    
    recommendations = topk_recommend(model, dat, main_user_id, K=20)
    
    print(f"\nTOP-20 recommendations for user {main_user_id} (24F, overwatch2/minecraft/cs2):\n")
    
    for rank, (user_id, score) in enumerate(recommendations, 1):
        user = dat.users[user_id]
        games_str = ', '.join(user.games)
        common = set(dat.users[main_user_id].games) & set(user.games)
        common_str = f" [Common: {', '.join(common)}]" if common else " [NO common games]"
        
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
        
        print(f"  #{rank:2d}. ID {user_id:3d} | {user.gender} {user.age:2d}y | "
              f"Score: {score:+.3f} | {games_str}{common_str}{label}")
    
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
    main_games = set(dat.users[main_user_id].games)
    correct_by_rules = 0
    wrong_by_rules = 0
    error_details = []
    
    for user_id, score in top_20_new:
        user = dat.users[user_id]
        common_games = main_games & set(user.games)
        has_common = len(common_games) > 0
        
        # Apply preference rules
        should_be_positive = False
        if has_common and 17 <= user.age <= 30:
            if user.gender == 'F' or (user.gender == 'M' and user.age <= 28):
                should_be_positive = True
        
        if should_be_positive:
            correct_by_rules += 1
        else:
            wrong_by_rules += 1
            # Save error details
            reason = ""
            if not has_common:
                reason = "no common games"
            elif user.age < 17:
                reason = "age < 17"
            elif user.age > 30:
                reason = "age > 30"
            elif user.gender == 'M' and user.age > 28:
                reason = "male > 28"
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
    
    if females_new > males_new:
        print(f"    [OK] Model captured preference for females!")
    else:
        print(f"    [!] Model did NOT capture female preference strongly")
    
    # Age distribution
    print(f"\n[C] AGE DISTRIBUTION (TOP-20 new users):")
    ages = [dat.users[uid].age for uid, _ in top_20_new]
    avg_age = sum(ages) / len(ages) if ages else 0
    min_age = min(ages) if ages else 0
    max_age = max(ages) if ages else 0
    in_range = sum(1 for age in ages if 17 <= age <= 30)
    
    print(f"    Average age: {avg_age:.1f} years")
    print(f"    Age range: {min_age} - {max_age} years")
    print(f"    Within preferred range (17-30): {in_range}/20")
    
    if in_range < 15:
        print(f"    [!] Many users outside age range - consider age feature weight")
    
    # Common games analysis
    print(f"\n[D] COMMON GAMES ANALYSIS (TOP-20 new users):")
    with_common = 0
    no_common = 0
    common_counts = {game: 0 for game in main_games}
    
    for user_id, _ in top_20_new:
        user = dat.users[user_id]
        common = main_games & set(user.games)
        if common:
            with_common += 1
            for game in common:
                common_counts[game] += 1
        else:
            no_common += 1
    
    print(f"    With common games: {with_common}/20")
    print(f"    No common games:   {no_common}/20")
    print(f"\n    Most common overlaps:")
    for game, count in sorted(common_counts.items(), key=lambda x: -x[1]):
        print(f"      {game}: {count} times")
    
    if no_common > 3:
        print(f"    [!] Too many without common games - game embeddings need work")
    
    # Score distribution
    print(f"\n[E] SCORE DISTRIBUTION (TOP-20):")
    scores = [score for _, score in recommendations[:20]]
    avg_score = sum(scores) / len(scores) if scores else 0
    score_range = max(scores) - min(scores) if scores else 0
    
    print(f"    Average score: {avg_score:.2f}")
    print(f"    Score range:   {score_range:.2f}")
    print(f"    Best score:    {max(scores):.2f}")
    print(f"    Worst score:   {min(scores):.2f}")
    
    if score_range < 2:
        print(f"    [!] Low score variance - model might be underfitting")
    
    # RECOMMENDATIONS FOR IMPROVEMENT
    print(f"\n" + "="*70)
    print("RECOMMENDATIONS TO IMPROVE MODEL")
    print("="*70)
    
    print("\n1. DATA IMPROVEMENTS:")
    print(f"   - Current training size: {len(dat.interactions.positives)} positives")
    print(f"   - Positive/Negative ratio: {len(positives)}/{len(negatives)}")
    if len(positives) < 50:
        print("   [!] INCREASE training data (target: 100+ positives)")
    if len(positives) / len(negatives) < 0.2:
        print("   [!] CLASS IMBALANCE - consider sampling more positives")
    
    print("\n2. MODEL ARCHITECTURE:")
    if precision < 70:
        print("   [!] LOW PRECISION - try:")
        print("       - Increase hidden layer sizes (128,64) -> (256,128)")
        print("       - Increase embedding dimensions")
        print("       - Add more tower layers")
    if no_common > 5:
        print("   [!] GAME EMBEDDINGS WEAK - try:")
        print("       - Increase game embedding dim (16 -> 32)")
        print("       - Add game co-occurrence features")
    if in_range < 15:
        print("   [!] AGE NOT CAPTURED - try:")
        print("       - Add age-specific embedding layer")
        print("       - Increase age feature weight in input")
    
    print("\n3. TRAINING PARAMETERS (V4):")
    print(f"   - Current: epochs=100, lr=1e-3, batch=32, dropout=0.2")
    print(f"   - Game emb: 48, User emb: 64, Age emb: 16, Hidden: (256,128), Out: 64")
    print(f"   - Loss: InfoNCE (temp=0.05), Hard negatives: 50%")
    print(f"   - Age embedding: 8 bins (learnable)")
    if precision < 85:
        print("   [!] Still room for improvement - consider:")
        print("       - Increase hard negative ratio (50% -> 70%)")
        print("       - Even MORE training data (300+ -> 500+ positives)")
        print("       - Ensemble: train multiple models and average")
    
    print("\n4. MODEL ARCHITECTURE (V4):")
    print("   - Hard negative mining: selects similar users as negatives (harder learning)")
    print("   - Larger game embeddings (48-dim): better game representation")
    print("   - Lower temperature (0.05): more confident score separation")
    print("   - Age embedding: 8 bins -> 16-dim vectors")
    print("   - InfoNCE loss + Attention mechanism")
    if precision < 75:
        print("   [!] Consider increasing hard negative ratio to 70% for even harder training")
    
    print("\n" + "="*70)
    print(f"EXPERIMENT COMPLETED - Precision: {precision:.1f}%")
    print("="*70)


if __name__ == "__main__":
    main()

