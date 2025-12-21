#!/usr/bin/env python3
"""
Automatic model training from PostgreSQL database.
Refactor: strict logging to stdout, safe DB access, consistent limits.
"""

import os
import sys
import logging
from datetime import datetime
from typing import List, Dict, Any

import psycopg2
from psycopg2.extras import RealDictCursor
import torch

sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, 'reconfigure') else None

# domain + training remain your originals
sys.path.append('/app/network')
from models.neural_network_v6 import TwoTowerV6Extreme
from training.trainer_v6 import train_model_v6_extreme
from models.domain import DataStore, UserProfile, InteractionSet

logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True
)
logger = logging.getLogger(__name__)
for h in logger.handlers:
    try:
        h.flush = lambda: sys.stdout.flush()
    except Exception:
        pass

class TrainingConfig:
    DB_HOST = os.getenv('DB_HOST', 'postgres')
    DB_PORT = os.getenv('DB_PORT', '5432')
    DB_NAME = os.getenv('DB_NAME', 'teamup')
    DB_USER = os.getenv('DB_USER', 'teamup_user')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'teamup_password')

    MODEL_PATH = os.getenv('MODEL_PATH', '/shared/models/twotower_v6_optimal.pt')
    MODELS_DIR = os.getenv('MODELS_DIR', '/shared/models')
    LOG_PATH = os.getenv('LOG_PATH', '/shared/logs/training.log')
    CURRENT_TRAINING_LOG = os.getenv('CURRENT_TRAINING_LOG', '/shared/logs/current_training.log')
    STOP_TRAINING_FILE = os.getenv('STOP_TRAINING_FILE', '/shared/logs/stop_training.flag')

    MIN_USERS = int(os.getenv('MIN_USERS', '10'))
    MIN_INTERACTIONS = int(os.getenv('MIN_INTERACTIONS', '5'))

def get_db_connection():
    try:
        return psycopg2.connect(
            host=TrainingConfig.DB_HOST,
            port=TrainingConfig.DB_PORT,
            database=TrainingConfig.DB_NAME,
            user=TrainingConfig.DB_USER,
            password=TrainingConfig.DB_PASSWORD,
            cursor_factory=RealDictCursor
        )
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise

def load_users_from_db() -> List[UserProfile]:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # prefer snake_case columns in Postgres
        cur.execute('SELECT id, age, gender, favorite_games, created_at FROM users ORDER BY created_at')
        rows = cur.fetchall()

        users: List[UserProfile] = []
        for row in rows:
            gender_raw = (row.get('gender') or '').strip()
            gender = 'M' if gender_raw == 'Male' else 'F'
            users.append(UserProfile(
                user_id=row['id'],
                age=row['age'],
                gender=gender,
                games=row.get('favorite_games') or []
            ))
        logger.info(f"Loaded {len(users)} users from database")
        return users
    finally:
        cur.close(); conn.close()

def load_interactions_from_db() -> InteractionSet:
    conn = get_db_connection()
    cur = conn.cursor()
    inter = InteractionSet()
    try:
        cur.execute('''
            SELECT id, liked
            FROM users
            WHERE liked IS NOT NULL AND array_length(liked, 1) > 0
        ''')
        for row in cur.fetchall():
            for liked_id in (row['liked'] or []):
                inter.positives.append((row['id'], liked_id))

        logger.info(f"Loaded {len(inter.positives)} positive interactions")

        cur.execute('''
            SELECT id, disliked
            FROM users
            WHERE disliked IS NOT NULL AND array_length(disliked, 1) > 0
        ''')
        for row in cur.fetchall():
            for disliked_id in (row['disliked'] or []):
                inter.negatives.append((row['id'], disliked_id))

        logger.info(f"Loaded {len(inter.negatives)} negative interactions")
        return inter
    finally:
        cur.close(); conn.close()

def save_training_log(entry: Dict[str, Any]):
    import json
    os.makedirs(os.path.dirname(TrainingConfig.LOG_PATH), exist_ok=True)
    with open(TrainingConfig.LOG_PATH, 'a') as f:
        f.write(json.dumps(entry) + '\n')

def train_model():
    start = datetime.now()
    logger.info(f"=== Training started at {start} ===")

    try:
        logger.info("Loading data from PostgreSQL...")
        users = load_users_from_db()
        inter = load_interactions_from_db()
        total_inter = len(inter.positives) + len(inter.negatives)

        # Explicit check for empty database
        if len(users) == 0:
            logger.warning("No users found in database. Skipping training.")
            save_training_log({
                'timestamp': start.isoformat(),
                'status': 'skipped',
                'reason': 'no_users',
                'num_users': 0,
                'num_interactions': total_inter
            })
            return False

        if len(users) < TrainingConfig.MIN_USERS:
            logger.warning(f"Not enough users ({len(users)} < {TrainingConfig.MIN_USERS}). Skipping training.")
            save_training_log({
                'timestamp': start.isoformat(),
                'status': 'skipped',
                'reason': 'min_users',
                'num_users': len(users),
                'num_interactions': total_inter
            })
            return False

        if total_inter < TrainingConfig.MIN_INTERACTIONS:
            logger.warning(f"Not enough interactions ({total_inter} < {TrainingConfig.MIN_INTERACTIONS}). Skipping training.")
            save_training_log({
                'timestamp': start.isoformat(),
                'status': 'skipped',
                'reason': 'min_interactions',
                'num_users': len(users),
                'num_interactions': total_inter
            })
            return False

        logger.info("Building DataStore...")
        dat = DataStore()

        uid_to_idx = {u.user_id: i for i, u in enumerate(users)}
        for i, u in enumerate(users):
            u.user_id = i
        dat.users = users

        re = InteractionSet()
        for a, b in inter.positives:
            if a in uid_to_idx and b in uid_to_idx:
                re.positives.append((uid_to_idx[a], uid_to_idx[b]))
        for a, b in inter.negatives:
            if a in uid_to_idx and b in uid_to_idx:
                re.negatives.append((uid_to_idx[a], uid_to_idx[b]))
        dat.interactions = re

        re_total = len(re.positives) + len(re.negatives)
        logger.info(f"Training on {len(users)} users with {re_total} interactions")
        logger.info("=" * 60)
        logger.info("Starting model training with V6 EXTREME...")
        logger.info(f"Configuration: {len(users)} users, {re_total} interactions")
        logger.info(f"Epochs: 100, Learning Rate: 1e-4, Batch Size: 16")
        logger.info("=" * 60)
        
        # Check for stop flag before starting training
        if os.path.exists(TrainingConfig.STOP_TRAINING_FILE):
            logger.info("Stop training flag detected before training start. Skipping training.")
            try:
                os.remove(TrainingConfig.STOP_TRAINING_FILE)
            except Exception:
                pass
            save_training_log({
                'timestamp': start.isoformat(),
                'status': 'stopped',
                'reason': 'pre_start',
                'num_users': len(users),
                'num_interactions': total_inter
            })
            return False

        model = train_model_v6_extreme(
            dat,
            epochs=80,
            lr=1e-4,
            batch_size=16,
            device=None,
            log_fn=lambda m: logger.info(m),
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
            temperature=0.07
        )

        logger.info("=" * 60)
        
        # Check if training was stopped
        was_stopped = os.path.exists(TrainingConfig.STOP_TRAINING_FILE)
        if was_stopped:
            logger.warning("Training was stopped by user request")
            try:
                os.remove(TrainingConfig.STOP_TRAINING_FILE)
            except Exception:
                pass
            save_training_log({
                'timestamp': start.isoformat(),
                'duration_seconds': (datetime.now() - start).total_seconds(),
                'num_users': len(users),
                'num_interactions': total_inter,
                'status': 'stopped'
            })
            return False
        
        # Save model with version (timestamp)
        model_version = start.strftime('%Y%m%d_%H%M%S')
        model_filename = f'twotower_v6_{model_version}.pt'
        model_path = os.path.join(TrainingConfig.MODELS_DIR, model_filename)
        os.makedirs(TrainingConfig.MODELS_DIR, exist_ok=True)
        
        logger.info(f"Saving model to {model_path}")
        tmp = model_path + '.tmp'
        torch.save(model.state_dict(), tmp)
        os.replace(tmp, model_path)
        
        # Save training log for this model version
        log_file_path = os.path.join(TrainingConfig.MODELS_DIR, f'training_log_{model_version}.txt')
        if os.path.exists(TrainingConfig.CURRENT_TRAINING_LOG):
            import shutil
            shutil.copy2(TrainingConfig.CURRENT_TRAINING_LOG, log_file_path)
        
        # Also update the "current" model symlink/path for backward compatibility
        current_model_path = TrainingConfig.MODEL_PATH
        if os.path.exists(current_model_path):
            # Backup old current model
            backup_path = current_model_path + '.backup'
            if os.path.exists(backup_path):
                os.remove(backup_path)
            os.rename(current_model_path, backup_path)
        # Copy new model to current location
        import shutil
        shutil.copy2(model_path, current_model_path)

        end = datetime.now()
        dur = (end - start).total_seconds()
        logger.info("=" * 60)
        logger.info("TRAINING COMPLETED SUCCESSFULLY!")
        logger.info(f"Duration: {dur:.1f}s ({dur/60:.1f} minutes)")
        logger.info(f"Model saved: {model_path}")
        logger.info(f"Model size: {os.path.getsize(model_path) / (1024*1024):.2f} MB")
        logger.info(f"Model version: {model_version}")
        logger.info("=" * 60)

        save_training_log({
            'timestamp': start.isoformat(),
            'duration_seconds': dur,
            'num_users': len(users),
            'num_interactions': total_inter,
            'model_path': model_path,
            'model_version': model_version,
            'model_filename': model_filename,
            'status': 'success'
        })
        return True

    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        save_training_log({'timestamp': datetime.now().isoformat(), 'status': 'error', 'error': str(e)})
        return False

if __name__ == '__main__':
    ok = train_model()
    sys.exit(0 if ok else 1)
