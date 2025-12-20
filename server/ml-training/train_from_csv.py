#!/usr/bin/env python3
"""
Train TwoTower V6 model from a CSV dataset (Colab-friendly).
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

from models.domain import DataStore, InteractionSet, UserProfile, GAMES
from training.trainer_v6 import train_model_v6_extreme

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)
logger = logging.getLogger(__name__)


def _clean_game_key(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


GAME_ALIASES: Dict[str, str] = {_clean_game_key(g): g for g in GAMES}
GAME_ALIASES.update(
    {
        "csgo": "cs2",
        "counterstrike2": "cs2",
        "counterstrikeglobaloffensive": "cs2",
        "counterstrike": "cs2",
        "dota": "dota2",
        "leagueoflegends": "lol",
        "apexlegends": "apex",
        "overwatch": "overwatch2",
        "heartsofiron4": "hoi4",
        "bf1": "battlefield1",
        "gtav": "gta5rp",
        "gta5": "gta5rp",
        "grandtheftauto5": "gta5rp",
    }
)


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


def normalize_gender(value: Optional[str]) -> Tuple[str, bool]:
    if not value:
        return "M", True
    raw = value.strip().lower()
    if raw in ("m", "male"):
        return "M", False
    if raw in ("f", "female"):
        return "F", False
    return "M", True


def normalize_games(games: List[str]) -> Tuple[List[str], int]:
    normalized: List[str] = []
    seen = set()
    unknown = 0
    for game in games:
        key = _clean_game_key(game)
        if not key:
            continue
        canonical = GAME_ALIASES.get(key)
        if not canonical:
            unknown += 1
            continue
        if canonical not in seen:
            seen.add(canonical)
            normalized.append(canonical)
    return normalized, unknown


def _get_field(row: Dict[str, str], field_map: Dict[str, str], key: str) -> Optional[str]:
    actual = field_map.get(key)
    if not actual:
        return None
    return row.get(actual)


def load_users_from_csv(csv_path: Path) -> Tuple[List[Dict[str, object]], Dict[str, int]]:
    required_fields = ["id", "age", "gender", "favorite_games", "liked", "disliked"]

    users: List[Dict[str, object]] = []
    skipped = 0
    unknown_gender = 0
    unknown_games = 0

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

            gender, gender_unknown = normalize_gender(_get_field(row, field_map, "gender"))
            if gender_unknown:
                unknown_gender += 1

            raw_games = parse_json_list(_get_field(row, field_map, "favorite_games"))
            games, unknown_count = normalize_games(raw_games)
            unknown_games += unknown_count

            liked_ids = parse_json_list(_get_field(row, field_map, "liked"))
            disliked_ids = parse_json_list(_get_field(row, field_map, "disliked"))

            users.append(
                {
                    "id": user_id,
                    "age": age,
                    "gender": gender,
                    "games": games,
                    "liked": liked_ids,
                    "disliked": disliked_ids,
                    "line": line_num,
                }
            )

    id_to_idx = {user["id"]: idx for idx, user in enumerate(users)}
    logger.info(f"Loaded {len(users)} users from CSV (skipped {skipped})")
    if unknown_gender > 0:
        logger.info(f"Unknown gender values defaulted to 'M': {unknown_gender}")
    if unknown_games > 0:
        logger.info(f"Unknown game tokens ignored: {unknown_games}")
    return users, id_to_idx


def build_datastore(raw_users: List[Dict[str, object]], id_to_idx: Dict[str, int]) -> DataStore:
    dat = DataStore()
    for idx, raw in enumerate(raw_users):
        dat.users.append(
            UserProfile(
                user_id=idx,
                age=int(raw["age"]),
                gender=str(raw["gender"]),
                games=list(raw["games"]),
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

    raw_users, id_to_idx = load_users_from_csv(csv_path)
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

    logger.info("Starting model training with V6 EXTREME...")
    model = train_model_v6_extreme(
        dat,
        epochs=args.epochs,
        lr=args.lr,
        batch_size=args.batch_size,
        device=device,
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
        temperature=0.07,
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
    torch.save(model.state_dict(), tmp_path)
    os.replace(tmp_path, model_path)

    logger.info(f"Model saved: {model_path}")
    logger.info(f"Model version: {version}")
    logger.info(f"Model size: {model_path.stat().st_size / (1024 * 1024):.2f} MB")
    return True


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train TwoTower V6 from CSV dataset.")
    parser.add_argument("--csv-path", required=True, help="Path to the CSV dataset")
    parser.add_argument("--output-dir", default="models", help="Output directory for model file")
    parser.add_argument("--epochs", type=int, default=80, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--tag", default="collab", help="Version tag suffix (e.g., collab)")
    parser.add_argument("--min-users", type=int, default=10, help="Minimum users required")
    parser.add_argument("--min-interactions", type=int, default=5, help="Minimum interactions required")
    parser.add_argument("--device", choices=["cpu", "cuda"], default=None, help="Force device")
    return parser


if __name__ == "__main__":
    ok = train_from_csv(build_parser().parse_args())
    sys.exit(0 if ok else 1)
