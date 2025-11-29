import logging
import math
import sys
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from src.data_models import User
from src.io_backend import _dedup_keep_order

# Configure root logger: INFO to stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

SparseVector = Dict[int, float]  # index -> value

def _l2_normalize_sparse(vec: Dict[int, float]) -> None:
    """In-place L2 normalization for a sparse vector (index -> value)."""
    # sum of squares
    s = 0.0
    for v in vec.values():
        s += v * v
    if s <= 0.0:
        return
    inv = 1.0 / math.sqrt(s)
    # scale in place
    for k in list(vec.keys()):
        vec[k] *= inv


def add_scaled(dst: SparseVector, src: SparseVector, scale: float) -> None:
    """dst += scale * src (in-place)."""
    for k, val in src.items():
        dst[k] = dst.get(k, 0.0) + scale * val


def cosine_sparse(a: SparseVector, b: SparseVector) -> float:
    """Cosine for L2-normalized sparse dicts -> dot product over common keys."""
    # Pick smaller dict to iterate
    if len(a) > len(b):
        a, b = b, a
    s = 0.0
    for k, av in a.items():
        bv = b.get(k)
        if bv is not None:
            s += av * bv
    return s

@dataclass
class FeaturizerConfig:
    w_games: float = 1.0
    w_categories: float = 0.8
    w_languages: float = 0.6
    l2_normalize: bool = True

@dataclass
class FeaturizerState:
    vocab_games: Dict[str, int] = field(default_factory=dict)
    vocab_categories: Dict[str, int] = field(default_factory=dict)
    vocab_languages: Dict[str, int] = field(default_factory=dict)
    offset_games: int = 0
    offset_categories: int = 0
    offset_languages: int = 0
    dim: int = 0

class Featurizer:
    def __init__(self, config: Optional[FeaturizerConfig] = None):
        self.config = config or FeaturizerConfig()
        self.state = FeaturizerState()

    def fit(self, users: List["User"]) -> "Featurizer":
        """Build vocabularies and column layout from training users."""
        self.state = FeaturizerState()

        raw_games: List[str] = []
        raw_categories: List[str] = []
        raw_languages: List[str] = []

        for user in users:
            raw_games.extend([g for g in user.favorite_games if g])

            if user.favorite_category:
                raw_categories.append(user.favorite_category)
            raw_categories.extend([c for c in user.preference_categories if c])

            raw_languages.extend([l for l in user.languages if l])
            raw_languages.extend([l for l in user.preference_languages if l])

        games = sorted(_dedup_keep_order([x.strip() for x in raw_games if x.strip()]))
        categories = sorted(_dedup_keep_order([x.strip() for x in raw_categories if x.strip()]))
        langs = sorted(_dedup_keep_order([x.strip() for x in raw_languages if x.strip()]))

        offset_games = 0
        offset_categories = offset_games + len(games)
        offset_languages = offset_categories + len(categories)

        self.state.offset_games = offset_games
        self.state.offset_categories = offset_categories
        self.state.offset_languages = offset_languages

        for i, g in enumerate(games):
            self.state.vocab_games[g] = offset_games + i

        for i, c in enumerate(categories):
            self.state.vocab_categories[c] = offset_categories + i

        for i, l in enumerate(langs):
            self.state.vocab_languages[l] = offset_languages + i

        self.state.dim = offset_languages + len(langs)

        return self

    def transform(self, user: "User") -> SparseVector:
        """Convert a user into a sparse feature vector using learned vocabularies.

        Strategy:
        - For each facet (games/categories/languages), set feature presence with a facet-specific weight.
        - Use global column indices from state.vocab_* (already include offsets).
        - Optionally L2-normalize the resulting sparse vector.
        """
        vec: SparseVector = {}

        # 1) Games (presence -> w_games)
        if user.favorite_games:
            # use a local set to avoid duplicates within the same facet
            for g in set(user.favorite_games):
                idx = self.state.vocab_games.get(g)
                if idx is not None:
                    vec[idx] = self.config.w_games

        # 2) Categories: favorite_category (single) + preference_categories (list)
        if user.favorite_category:
            idx = self.state.vocab_categories.get(user.favorite_category)
            if idx is not None:
                vec[idx] = self.config.w_categories

        if user.preference_categories:
            for c in set(user.preference_categories):
                idx = self.state.vocab_categories.get(c)
                if idx is not None:
                    vec[idx] = self.config.w_categories

        # 3) Languages: UI + preference_languages
        if user.languages:
            for l in set(user.languages):
                idx = self.state.vocab_languages.get(l)
                if idx is not None:
                    vec[idx] = self.config.w_languages

        if user.preference_languages:
            for l in set(user.preference_languages):
                idx = self.state.vocab_languages.get(l)
                if idx is not None:
                    vec[idx] = self.config.w_languages

        # 4) L2 normalization
        if self.config.l2_normalize:
            _l2_normalize_sparse(vec)

        return vec

    def feature_names(self) -> List[str]:
        """Return human-readable names for all feature columns (length == state.dim)."""
        names: List[str] = [""] * self.state.dim

        # Games
        for tok, idx in self.state.vocab_games.items():
            if 0 <= idx < self.state.dim:
                names[idx] = f"game::{tok}"

        # Categories
        for tok, idx in self.state.vocab_categories.items():
            if 0 <= idx < self.state.dim:
                names[idx] = f"cat::{tok}"

        # Languages
        for tok, idx in self.state.vocab_languages.items():
            if 0 <= idx < self.state.dim:
                names[idx] = f"lang::{tok}"

        return names