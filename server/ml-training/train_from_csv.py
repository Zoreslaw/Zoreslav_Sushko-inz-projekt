#!/usr/bin/env python3
"""
Train Hybrid TwoTower model from a CSV dataset (Colab-friendly).
Expected CSV headers (case-insensitive):
id, age, gender, favorite_games, liked, disliked
favorite_games/liked/disliked can be JSON arrays or comma-separated values.
"""

import argparse
import csv
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import torch

sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, "reconfigure") else None

SCRIPT_DIR = Path(__file__).resolve().parent
NETWORK_DIR = SCRIPT_DIR.parent / "network"
if NETWORK_DIR.exists():
    sys.path.insert(0, str(NETWORK_DIR))
elif Path("/app/network").exists():
    sys.path.insert(0, "/app/network")

from models.domain import DataStore, InteractionSet, UserProfile
from training.trainer_hybrid import train_model_hybrid
from data.hybrid_features import build_feature_config, normalize_list, normalize_gender, hash_user_id

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)
logger = logging.getLogger(__name__)



def parse_json_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    raw = value.strip()
    if not raw or raw == "[]":
        return []
    try:
        if raw.startswith("["):
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
    except Exception:
        pass
    return [item.strip().strip('"') for item in raw.split(",") if item.strip()]


def normalize_games(games: List[str]) -> List[str]:
    return normalize_list(games)


def _get_field(row: Dict[str, str], field_map: Dict[str, str], key: str) -> Optional[str]:
    actual = field_map.get(key)
    if not actual:
        return None
    return row.get(actual)


def load_users_from_csv(csv_path: Path, user_hash_buckets: int) -> Tuple[List[Dict[str, object]], Dict[str, int]]:
    required_fields = ["id", "age", "gender", "favorite_games", "liked", "disliked"]

    users: List[Dict[str, object]] = []
    skipped = 0
    unknown_gender = 0

    with csv_path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError("CSV header is missing")
        field_map = {name.lower(): name for name in reader.fieldnames}
        missing = [name for name in required_fields if name not in field_map]
        if missing:
            raise ValueError(f"CSV is missing required columns: {', '.join(missing)}")

        for line_num, row in enumerate(reader, start=2):
            user_id = (_get_field(row, field_map, "id") or "").strip()
            if not user_id:
                skipped += 1
                continue

            age_raw = _get_field(row, field_map, "age")
            try:
                age = int(age_raw) if age_raw is not None else None
            except ValueError:
                age = None
            if age is None:
                skipped += 1
                continue

            gender = normalize_gender(_get_field(row, field_map, "gender"))
            if gender == "other":
                unknown_gender += 1

            raw_games = parse_json_list(_get_field(row, field_map, "favorite_games"))
            games = normalize_games(raw_games)

            liked_ids = parse_json_list(_get_field(row, field_map, "liked"))
            disliked_ids = parse_json_list(_get_field(row, field_map, "disliked"))

            users.append(
                {
                    "id": user_id,
                    "user_hash": hash_user_id(user_id, user_hash_buckets),
                    "age": age,
                    "gender": gender,
                    "games": games,
                    "categories": [],
                    "languages": [],
                    "liked": liked_ids,
                    "disliked": disliked_ids,
                    "line": line_num,
                }
            )

    id_to_idx = {user["id"]: idx for idx, user in enumerate(users)}
    logger.info(f"Loaded {len(users)} users from CSV (skipped {skipped})")
    if unknown_gender > 0:
        logger.info(f"Unknown gender values mapped to 'other': {unknown_gender}")
    return users, id_to_idx


def build_datastore(raw_users: List[Dict[str, object]], id_to_idx: Dict[str, int]) -> DataStore:
    dat = DataStore()
    for idx, raw in enumerate(raw_users):
        dat.users.append(
            UserProfile(
                user_id=int(raw["user_hash"]),
                age=int(raw["age"]),
                gender=str(raw["gender"]),
                games=list(raw["games"]),
                categories=list(raw.get("categories") or []),
                languages=list(raw.get("languages") or []),
            )
        )

    positives = set()
    negatives = set()
    for raw in raw_users:
        u_idx = id_to_idx.get(str(raw["id"]))
        if u_idx is None:
            continue

        liked_ids = {str(x).strip() for x in raw["liked"] if str(x).strip()}
        disliked_ids = {str(x).strip() for x in raw["disliked"] if str(x).strip()}
        if liked_ids:
            disliked_ids -= liked_ids

        for target_id in liked_ids:
            v_idx = id_to_idx.get(target_id)
            if v_idx is None or v_idx == u_idx:
                continue
            positives.add((u_idx, v_idx))

        for target_id in disliked_ids:
            v_idx = id_to_idx.get(target_id)
            if v_idx is None or v_idx == u_idx:
                continue
            negatives.add((u_idx, v_idx))

    dat.interactions = InteractionSet(
        positives=list(positives),
        negatives=list(negatives),
    )
    return dat


def train_from_csv(args: argparse.Namespace) -> bool:
    csv_path = Path(args.csv_path)
    if not csv_path.exists():
        logger.error(f"CSV not found: {csv_path}")
        return False

    raw_users, id_to_idx = load_users_from_csv(csv_path, args.user_hash_buckets)
    if len(raw_users) < args.min_users:
        logger.warning(f"Not enough users ({len(raw_users)} < {args.min_users}).")
        return False

    dat = build_datastore(raw_users, id_to_idx)
    total_interactions = len(dat.interactions.positives) + len(dat.interactions.negatives)
    logger.info(
        f"Prepared datastore: {len(dat.users)} users, {len(dat.interactions.positives)} likes, "
        f"{len(dat.interactions.negatives)} dislikes"
    )

    if total_interactions < args.min_interactions:
        logger.warning(
            f"Not enough interactions ({total_interactions} < {args.min_interactions})."
        )
        return False

    device = None
    if args.device:
        if args.device == "cuda" and not torch.cuda.is_available():
            logger.warning("CUDA requested but not available. Falling back to CPU.")
        else:
            device = torch.device(args.device)

    logger.info("Starting hybrid Two-Tower training...")
    cfg = build_feature_config(
        [(u["games"], u["categories"], u["languages"], int(u["age"])) for u in raw_users],
        user_hash_buckets=args.user_hash_buckets,
        min_age=18,
        max_age=100,
    )
    model = train_model_hybrid(
        dat,
        cfg,
        epochs=args.epochs,
        lr=args.lr,
        batch_size=args.batch_size,
        device=device,
        log_fn=lambda m: logger.info(m),
        dropout=0.3,
        tower_hidden=(256, 128),
        out_dim=64,
        emb_user_dim=32,
        emb_token_dim=32,
        hard_negative_ratio=0.3,
    )

    start = datetime.now()
    version = start.strftime("%Y%m%d_%H%M%S")
    tag = (args.tag or "").strip().replace(" ", "-")
    if tag:
        version = f"{version}_{tag}"

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    model_filename = f"twotower_v6_{version}.pt"
    model_path = output_dir / model_filename
    tmp_path = model_path.with_suffix(model_path.suffix + ".tmp")

    logger.info(f"Saving model to {model_path}")
    bundle = {
        "state_dict": model.state_dict(),
        "feature_config": cfg.to_dict(),
        "model_version": version,
        "architecture": "TwoTowerHybrid",
    }
    torch.save(bundle, tmp_path)
    os.replace(tmp_path, model_path)

    logger.info(f"Model saved: {model_path}")
    logger.info(f"Model version: {version}")
    logger.info(f"Model size: {model_path.stat().st_size / (1024 * 1024):.2f} MB")
    return True


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train Hybrid TwoTower from CSV dataset.")
    parser.add_argument("--csv-path", required=True, help="Path to the CSV dataset")
    parser.add_argument("--output-dir", default="models", help="Output directory for model file")
    parser.add_argument("--epochs", type=int, default=80, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--tag", default="collab", help="Version tag suffix (e.g., collab)")
    parser.add_argument("--min-users", type=int, default=10, help="Minimum users required")
    parser.add_argument("--min-interactions", type=int, default=5, help="Minimum interactions required")
    parser.add_argument("--device", choices=["cpu", "cuda"], default=None, help="Force device")
    parser.add_argument("--user-hash-buckets", type=int, default=100000, help="User ID hash bucket count")
    return parser


if __name__ == "__main__":
    ok = train_from_csv(build_parser().parse_args())
    sys.exit(0 if ok else 1)
