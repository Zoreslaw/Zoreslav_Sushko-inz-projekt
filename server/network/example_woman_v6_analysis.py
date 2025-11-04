#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Woman preferences test with V6 EXTREME + Hyperparameter Analysis.

Tests multiple configurations and generates visualizations to understand:
- Overfitting vs underfitting
- Loss dynamics
- Precision by parameter
- Training stability
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
        reason = ""
        
        if has_common_game:
            if 17 <= age <= 30:
                if gender == 'F':
                    is_positive = True
                    reason = f"F {age}, common games: {', '.join(common_games)}"
                elif gender == 'M' and age <= 28:
                    is_positive = True
                    reason = f"M {age}, common games: {', '.join(common_games)}"
                else:
                    reason = f"M {age} - too old (>28)"
            else:
                if age < 17:
                    reason = f"{gender} {age} - too young (<17)"
                else:
                    reason = f"{gender} {age} - too old (>30)"
        else:
            reason = f"{gender} {age}, no common games"
        
        if is_positive:
            dat.add_positive(main_user_id, user_id)
            positives.append((user_id, reason))
        else:
            dat.add_negative(main_user_id, user_id)
            negatives.append((user_id, reason))
    
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
    """Evaluate model and return metrics."""
    
    # Get recommendations directly from neural network (NO rule-based filtering!)
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
    
    for user_id, score in top_20_new:
        user = dat.users[user_id]
        meets_rules, _ = check_woman_rules(user, main_games)
        if meets_rules:
            correct += 1
        else:
            wrong += 1
    
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
        'avg_age': np.mean(ages) if ages else 0
    }


def train_with_logging(dat, config, log_fn=None):
    """Train model and capture loss history."""
    
    losses = {'total': [], 'main': [], 'rejection': [], 'intersection': []}
    
    def custom_log(msg):
        # Parse loss values from log message
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
        use_weighted_sampling=config['use_weighted_sampling']
    )
    
    return model, losses


def plot_loss_curves(results: Dict, save_path: str = 'loss_curves.png'):
    """Plot loss curves for different configurations."""
    
    fig, axes = plt.subplots(2, 2, figsize=(15, 12))
    fig.suptitle('Training Loss Analysis', fontsize=16, fontweight='bold')
    
    # Plot 1: Total Loss by Epochs
    ax = axes[0, 0]
    for config_name, data in results.items():
        losses = data['losses']['total']
        epochs = range(1, len(losses) + 1)
        ax.plot(epochs, losses, label=config_name, linewidth=2)
    
    ax.set_xlabel('Epoch')
    ax.set_ylabel('Total Loss')
    ax.set_title('Total Loss by Configuration')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    # Plot 2: Loss Components (for first config)
    ax = axes[0, 1]
    first_config = list(results.keys())[0]
    losses = results[first_config]['losses']
    epochs = range(1, len(losses['total']) + 1)
    
    ax.plot(epochs, losses['main'], label='Main (InfoNCE)', linewidth=2)
    ax.plot(epochs, losses['rejection'], label='Rejection', linewidth=2)
    ax.plot(epochs, losses['intersection'], label='Intersection', linewidth=2)
    ax.plot(epochs, losses['total'], label='Total', linewidth=2, linestyle='--', color='black')
    
    ax.set_xlabel('Epoch')
    ax.set_ylabel('Loss')
    ax.set_title(f'Loss Components: {first_config}')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    # Plot 3: Precision by Configuration
    ax = axes[1, 0]
    config_names = list(results.keys())
    precisions = [results[name]['metrics']['precision'] for name in config_names]
    
    colors = ['green' if p >= 80 else 'orange' if p >= 60 else 'red' for p in precisions]
    bars = ax.bar(range(len(config_names)), precisions, color=colors, alpha=0.7)
    ax.set_xticks(range(len(config_names)))
    ax.set_xticklabels(config_names, rotation=45, ha='right')
    ax.set_ylabel('Precision (%)')
    ax.set_title('Precision by Configuration')
    ax.axhline(y=80, color='green', linestyle='--', label='Target: 80%')
    ax.legend()
    ax.grid(True, alpha=0.3, axis='y')
    
    # Add value labels on bars
    for i, (bar, val) in enumerate(zip(bars, precisions)):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{val:.1f}%',
                ha='center', va='bottom', fontweight='bold')
    
    # Plot 4: Overfitting Analysis (last 20 epochs)
    ax = axes[1, 1]
    for config_name, data in results.items():
        losses = data['losses']['total']
        if len(losses) >= 20:
            last_20 = losses[-20:]
            epochs_last = range(len(losses) - 19, len(losses) + 1)
            
            # Calculate trend (slope)
            x = np.arange(len(last_20))
            slope = np.polyfit(x, last_20, 1)[0]
            
            label = f"{config_name} (slope: {slope:.4f})"
            ax.plot(epochs_last, last_20, label=label, linewidth=2, marker='o', markersize=3)
    
    ax.set_xlabel('Epoch')
    ax.set_ylabel('Total Loss')
    ax.set_title('Overfitting Check (Last 20 Epochs)')
    ax.legend(fontsize=8)
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"\n[SAVED] Loss curves: {save_path}")
    plt.close()


def plot_metrics_comparison(results: Dict, save_path: str = 'metrics_comparison.png'):
    """Plot detailed metrics comparison."""
    
    fig, axes = plt.subplots(2, 3, figsize=(18, 10))
    fig.suptitle('Metrics Comparison Across Configurations', fontsize=16, fontweight='bold')
    
    config_names = list(results.keys())
    
    # Plot 1: Precision
    ax = axes[0, 0]
    precisions = [results[name]['metrics']['precision'] for name in config_names]
    ax.bar(range(len(config_names)), precisions, color='steelblue', alpha=0.7)
    ax.set_xticks(range(len(config_names)))
    ax.set_xticklabels(config_names, rotation=45, ha='right', fontsize=8)
    ax.set_ylabel('Precision (%)')
    ax.set_title('Precision')
    ax.axhline(y=80, color='red', linestyle='--', alpha=0.5)
    ax.grid(True, alpha=0.3, axis='y')
    
    # Plot 2: Gender Balance
    ax = axes[0, 1]
    females = [results[name]['metrics']['females_pct'] for name in config_names]
    males = [results[name]['metrics']['males_pct'] for name in config_names]
    
    x = np.arange(len(config_names))
    width = 0.35
    ax.bar(x - width/2, females, width, label='Female %', color='pink', alpha=0.7)
    ax.bar(x + width/2, males, width, label='Male %', color='lightblue', alpha=0.7)
    ax.set_xticks(x)
    ax.set_xticklabels(config_names, rotation=45, ha='right', fontsize=8)
    ax.set_ylabel('Percentage')
    ax.set_title('Gender Distribution')
    ax.legend()
    ax.grid(True, alpha=0.3, axis='y')
    
    # Plot 3: Common Games
    ax = axes[0, 2]
    common_games = [results[name]['metrics']['common_games'] for name in config_names]
    ax.bar(range(len(config_names)), common_games, color='green', alpha=0.7)
    ax.set_xticks(range(len(config_names)))
    ax.set_xticklabels(config_names, rotation=45, ha='right', fontsize=8)
    ax.set_ylabel('Count (out of 20)')
    ax.set_title('Common Games')
    ax.axhline(y=20, color='red', linestyle='--', alpha=0.5)
    ax.grid(True, alpha=0.3, axis='y')
    
    # Plot 4: Age in Range
    ax = axes[1, 0]
    age_in_range = [results[name]['metrics']['age_in_range'] for name in config_names]
    ax.bar(range(len(config_names)), age_in_range, color='orange', alpha=0.7)
    ax.set_xticks(range(len(config_names)))
    ax.set_xticklabels(config_names, rotation=45, ha='right', fontsize=8)
    ax.set_ylabel('Count (out of 20)')
    ax.set_title('Age in Range (17-30)')
    ax.axhline(y=20, color='red', linestyle='--', alpha=0.5)
    ax.grid(True, alpha=0.3, axis='y')
    
    # Plot 5: Average Age
    ax = axes[1, 1]
    avg_ages = [results[name]['metrics']['avg_age'] for name in config_names]
    ax.bar(range(len(config_names)), avg_ages, color='purple', alpha=0.7)
    ax.set_xticks(range(len(config_names)))
    ax.set_xticklabels(config_names, rotation=45, ha='right', fontsize=8)
    ax.set_ylabel('Average Age')
    ax.set_title('Average Age of Recommendations')
    ax.axhline(y=23.5, color='green', linestyle='--', alpha=0.5, label='Ideal: 23.5')
    ax.legend()
    ax.grid(True, alpha=0.3, axis='y')
    
    # Plot 6: Overall Score (weighted combination)
    ax = axes[1, 2]
    # Score = precision * 0.5 + (common_games/20) * 0.3 + (age_in_range/20) * 0.2
    scores = []
    for name in config_names:
        m = results[name]['metrics']
        score = (m['precision'] * 0.5 + 
                 (m['common_games']/20 * 100) * 0.3 + 
                 (m['age_in_range']/20 * 100) * 0.2)
        scores.append(score)
    
    colors = ['gold' if s == max(scores) else 'silver' if s == sorted(scores, reverse=True)[1] else 'lightgray' 
              for s in scores]
    ax.bar(range(len(config_names)), scores, color=colors, alpha=0.7)
    ax.set_xticks(range(len(config_names)))
    ax.set_xticklabels(config_names, rotation=45, ha='right', fontsize=8)
    ax.set_ylabel('Overall Score')
    ax.set_title('Overall Score (Weighted)')
    ax.grid(True, alpha=0.3, axis='y')
    
    # Add value labels
    for i, score in enumerate(scores):
        ax.text(i, score, f'{score:.1f}', ha='center', va='bottom', fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"[SAVED] Metrics comparison: {save_path}")
    plt.close()


def main():
    print("="*70)
    print("V6 EXTREME: Woman Preferences + Hyperparameter Analysis")
    print("="*70)
    
    # Define configurations to test
    configs = {
        'Baseline (100ep)': {
            'epochs': 100,
            'lr': 3e-4,
            'batch_size': 32,
            'dropout': 0.3,
            'use_scheduler': True,
            'focal_gamma': 2.0,
            'rejection_weight': 0.5,
            'intersection_weight': 0.3,
            'use_weighted_sampling': True
        },
        'More Epochs (150)': {
            'epochs': 150,
            'lr': 3e-4,
            'batch_size': 32,
            'dropout': 0.3,
            'use_scheduler': True,
            'focal_gamma': 2.0,
            'rejection_weight': 0.5,
            'intersection_weight': 0.3,
            'use_weighted_sampling': True
        },
        'Lower LR (1e-4)': {
            'epochs': 100,
            'lr': 1e-4,
            'batch_size': 32,
            'dropout': 0.3,
            'use_scheduler': True,
            'focal_gamma': 2.0,
            'rejection_weight': 0.5,
            'intersection_weight': 0.3,
            'use_weighted_sampling': True
        },
        'Higher Dropout (0.4)': {
            'epochs': 100,
            'lr': 3e-4,
            'batch_size': 32,
            'dropout': 0.4,
            'use_scheduler': True,
            'focal_gamma': 2.0,
            'rejection_weight': 0.5,
            'intersection_weight': 0.3,
            'use_weighted_sampling': True
        },
        'Strong Focal (gamma=3)': {
            'epochs': 100,
            'lr': 3e-4,
            'batch_size': 32,
            'dropout': 0.3,
            'use_scheduler': True,
            'focal_gamma': 3.0,
            'rejection_weight': 0.5,
            'intersection_weight': 0.3,
            'use_weighted_sampling': True
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
        print(f"   Common games: {metrics['common_games']}/20")
        print(f"   Age in range: {metrics['age_in_range']}/20")
        print(f"   Avg age: {metrics['avg_age']:.1f}")
        
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
    
    plot_loss_curves(results, 'woman_v6_loss_curves.png')
    plot_metrics_comparison(results, 'woman_v6_metrics.png')
    
    # Summary table
    print(f"\n{'='*70}")
    print("SUMMARY TABLE")
    print(f"{'='*70}\n")
    
    print(f"{'Configuration':<25} {'Precision':<12} {'Gender F%':<12} {'Games':<8} {'Age':<8} {'Score':<8}")
    print(f"{'-'*85}")
    
    for config_name in results.keys():
        m = results[config_name]['metrics']
        score = (m['precision'] * 0.5 + 
                 (m['common_games']/20 * 100) * 0.3 + 
                 (m['age_in_range']/20 * 100) * 0.2)
        
        print(f"{config_name:<25} {m['precision']:>6.1f}%      {m['females_pct']:>6.0f}%       "
              f"{m['common_games']:>3}/20   {m['age_in_range']:>3}/20   {score:>6.1f}")
    
    # Best configuration
    best_config = max(results.keys(), 
                      key=lambda k: results[k]['metrics']['precision'])
    
    print(f"\n{'='*70}")
    print(f"BEST CONFIGURATION: {best_config}")
    print(f"Precision: {results[best_config]['metrics']['precision']:.1f}%")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()


