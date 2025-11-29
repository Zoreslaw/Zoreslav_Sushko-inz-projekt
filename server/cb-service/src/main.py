import argparse
import logging
import sys

from src.eval_preview import preview_content_based
from src.features import Featurizer
from src.io_backend import fetch_users_api

# Configure root logger: INFO to stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


def run_eval(args):
    """Offline eval pipeline placeholder: will load data, encode features, evaluate metrics."""
    logger.info("[eval] Starting offline evaluation pipeline...")

    users = []  # collect users here regardless of source

    if args.source == "backend":
        logger.info("[eval] Data source: backend")
        logger.info("[eval] Note: --users is ignored when source=backend")
        logger.info(f"[eval] Backend URL: {args.api_url} (timeout={args.api_timeout}s)")

        users = fetch_users_api(args.api_url, args.api_timeout)
        logger.info(f"[eval] Loaded users: {len(users)}")
        if users:
            sample_ids = ", ".join(u.id for u in users[:3])
            logger.info(f"[eval] Example ids: {sample_ids}")
    else:
        logger.info("[eval] Data source: synthetic")
        logger.info(f"[eval] Synthetic users: {args.users} (seed={args.seed})")

    # --- facet coverage diagnostics (before Featurizer.fit) ---
    def _non_empty_len(lst):
        return sum(1 for x in lst if x)

    cnt_games = sum(1 for u in users if u.favorite_games)
    cnt_favcat = sum(1 for u in users if getattr(u, "favorite_category", None))
    cnt_prefcats = sum(1 for u in users if u.preference_categories)

    # collect unique tokens to see what we actually have
    uniq_games = set()
    uniq_cats = set()
    for u in users:
        uniq_games.update([g for g in (u.favorite_games or []) if g])
        if getattr(u, "favorite_category", None):
            uniq_cats.add(u.favorite_category)
        uniq_cats.update([c for c in (u.preference_categories or []) if c])

    logger.info("[eval][diag] users with favorite_games: %d / %d", cnt_games, len(users))
    logger.info("[eval][diag] users with favorite_category: %d / %d", cnt_favcat, len(users))
    logger.info("[eval][diag] users with preference_categories: %d / %d", cnt_prefcats, len(users))
    logger.info("[eval][diag] unique games: %s", sorted(list(uniq_games))[:10])


    if not users:
        logger.warning("[eval] No users loaded; skipping feature sandbox.")
        logger.info(f"[eval] Top-K: {args.k}")
        logger.info("[eval] Done (placeholder).")
        return

    preview_content_based(users, args)

    logger.info(f"[eval] Top-K: {args.k}")
    logger.info("[eval] Done (placeholder).")


def run_serve(args):
    """API server: start FastAPI app with Uvicorn."""
    import uvicorn
    from src.api import app
    
    logger.info("[serve] Starting Content-Based Recommendation API server...")
    logger.info(f"[serve] Host: {args.host}  Port: {args.port}")
    logger.info(f"[serve] Source: {args.source}")
    
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="info"
    )

def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Player matchmaking baseline (content-based) - stage 1"
    )
    parser.add_argument(
        "--mode",
        choices=["eval", "serve"],
        default="eval",
        help="Run offline evaluation or start API server"
        )
    parser.add_argument(
        "--users",
        type=int,
        default=500,
        help="Number of synthetic users to generate (for eval mode)"
    )
    parser.add_argument(
        "--k",
        type=int,
        default=20,
        help="Top-K for evaluation and recommendations"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=7,
        help="Random seed for reproducibility"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host for API server"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port for API server"
    )

    parser.add_argument(
        "--source",
        choices=["backend", "csv", "synthetic"],
        default="backend",
        help="Where to load users from (backend, csv, or synthetic)"
    )
    parser.add_argument(
        "--api-url",
        type=str,
        default="http://localhost:8080/api/users",
        help="Backend endpoint that returns users as JSON"
    )
    parser.add_argument(
        "--api-timeout",
        type=float,
        default=10.0,
        help="HTTP timeout in seconds for backend requests"
    )
    parser.add_argument(
        "--cb-mode",
        choices=["strict", "feedback"],
        default="strict",
        help="Content-based mode: strict (only profile) or feedback (Rocchio)."
    )
    parser.add_argument(
        "--alpha",
        type=float,
        default=1.0,
        help="Rocchio alpha (base profile weight)."
    )
    parser.add_argument(
        "--beta",
        type=float,
        default=0.6,
        help="Rocchio beta (likes centroid weight)."
    )
    parser.add_argument(
        "--gamma",
        type=float,
        default=0.3,
        help="Rocchio gamma (dislikes centroid weight)."
    )

    return parser


def main():
    logger.info("Initialize...")
    parser = build_arg_parser()
    args = parser.parse_args()

    if args.mode == "eval":
        run_eval(args)
    elif args.mode == "serve":
        run_serve(args)
    else:
        raise ValueError(f"Unsupported mode: {args.mode}")


if __name__ == "__main__":
    main()