#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Woman preferences V6 - IMPROVED configurations based on graph analysis.

Key improvements:
1. Age-focused learning (larger age embeddings)
2. Gender balance (no weighted sampling)
3. Optimal learning rates (5e-5, 1e-4, 2e-4)
4. Early stopping (60-80 epochs)
5. Smaller batch size (16)
"""

import random
import numpy as np
import matplotlib.pyplot as plt
from typing import List, Tuple, Dict
from models.domain import DataStore, GAMES
from training.trainer_v6 import train_model_v6_extreme
from recommendation.recommender_v6 import topk_recommend_v6


def generate_users_with_preferences(dat: DataStore, main_user_id: int, num_users: int = 600):
    """Generate users for woman 24F with specific preferences."""
    
    main_user = dat.users[main_user_id]
    main_games = set(main_user.games)
    
    print(f"\n{'='*60}")
    print(f"Generating {num_users} users for:")
    print(f"  ID: {main_user_id}")
    print(f"  Age: {main_user.age}")
    print(f"  Gender: {main_user.gender}")
    print(f"  Games: {', '.join(main_user.games)}")
    print(f"{'='*60}\n")
    
    positives = []
    negatives = []
    
    for i in range(num_users):
        age = random.randint(14, 45)
        gender = random.choice(['M', 'F'])
        num_games = random.randint(1, 4)
        games = random.sample(GAMES, num_games)
        
        user_id = dat.add_user(age, gender, games)
        
        common_games = main_games & set(games)
        has_common_game = len(common_games) > 0
        
        is_positive = False
        
        if has_common_game:
            if 17 <= age <= 30:
                if gender == 'F':
                    is_positive = True
                elif gender == 'M' and age <= 28:
                    is_positive = True
        
        if is_positive:
            dat.add_positive(main_user_id, user_id)
            positives.append(user_id)
        else:
            dat.add_negative(main_user_id, user_id)
            negatives.append(user_id)
    
    return positives, negatives


def check_woman_rules(user, main_games):
    """Check if user meets woman's preference rules."""
    common_games = main_games & set(user.games)
    has_common = len(common_games) > 0
    
    if not has_common:
        return False, "no common games"
    
    if not (17 <= user.age <= 30):
        if user.age < 17:
            return False, f"age {user.age} < 17"
        else:
            return False, f"age {user.age} > 30"
    
    if user.gender == 'M' and user.age > 28:
        return False, f"male age {user.age} > 28"
    
    return True, "passes all rules"


def evaluate_model(model, dat, main_user_id, new_user_start):
    """Evaluate model and return detailed metrics."""
    
    # Get recommendations directly from neural network
    recommendations = topk_recommend_v6(
        model, 
        dat, 
        main_user_id, 
        K=30, 
        use_rejection_filter=False
    )
    
    # Analyze only NEW users
    main_games = set(dat.users[main_user_id].games)
    new_recommendations = [(uid, score) for uid, score in recommendations if uid >= new_user_start]
    top_20_new = new_recommendations[:20]
    
    # Calculate precision
    correct = 0
    wrong = 0
    age_errors = 0
    gender_errors = 0
    game_errors = 0
    
    for user_id, score in top_20_new:
        user = dat.users[user_id]
        meets_rules, reason = check_woman_rules(user, main_games)
        
        if meets_rules:
            correct += 1
        else:
            wrong += 1
            # Categorize errors
            if 'age' in reason:
                age_errors += 1
            elif 'male' in reason:
                gender_errors += 1
            elif 'games' in reason:
                game_errors += 1
    
    precision = correct / len(top_20_new) * 100 if top_20_new else 0
    
    # Gender distribution
    females = sum(1 for uid, _ in top_20_new if dat.users[uid].gender == 'F')
    males = sum(1 for uid, _ in top_20_new if dat.users[uid].gender == 'M')
    
    # Common games
    with_common = sum(1 for uid, _ in top_20_new 
                      if len(main_games & set(dat.users[uid].games)) > 0)
    
    # Age distribution
    ages = [dat.users[uid].age for uid, _ in top_20_new]
    in_range = sum(1 for age in ages if 17 <= age <= 30)
    
    return {
        'precision': precision,
        'correct': correct,
        'wrong': wrong,
        'total': len(top_20_new),
        'females_pct': females / len(top_20_new) * 100 if top_20_new else 0,
        'males_pct': males / len(top_20_new) * 100 if top_20_new else 0,
        'common_games': with_common,
        'age_in_range': in_range,
        'avg_age': np.mean(ages) if ages else 0,
        'age_errors': age_errors,
        'gender_errors': gender_errors,
        'game_errors': game_errors
    }


def train_with_logging(dat, config, log_fn=None):
    """Train model and capture loss history."""
    
    losses = {'total': [], 'main': [], 'rejection': [], 'intersection': []}
    
    def custom_log(msg):
        if 'Total:' in msg:
            parts = msg.split('|')
            for part in parts:
                if 'Total:' in part:
                    losses['total'].append(float(part.split(':')[1].strip()))
                elif 'Main:' in part:
                    losses['main'].append(float(part.split(':')[1].strip()))
                elif 'Rej:' in part:
                    losses['rejection'].append(float(part.split(':')[1].strip()))
                elif 'Inter:' in part:
                    losses['intersection'].append(float(part.split(':')[1].strip()))
        if log_fn:
            log_fn(msg)
    
    model = train_model_v6_extreme(
        dat,
        epochs=config['epochs'],
        lr=config['lr'],
        batch_size=config['batch_size'],
        log_fn=custom_log,
        dropout=config['dropout'],
        use_scheduler=config['use_scheduler'],
        focal_gamma=config['focal_gamma'],
        rejection_weight=config['rejection_weight'],
        intersection_weight=config['intersection_weight'],
        use_weighted_sampling=config['use_weighted_sampling'],
        emb_age_dim=config.get('emb_age_dim', 16)
    )
    
    return model, losses


def plot_improved_results(results: Dict, save_path: str = 'woman_v6_improved.png'):
    """Plot results with error breakdown."""
    
    fig, axes = plt.subplots(2, 3, figsize=(18, 10))
    fig.suptitle('Improved Configurations Analysis', fontsize=16, fontweight='bold')
    
    config_names = list(results.keys())
    
    # Plot 1: Precision Comparison
    ax = axes[0, 0]
    precisions = [results[name]['metrics']['precision'] for name in config_names]
    colors = ['gold' if p == max(precisions) else 'green' if p >= 80 else 'orange' if p >= 60 else 'red' 
              for p in precisions]
    bars = ax.bar(range(len(config_names)), precisions, color=colors, alpha=0.7)
    ax.set_xticks(range(len(config_names)))
    ax.set_xticklabels(config_names, rotation=45, ha='right', fontsize=9)
    ax.set_ylabel('Precision (%)')
    ax.set_title('Precision by Configuration')
    ax.axhline(y=80, color='green', linestyle='--', alpha=0.5, label='Target: 80%')
    ax.legend()
    ax.grid(True, alpha=0.3, axis='y')
    
    for i, (bar, val) in enumerate(zip(bars, precisions)):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{val:.1f}%', ha='center', va='bottom', fontweight='bold', fontsize=9)
    
    # Plot 2: Error Breakdown
    ax = axes[0, 1]
    age_errors = [results[name]['metrics']['age_errors'] for name in config_names]
    gender_errors = [results[name]['metrics']['gender_errors'] for name in config_names]
    game_errors = [results[name]['metrics']['game_errors'] for name in config_names]
    
    x = np.arange(len(config_names))
    width = 0.25
    ax.bar(x - width, age_errors, width, label='Age Errors', color='red', alpha=0.7)
    ax.bar(x, gender_errors, width, label='Gender Errors', color='blue', alpha=0.7)
    ax.bar(x + width, game_errors, width, label='Game Errors', color='green', alpha=0.7)
    
    ax.set_xticks(x)
    ax.set_xticklabels(config_names, rotation=45, ha='right', fontsize=9)
    ax.set_ylabel('Error Count (out of 20)')
    ax.set_title('Error Type Breakdown')
    ax.legend()
    ax.grid(True, alpha=0.3, axis='y')
    
    # Plot 3: Loss Convergence
    ax = axes[0, 2]
    for config_name, data in results.items():
        losses = data['losses']['total']
        epochs = range(1, len(losses) + 1)
        ax.plot(epochs, losses, label=config_name, linewidth=2, marker='o', 
                markersize=2, markevery=max(1, len(losses)//10))
    
    ax.set_xlabel('Epoch')
    ax.set_ylabel('Total Loss')
    ax.set_title('Loss Convergence')
    ax.legend(fontsize=8)
    ax.grid(True, alpha=0.3)
    
    # Plot 4: Gender Balance
    ax = axes[1, 0]
    females = [results[name]['metrics']['females_pct'] for name in config_names]
    males = [results[name]['metrics']['males_pct'] for name in config_names]
    
    x = np.arange(len(config_names))
    width = 0.35
    ax.bar(x - width/2, females, width, label='Female %', color='pink', alpha=0.7)
    ax.bar(x + width/2, males, width, label='Male %', color='lightblue', alpha=0.7)
    ax.axhline(y=50, color='black', linestyle='--', alpha=0.5, label='Ideal: 50%')
    
    ax.set_xticks(x)
    ax.set_xticklabels(config_names, rotation=45, ha='right', fontsize=9)
    ax.set_ylabel('Percentage')
    ax.set_title('Gender Distribution')
    ax.legend()
    ax.grid(True, alpha=0.3, axis='y')
    
    # Plot 5: Age Accuracy
    ax = axes[1, 1]
    age_in_range = [results[name]['metrics']['age_in_range'] for name in config_names]
    age_accuracy = [x/20*100 for x in age_in_range]
    
    bars = ax.bar(range(len(config_names)), age_accuracy, 
                   color=['green' if x >= 85 else 'orange' if x >= 70 else 'red' for x in age_accuracy],
                   alpha=0.7)
    ax.set_xticks(range(len(config_names)))
    ax.set_xticklabels(config_names, rotation=45, ha='right', fontsize=9)
    ax.set_ylabel('Age Accuracy (%)')
    ax.set_title('Age Range Accuracy (17-30)')
    ax.axhline(y=85, color='green', linestyle='--', alpha=0.5, label='Target: 85%')
    ax.legend()
    ax.grid(True, alpha=0.3, axis='y')
    
    for i, (bar, val) in enumerate(zip(bars, age_accuracy)):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{val:.0f}%', ha='center', va='bottom', fontweight='bold', fontsize=9)
    
    # Plot 6: Overall Score
    ax = axes[1, 2]
    scores = []
    for name in config_names:
        m = results[name]['metrics']
        # Weighted score: precision 50%, age accuracy 30%, gender balance 20%
        gender_balance_score = 100 - abs(m['females_pct'] - 50) * 2  # Penalty for imbalance
        score = (m['precision'] * 0.5 + 
                 (m['age_in_range']/20 * 100) * 0.3 + 
                 gender_balance_score * 0.2)
        scores.append(score)
    
    colors = ['gold' if s == max(scores) else 'silver' if s == sorted(scores, reverse=True)[1] 
              else 'lightgray' for s in scores]
    bars = ax.bar(range(len(config_names)), scores, color=colors, alpha=0.7)
    ax.set_xticks(range(len(config_names)))
    ax.set_xticklabels(config_names, rotation=45, ha='right', fontsize=9)
    ax.set_ylabel('Overall Score')
    ax.set_title('Overall Score (Weighted)')
    ax.grid(True, alpha=0.3, axis='y')
    
    for i, (bar, score) in enumerate(zip(bars, scores)):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{score:.1f}', ha='center', va='bottom', fontweight='bold', fontsize=9)
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"\n[SAVED] Improved results: {save_path}")
    plt.close()


def main():
    print("="*70)
    print("V6 EXTREME: Woman Preferences - IMPROVED Configurations")
    print("Based on graph analysis and identified issues")
    print("="*70)
    
    # Define IMPROVED configurations based on analysis
    configs = {
        'Best from Previous (LR 1e-4)': {
            'epochs': 100,
            'lr': 1e-4,
            'batch_size': 32,
            'dropout': 0.3,
            'use_scheduler': True,
            'focal_gamma': 2.0,
            'rejection_weight': 0.5,
            'intersection_weight': 0.3,
            'use_weighted_sampling': True,
            'emb_age_dim': 16
        },
        'Age-Focused (emb_age=32)': {
            'epochs': 80,
            'lr': 1e-4,
            'batch_size': 16,
            'dropout': 0.3,
            'use_scheduler': True,
            'focal_gamma': 2.0,
            'rejection_weight': 0.5,
            'intersection_weight': 0.3,
            'use_weighted_sampling': True,
            'emb_age_dim': 32  # INCREASED!
        },
        'Gender-Balanced (no weighted)': {
            'epochs': 80,
            'lr': 1e-4,
            'batch_size': 16,
            'dropout': 0.3,
            'use_scheduler': True,
            'focal_gamma': 2.0,
            'rejection_weight': 0.5,
            'intersection_weight': 0.3,
            'use_weighted_sampling': False,  # DISABLED!
            'emb_age_dim': 24
        },
        'Slower LR (5e-5)': {
            'epochs': 80,
            'lr': 5e-5,  # SLOWER!
            'batch_size': 16,
            'dropout': 0.3,
            'use_scheduler': True,
            'focal_gamma': 2.0,
            'rejection_weight': 0.5,
            'intersection_weight': 0.3,
            'use_weighted_sampling': False,
            'emb_age_dim': 24
        },
        'Optimal Combo': {
            'epochs': 80,
            'lr': 1e-4,
            'batch_size': 16,
            'dropout': 0.3,
            'use_scheduler': True,
            'focal_gamma': 2.0,
            'rejection_weight': 0.5,
            'intersection_weight': 0.3,
            'use_weighted_sampling': False,
            'emb_age_dim': 32  # Best of all improvements
        }
    }
    
    results = {}
    
    # Run each configuration
    for config_name, config in configs.items():
        print(f"\n{'='*70}")
        print(f"CONFIGURATION: {config_name}")
        print(f"{'='*70}")
        
        for key, value in config.items():
            print(f"  {key}: {value}")
        
        # Create fresh data for each config
        dat = DataStore()
        main_user_id = dat.add_user(
            age=24,
            gender='F',
            games=['overwatch2', 'minecraft', 'cs2']
        )
        
        print(f"\n1. Generating 600 training users...")
        positives, negatives = generate_users_with_preferences(dat, main_user_id, num_users=600)
        print(f"   [+] Positives: {len(positives)}")
        print(f"   [-] Negatives: {len(negatives)}")
        
        # Add test users
        print(f"\n2. Adding 1000 test users...")
        new_user_start = len(dat.users)
        for i in range(1000):
            age = random.randint(15, 40)
            gender = random.choice(['M', 'F'])
            num_games = random.randint(1, 3)
            games = random.sample(GAMES, num_games)
            dat.add_user(age, gender, games)
        
        # Train model
        print(f"\n3. Training with {config_name}...")
        model, losses = train_with_logging(
            dat, 
            config, 
            log_fn=lambda msg: print(f"   {msg}") if 'Epoch' in msg and 
                   (int(msg.split()[1]) % 10 == 0 or int(msg.split()[1]) <= 5) else None
        )
        
        # Evaluate
        print(f"\n4. Evaluating...")
        metrics = evaluate_model(model, dat, main_user_id, new_user_start)
        
        print(f"\n   RESULTS:")
        print(f"   Precision: {metrics['precision']:.1f}% ({metrics['correct']}/{metrics['total']})")
        print(f"   Gender: {metrics['females_pct']:.0f}% F / {metrics['males_pct']:.0f}% M")
        print(f"   Age accuracy: {metrics['age_in_range']}/20 ({metrics['age_in_range']/20*100:.0f}%)")
        print(f"   Errors: Age={metrics['age_errors']}, Gender={metrics['gender_errors']}, Games={metrics['game_errors']}")
        
        # Store results
        results[config_name] = {
            'config': config,
            'losses': losses,
            'metrics': metrics
        }
    
    # Generate visualizations
    print(f"\n{'='*70}")
    print("GENERATING VISUALIZATIONS")
    print(f"{'='*70}")
    
    plot_improved_results(results, 'woman_v6_improved.png')
    
    # Summary table
    print(f"\n{'='*70}")
    print("SUMMARY TABLE")
    print(f"{'='*70}\n")
    
    print(f"{'Configuration':<30} {'Precision':<12} {'Age Acc':<10} {'Gender Bal':<12} {'Score':<8}")
    print(f"{'-'*90}")
    
    for config_name in results.keys():
        m = results[config_name]['metrics']
        age_acc = m['age_in_range']/20*100
        gender_balance = 100 - abs(m['females_pct'] - 50) * 2
        score = (m['precision'] * 0.5 + age_acc * 0.3 + gender_balance * 0.2)
        
        print(f"{config_name:<30} {m['precision']:>6.1f}%      {age_acc:>5.0f}%     "
              f"{gender_balance:>6.1f}%      {score:>6.1f}")
    
    # Best configuration
    best_config = max(results.keys(), 
                      key=lambda k: results[k]['metrics']['precision'])
    
    print(f"\n{'='*70}")
    print(f"BEST PRECISION: {best_config}")
    print(f"Precision: {results[best_config]['metrics']['precision']:.1f}%")
    
    # Best overall score
    best_overall = max(results.keys(),
                      key=lambda k: (results[k]['metrics']['precision'] * 0.5 +
                                    results[k]['metrics']['age_in_range']/20*100 * 0.3 +
                                    (100 - abs(results[k]['metrics']['females_pct'] - 50) * 2) * 0.2))
    
    print(f"\nBEST OVERALL: {best_overall}")
    print(f"Precision: {results[best_overall]['metrics']['precision']:.1f}%")
    print(f"Age Accuracy: {results[best_overall]['metrics']['age_in_range']}/20")
    print(f"Gender: {results[best_overall]['metrics']['females_pct']:.0f}% F / "
          f"{results[best_overall]['metrics']['males_pct']:.0f}% M")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()

