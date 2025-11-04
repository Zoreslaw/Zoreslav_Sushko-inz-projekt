#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COMPLEX SCENARIO: Elite competitive team finder

Main user: 19-year-old female streamer with very specific requirements.

Profile:
- Age: 19F
- Games: cs2, valorant, overwatch2, apex (competitive FPS player)
- Streams regularly, looking for teammates

COMPLEX PREFERENCE RULES:

1. GENDER & AGE RULES (different criteria for men/women):
   - MEN: age 18-25 ONLY
   - WOMEN: age 17-28 ONLY

2. GAME REQUIREMENTS (complex multi-game logic):
   For MEN:
   - MUST have at least 2 common FPS games (cs2, valorant, overwatch2, apex)
   - BONUS: if they play cs2 AND valorant together
   - REJECTED: if they play fortnite (too casual)
   
   For WOMEN:
   - MUST have at least 1 common FPS game
   - NO restrictions on other games

3. PLAYSTYLE COMPATIBILITY (simulated by secondary games):
   - POSITIVE: players who have minecraft or rocketleague (chill/fun)
   - NEGATIVE: players who have dota2 or lol (toxic community stereotype)
   - NEUTRAL: other games

4. SPECIAL REJECTION RULES:
   - MEN with rust or gta5rp: REJECTED (toxic/RP games)
   - Anyone with ONLY casual games (fortnite, minecraft): REJECTED
   - Anyone under 17 or over 30: REJECTED

5. SCORING PRIORITIES:
   - Women with cs2/valorant: HIGH priority
   - Men with 3+ common FPS: HIGH priority
   - Anyone with phasmophobia: MEDIUM bonus (fun co-op)
   - Anyone with battlefield1: MEDIUM bonus (tactical FPS)

This scenario tests:
- Multi-condition logic
- Gender-specific rules
- Complex game combinations
- Positive/negative/rejection tiers
- Edge cases and conflicts
"""

import random
from models.domain import DataStore, GAMES
from training.trainer_v6 import train_model_v6_extreme
from recommendation.recommender_v6 import topk_recommend_v6
from recommendation.rule_based_filter import apply_hybrid_filtering


def generate_complex_users(dat: DataStore, main_user_id: int, num_users: int = 800):
    """
    Generates users with complex preference logic.
    
    Main user: 19F, [cs2, valorant, overwatch2, apex]
    """
    
    main_user = dat.users[main_user_id]
    main_games = set(main_user.games)  # {cs2, valorant, overwatch2, apex}
    
    # Define game categories
    competitive_fps = {'cs2', 'valorant', 'overwatch2', 'apex'}
    casual_games = {'fortnite', 'minecraft'}
    toxic_moba = {'dota2', 'lol'}
    toxic_other = {'rust', 'gta5rp'}
    bonus_games = {'phasmophobia', 'battlefield1', 'rocketleague'}
    
    print(f"\n{'='*70}")
    print(f"Generating {num_users} users with COMPLEX preference rules")
    print(f"{'='*70}")
    print(f"Main user: {main_user.age}{main_user.gender}, games: {', '.join(main_user.games)}")
    print(f"\nComplex rules:")
    print(f"  1. Age: Men 18-25, Women 17-28")
    print(f"  2. Games for MEN: 2+ common FPS, NO fortnite, NO rust/gta5rp")
    print(f"  3. Games for WOMEN: 1+ common FPS")
    print(f"  4. Playstyle: BONUS for minecraft/rocketleague/phasmophobia")
    print(f"  5. Playstyle: PENALTY for dota2/lol")
    print(f"{'='*70}\n")
    
    positives = []
    negatives = []
    
    stats = {
        'men_accepted': 0,
        'women_accepted': 0,
        'age_rejected': 0,
        'game_rejected_men': 0,
        'toxic_game_rejected': 0,
        'casual_only_rejected': 0,
    }
    
    # Generate diverse users
    for i in range(num_users):
        # Random characteristics
        age = random.randint(14, 35)  # Wide range to test boundaries
        gender = random.choice(['M', 'F'])
        
        # Random set of games (1-5 games for variety)
        num_games = random.randint(1, 5)
        games = random.sample(GAMES, num_games)
        games_set = set(games)
        
        # Add user
        user_id = dat.add_user(age, gender, games)
        
        # Calculate game overlaps
        common_fps = competitive_fps & games_set & main_games
        has_fortnite = 'fortnite' in games_set
        has_toxic_other = bool(toxic_other & games_set)
        has_toxic_moba = bool(toxic_moba & games_set)
        has_bonus = bool(bonus_games & games_set)
        only_casual = games_set.issubset(casual_games | {'pubg'})
        
        # Apply complex rules
        is_positive = False
        reason = ""
        
        # RULE 1: Age boundaries
        if gender == 'M':
            if not (18 <= age <= 25):
                negatives.append((user_id, f"M {age} - age out of range (18-25)"))
                stats['age_rejected'] += 1
                continue
        else:  # F
            if not (17 <= age <= 28):
                negatives.append((user_id, f"F {age} - age out of range (17-28)"))
                stats['age_rejected'] += 1
                continue
        
        # RULE 2: Reject casual-only players
        if only_casual:
            negatives.append((user_id, f"{gender} {age} - only casual games"))
            stats['casual_only_rejected'] += 1
            continue
        
        # RULE 3: Gender-specific game requirements
        if gender == 'M':
            # Men: strict requirements
            
            # Check toxic games first
            if has_toxic_other:
                negatives.append((user_id, f"M {age} - has toxic games (rust/gta5rp)"))
                stats['toxic_game_rejected'] += 1
                continue
            
            # Check fortnite
            if has_fortnite:
                negatives.append((user_id, f"M {age} - has fortnite (too casual)"))
                stats['game_rejected_men'] += 1
                continue
            
            # Must have 2+ common FPS games
            if len(common_fps) >= 2:
                is_positive = True
                priority = "HIGH" if len(common_fps) >= 3 else "NORMAL"
                bonus_str = ""
                if has_bonus:
                    bonus_str = " + bonus games"
                if has_toxic_moba:
                    bonus_str += " (but has toxic MOBA)"
                
                reason = f"M {age}, {len(common_fps)} common FPS: {', '.join(common_fps)} [{priority}]{bonus_str}"
                stats['men_accepted'] += 1
            else:
                negatives.append((user_id, f"M {age} - only {len(common_fps)} common FPS (need 2+)"))
                stats['game_rejected_men'] += 1
                continue
        
        else:  # F
            # Women: more relaxed requirements
            
            # Must have at least 1 common FPS game
            if len(common_fps) >= 1:
                is_positive = True
                priority = "HIGH" if len(common_fps) >= 2 else "NORMAL"
                bonus_str = ""
                if has_bonus:
                    bonus_str = " + bonus games"
                if has_toxic_moba:
                    bonus_str += " (has toxic MOBA)"
                
                reason = f"F {age}, {len(common_fps)} common FPS: {', '.join(common_fps)} [{priority}]{bonus_str}"
                stats['women_accepted'] += 1
            else:
                negatives.append((user_id, f"F {age} - no common FPS games"))
                continue
        
        # Add interaction
        if is_positive:
            dat.add_positive(main_user_id, user_id)
            positives.append((user_id, reason))
        
    return positives, negatives, stats


def check_complex_rules(user, main_games):
    """
    Check if a user meets complex preference rules.
    Returns (meets_rules, reason)
    """
    competitive_fps = {'cs2', 'valorant', 'overwatch2', 'apex'}
    casual_games = {'fortnite', 'minecraft'}
    toxic_other = {'rust', 'gta5rp'}
    
    games_set = set(user.games)
    common_fps = competitive_fps & games_set & main_games
    has_fortnite = 'fortnite' in games_set
    has_toxic_other = bool(toxic_other & games_set)
    only_casual = games_set.issubset(casual_games | {'pubg'})
    
    # Age check
    if user.gender == 'M':
        if not (18 <= user.age <= 25):
            return False, f"male age {user.age} out of range (18-25)"
    else:  # F
        if not (17 <= user.age <= 28):
            return False, f"female age {user.age} out of range (17-28)"
    
    # Casual-only check
    if only_casual:
        return False, "only casual games"
    
    # Gender-specific game rules
    if user.gender == 'M':
        if has_toxic_other:
            return False, "has toxic games (rust/gta5rp)"
        if has_fortnite:
            return False, "has fortnite (too casual)"
        if len(common_fps) < 2:
            return False, f"only {len(common_fps)} common FPS (need 2+)"
    else:  # F
        if len(common_fps) < 1:
            return False, "no common FPS games"
    
    return True, "meets all criteria"


def main():
    print("="*70)
    print("COMPLEX SCENARIO: Elite Competitive Team Finder")
    print("="*70)
    
    # 1. Create main user
    print("\n1. Creating main user (elite competitive FPS player)...")
    dat = DataStore()
    main_user_id = dat.add_user(
        age=19,
        gender='F',
        games=['cs2', 'valorant', 'overwatch2', 'apex']
    )
    main_games = set(dat.users[main_user_id].games)
    print(f"   [OK] Created user ID={main_user_id}: 19F, competitive FPS player")
    print(f"   Games: {', '.join(dat.users[main_user_id].games)}")
    
    # 2. Generate users with complex rules
    print("\n2. Generating 800 users with COMPLEX preference rules...")
    positives, negatives, stats = generate_complex_users(dat, main_user_id, num_users=800)
    
    print(f"\n   GENERATION STATISTICS:")
    print(f"   {'='*66}")
    print(f"   [+] Total POSITIVES: {len(positives)}")
    print(f"       - Men accepted: {stats['men_accepted']}")
    print(f"       - Women accepted: {stats['women_accepted']}")
    print(f"   [-] Total NEGATIVES: {len(negatives)}")
    print(f"       - Age rejected: {stats['age_rejected']}")
    print(f"       - Men game rejected: {stats['game_rejected_men']}")
    print(f"       - Toxic games rejected: {stats['toxic_game_rejected']}")
    print(f"       - Casual-only rejected: {stats['casual_only_rejected']}")
    print(f"   [TOTAL] Users: {len(dat.users)}")
    print(f"   {'='*66}")
    
    # Show examples
    print(f"\n   Examples of HIGH-PRIORITY POSITIVES:")
    high_priority = [p for p in positives if 'HIGH' in p[1]]
    for user_id, reason in high_priority[:5]:
        print(f"     [+] ID {user_id}: {reason}")
    
    print(f"\n   Examples of NORMAL POSITIVES:")
    normal_priority = [p for p in positives if 'NORMAL' in p[1]]
    for user_id, reason in normal_priority[:5]:
        print(f"     [+] ID {user_id}: {reason}")
    
    print(f"\n   Examples of NEGATIVE rejections:")
    for user_id, reason in negatives[:8]:
        print(f"     [-] ID {user_id}: {reason}")
    
    # 2.5. Add new random users BEFORE training
    print("\n2.5. Adding 1000 random new users (for testing)...")
    new_user_start = len(dat.users)
    
    for i in range(1000):
        age = random.randint(15, 35)
        gender = random.choice(['M', 'F'])
        num_games = random.randint(1, 4)
        games = random.sample(GAMES, num_games)
        dat.add_user(age, gender, games)
    
    print(f"   [OK] Added users: {new_user_start} -> {len(dat.users)}")
    print(f"   [!] These users did NOT participate in training (no interactions)")
    
    # 3. Train model with V6 EXTREME
    print(f"\n3. Training V6 EXTREME model...")
    print(f"   Training on {len(positives)} positives with EXTREME complex rules")
    print("   V6 EXTREME improvements:")
    print("     - Multi-hot game encoding (precise combinations)")
    print("     - Gender-conditioned game processing")
    print("     - Rejection-aware embeddings (toxic games)")
    print("     - Explicit intersection features (2+, 3+ FPS)")
    print("     - Focal InfoNCE loss (class imbalance)")
    print("     - Rejection constraint loss (hard rules)")
    print("     - Intersection matching loss (game overlaps)")
    print("     - Weighted sampling (rare male positives)")
    print("     - Large architecture: (512->256->128)")
    print("     - 128-dim output embeddings")
    print("   (this will take ~3-5 minutes)\n")
    
    model = train_model_v6_extreme(
        dat,
        epochs=150,  # More epochs for extreme complexity
        lr=3e-4,  # Lower LR for stability
        batch_size=32,
        log_fn=lambda msg: print(f"   {msg}"),
        dropout=0.3,
        use_scheduler=True,
        focal_gamma=2.0,  # Strong focus on hard examples
        rejection_weight=0.5,  # Strong rejection constraint
        intersection_weight=0.3,  # Strong intersection matching
        use_weighted_sampling=True  # Oversample rare male positives
    )
    
    print("\n   [OK] Training completed!")
    
    # 4. Get recommendations from 1000 new users
    print("\n4. Getting TOP-30 recommendations (HYBRID APPROACH: Neural + Rules)...")
    print("="*70)
    
    # Step 1: Get top-300 from neural network (need more to find valid ones)
    print("   Step 1: Neural network ranking (top-300)...")
    raw_recommendations = topk_recommend_v6(
        model, dat, main_user_id, K=300,
        use_rejection_filter=False,  # Disable neural filter, use rule-based only
        rejection_threshold=0.5
    )
    
    # Step 2: Apply rule-based filtering
    print("   Step 2: Applying hard rule-based filters...")
    recommendations = apply_hybrid_filtering(
        raw_recommendations,
        dat.users[main_user_id],
        dat,
        K=30
    )
    print(f"   [OK] {len(recommendations)} valid recommendations after filtering\n")
    
    print(f"\nTOP-30 recommendations for user {main_user_id} (19F, elite competitive FPS):\n")
    
    for rank, (user_id, score) in enumerate(recommendations, 1):
        user = dat.users[user_id]
        games_str = ', '.join(user.games)
        
        # Check if training user
        was_positive = (main_user_id, user_id) in dat.interactions.positives
        was_negative = (main_user_id, user_id) in dat.interactions.negatives
        
        label = ""
        if was_positive:
            label = " [+] [TRAIN]"
        elif was_negative:
            label = " [-] [TRAIN]"
        else:
            label = " [*] [NEW]"
        
        # Analyze games
        competitive_fps = {'cs2', 'valorant', 'overwatch2', 'apex'}
        common_fps = competitive_fps & set(user.games) & main_games
        
        game_analysis = ""
        if len(common_fps) >= 3:
            game_analysis = f" [ELITE: {len(common_fps)} FPS!]"
        elif len(common_fps) >= 2:
            game_analysis = f" [GOOD: {len(common_fps)} FPS]"
        elif len(common_fps) == 1:
            game_analysis = f" [OK: {list(common_fps)[0]}]"
        else:
            game_analysis = " [NO common FPS!]"
        
        print(f"  #{rank:2d}. ID {user_id:4d} | {user.gender} {user.age:2d}y | "
              f"Score: {score:+.3f} | {games_str}{game_analysis}{label}")
    
    # 5. DETAILED ANALYSIS
    print("\n" + "="*70)
    print("COMPLEX SCENARIO ANALYSIS")
    print("="*70)
    
    # Analyze only NEW users
    new_recommendations = [(uid, score) for uid, score in recommendations if uid >= new_user_start]
    top_30_new = new_recommendations[:30]
    
    print(f"\n[A] TOP-30 FROM NEW USERS (1000 candidates):")
    print(f"    Total new users in recommendations: {len(new_recommendations)}")
    
    # Check complex rules
    correct_by_rules = 0
    wrong_by_rules = 0
    error_details = []
    
    for user_id, score in top_30_new:
        user = dat.users[user_id]
        meets_rules, reason = check_complex_rules(user, main_games)
        
        if meets_rules:
            correct_by_rules += 1
        else:
            wrong_by_rules += 1
            error_details.append((user_id, user.gender, user.age, ', '.join(user.games), reason))
    
    precision = correct_by_rules / len(top_30_new) * 100 if top_30_new else 0
    
    print(f"\n    Precision (meets ALL complex rules): {correct_by_rules}/{len(top_30_new)} = {precision:.1f}%")
    print(f"    Errors (violates rules): {wrong_by_rules}/{len(top_30_new)}")
    
    if error_details:
        print(f"\n    Error details (rule violations):")
        for uid, gender, age, games, reason in error_details[:10]:
            print(f"      - ID {uid}: {gender} {age}y, {games} -> {reason}")
    
    # Gender distribution
    print(f"\n[B] GENDER DISTRIBUTION (TOP-30 new users):")
    females_new = sum(1 for uid, _ in top_30_new if dat.users[uid].gender == 'F')
    males_new = sum(1 for uid, _ in top_30_new if dat.users[uid].gender == 'M')
    
    print(f"    Females: {females_new}/30 ({females_new/30*100:.0f}%)")
    print(f"    Males:   {males_new}/30 ({males_new/30*100:.0f}%)")
    
    # Age distribution by gender
    print(f"\n[C] AGE DISTRIBUTION BY GENDER (TOP-30 new users):")
    male_ages = [dat.users[uid].age for uid, _ in top_30_new if dat.users[uid].gender == 'M']
    female_ages = [dat.users[uid].age for uid, _ in top_30_new if dat.users[uid].gender == 'F']
    
    if male_ages:
        males_in_range = sum(1 for age in male_ages if 18 <= age <= 25)
        print(f"    Males: age range {min(male_ages)}-{max(male_ages)}, "
              f"in correct range (18-25): {males_in_range}/{len(male_ages)}")
    
    if female_ages:
        females_in_range = sum(1 for age in female_ages if 17 <= age <= 28)
        print(f"    Females: age range {min(female_ages)}-{max(female_ages)}, "
              f"in correct range (17-28): {females_in_range}/{len(female_ages)}")
    
    # Complex game analysis
    print(f"\n[D] COMPLEX GAME REQUIREMENTS (TOP-30 new users):")
    
    competitive_fps = {'cs2', 'valorant', 'overwatch2', 'apex'}
    toxic_games = {'rust', 'gta5rp', 'fortnite'}  # For men
    bonus_games = {'phasmophobia', 'battlefield1', 'rocketleague', 'minecraft'}
    
    # Men analysis
    print(f"\n    MEN ANALYSIS ({males_new} total):")
    men_2plus_fps = 0
    men_3plus_fps = 0
    men_with_toxic = 0
    men_with_bonus = 0
    
    for uid, _ in top_30_new:
        user = dat.users[uid]
        if user.gender == 'M':
            common_fps = competitive_fps & set(user.games) & main_games
            has_toxic = bool(toxic_games & set(user.games))
            has_bonus = bool(bonus_games & set(user.games))
            
            if len(common_fps) >= 2:
                men_2plus_fps += 1
            if len(common_fps) >= 3:
                men_3plus_fps += 1
            if has_toxic:
                men_with_toxic += 1
            if has_bonus:
                men_with_bonus += 1
    
    if males_new > 0:
        print(f"      - With 2+ common FPS: {men_2plus_fps}/{males_new}")
        print(f"      - With 3+ common FPS (ELITE): {men_3plus_fps}/{males_new}")
        print(f"      - With toxic games: {men_with_toxic}/{males_new}")
        print(f"      - With bonus games: {men_with_bonus}/{males_new}")
    
    # Women analysis
    print(f"\n    WOMEN ANALYSIS ({females_new} total):")
    women_1plus_fps = 0
    women_2plus_fps = 0
    women_with_bonus = 0
    
    for uid, _ in top_30_new:
        user = dat.users[uid]
        if user.gender == 'F':
            common_fps = competitive_fps & set(user.games) & main_games
            has_bonus = bool(bonus_games & set(user.games))
            
            if len(common_fps) >= 1:
                women_1plus_fps += 1
            if len(common_fps) >= 2:
                women_2plus_fps += 1
            if has_bonus:
                women_with_bonus += 1
    
    if females_new > 0:
        print(f"      - With 1+ common FPS: {women_1plus_fps}/{females_new}")
        print(f"      - With 2+ common FPS (HIGH): {women_2plus_fps}/{females_new}")
        print(f"      - With bonus games: {women_with_bonus}/{females_new}")
    
    # Score distribution
    print(f"\n[E] SCORE DISTRIBUTION (TOP-30):")
    scores = [score for _, score in top_30_new]
    if scores:
        avg_score = sum(scores) / len(scores)
        score_range = max(scores) - min(scores)
        
        print(f"    Average score: {avg_score:.2f}")
        print(f"    Score range:   {score_range:.2f}")
        print(f"    Best score:    {max(scores):.2f}")
        print(f"    Worst score:   {min(scores):.2f}")
        
        if score_range > 1.0:
            print(f"    [OK] Good score variance - model distinguishes well")
        else:
            print(f"    [!] Low score variance - model might need tuning")
    
    # 6. SUMMARY
    print("\n" + "="*70)
    print("SCENARIO DIFFICULTY ASSESSMENT")
    print("="*70)
    
    complexity_score = 0
    max_score = 10
    
    print(f"\nComplexity factors:")
    print(f"  1. Multiple age ranges by gender: +1")
    complexity_score += 1
    
    print(f"  2. Different game requirements by gender: +2")
    complexity_score += 2
    
    print(f"  3. Multi-game combinations (2+ FPS for men): +2")
    complexity_score += 2
    
    print(f"  4. Rejection rules (toxic games, casual-only): +2")
    complexity_score += 2
    
    print(f"  5. Bonus/penalty secondary games: +1")
    complexity_score += 1
    
    print(f"  6. High training data (800 users): +1")
    complexity_score += 1
    
    print(f"  7. Large test set (1000 users): +1")
    complexity_score += 1
    
    print(f"\n  TOTAL COMPLEXITY: {complexity_score}/{max_score}")
    
    if complexity_score >= 8:
        difficulty = "EXTREME"
    elif complexity_score >= 6:
        difficulty = "HARD"
    elif complexity_score >= 4:
        difficulty = "MEDIUM"
    else:
        difficulty = "EASY"
    
    print(f"  DIFFICULTY RATING: {difficulty}")
    
    print("\n" + "="*70)
    print(f"EXPERIMENT COMPLETED - Precision: {precision:.1f}%")
    print(f"Complexity: {complexity_score}/10 ({difficulty})")
    print("="*70)


if __name__ == "__main__":
    main()

