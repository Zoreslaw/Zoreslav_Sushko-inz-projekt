# src/io_backend.py
import re
from dataclasses import dataclass
from typing import List, Optional, Iterable, Any
from datetime import datetime
import logging
import httpx
import json

from src.data_models import User

logger = logging.getLogger(__name__)

@dataclass
class BackendUserRow:
    id: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
    favorite_category: Optional[str] = None
    preference_gender: Optional[str] = None
    preference_age_min: Optional[int] = None
    preference_age_max: Optional[int] = None
    favorite_games: Optional[str] = None
    languages: Optional[str] = None
    preference_categories: Optional[str] = None
    preference_languages: Optional[str] = None
    liked: Optional[str] = None
    disliked: Optional[str] = None
    created_at: Optional[str] = None


_PG_ARRAY_RE = re.compile(
    r"""
    \{                      # opening brace
    \s*
    (?P<body>.*?)
    \s*
    \}                      # closing brace
    """,
    re.VERBOSE | re.DOTALL,
)

_TOKEN_RE = re.compile(
    r"""
    "([^"\\]*(?:\\.[^"\\]*)*)"   # double-quoted token (allows escaped quotes)
    |                            # or
    ([^,]+)                      # unquoted token (no comma inside)
    """,
    re.VERBOSE,
)

def _to_int(x):
    """Safe int coercion: returns None if value is empty or not an int."""
    try:
        if x is None:
            return None
        if isinstance(x, int):
            return x
        x_str = str(x).strip()
        return int(x_str) if x_str != "" else None
    except Exception:
        return None

def parse_pg_array(s: Optional[str]) -> List[str]:
    """Parse PostgreSQL text array like {a,b,"c d"} into ['a','b','c d']."""

    # 1) Handle None/empty
    if s is None:
        return []
    val = s.strip()
    if val == '' or val == '{}':
        return []

    # 2) Check if it is a PG array with braces
    m = _PG_ARRAY_RE.match(val)
    if not m:
        # No braces -> treat as single value
        # Strip optional surrounding quotes
        if len(val) >= 2 and val[0] == '"' and val[-1] == '"':
            val = val[1:-1]
        # Unescape \" inside
        val = val.replace(r'\"', '"')
        val = val.strip()
        return [val] if val else []

    # 3) Extract body from braces { ... }
    body = m.group("body").strip()
    if body == "":
        return []

    # 4) Tokenize body using _TOKEN_RE
    out: List[str] = []
    pos = 0
    n = len(body)
    while pos < n:
        m2 = _TOKEN_RE.match(body, pos)
        if not m2:
            # Skip separators (commas/whitespace) and move on
            pos += 1
            continue
        if m2.group(1) is not None:
            # Quoted token
            token = m2.group(1)
            # Unescape \" sequences
            token = token.replace(r'\"', '"')
        else:
            # Unquoted token
            token = m2.group(2).strip()
            # Remove accidental trailing comma if captured (edge cases)
            if token.endswith(","):
                token = token[:-1].strip()

        # Common post-processing
        token = token.strip()
        if token:
            if token.startswith('"') and token.endswith('"') and len(token) >= 2:
                token = token[1:-1]
            out.append(token)

        # Move position past this token and following separators
        end = m2.end()
        while end < n and body[end] in {',', ' ', '\t', '\n', '\r'}:
            end += 1
        pos = end

    # 5) Return collected tokens
    return [t for t in out if t != ""]

def _dedup_keep_order(items: Iterable[str]) -> List[str]:
    """Return items without duplicates while preserving the original order."""
    seen = set()
    out: List[str] = []
    for it in items:
        if it not in seen:
            seen.add(it)
            out.append(it)
    return out

def _normalize_langs(items: List[str]) -> List[str]:
    """Lowercase and strip language tags like EN -> en."""
    return _dedup_keep_order([x.strip().lower() for x in items if x and x.strip()])

def _coerce_array_field(v: Any) -> List[str]:
    """Accepts None | str (PG-array) | list -> returns List[str] cleaned.
    - If list: cast each element to str, strip, drop empties
    - If str: parse via parse_pg_array
    - Else: best-effort cast to str and parse
    """
    if v is None:
        return []
    if isinstance(v, list):
        # Already JSON array from API
        out = [str(x).strip() for x in v if x is not None and str(x).strip()]
        # Dedup while preserving order:
        seen = set()
        uniq = []
        for it in out:
            if it not in seen:
                seen.add(it)
                uniq.append(it)
        return uniq
    if isinstance(v, str):
        return parse_pg_array(v)
    # Fallback: unexpected type -> stringify and parse
    return parse_pg_array(str(v))

def _parse_dt(s: str | None):
    """Parse SQL/ISO timestamp string into datetime (returns None on failure)."""
    if not s:
        return None
    txt = s.strip()
    # Accept 'Z' and space separator
    if txt.endswith("Z"):
        txt = txt[:-1] + "+00:00"
    # fromisoformat in modern Python is fine with space, but normalize just in case
    try:
        return datetime.fromisoformat(txt.replace(" ", "T", 1))
    except Exception as e:
        logger.warning("Failed to parse created_at=%r: %s", s, e)
        return None

def map_backend_to_user(row: BackendUserRow) -> User:
    """Convert BackendUserRow (raw strings from DB/API) to normalized domain User."""
    # Parse PG-array-like fields into lists
    games_raw                = _coerce_array_field(row.favorite_games)
    langs_ui_raw             = _coerce_array_field(row.languages)
    pref_cats_raw            = _coerce_array_field(row.preference_categories)
    pref_langs_raw           = _coerce_array_field(row.preference_languages)
    liked_raw                = _coerce_array_field(row.liked)
    disliked_raw             = _coerce_array_field(row.disliked)

    # Normalize lists
    favorite_games           = _dedup_keep_order([x.strip() for x in games_raw if x and x.strip()])
    languages                = _normalize_langs(langs_ui_raw)
    preference_categories    = _dedup_keep_order([x.strip() for x in pref_cats_raw if x and x.strip()])
    preference_languages     = _normalize_langs(pref_langs_raw)
    liked                    = _dedup_keep_order([x.strip() for x in liked_raw if x and x.strip()])
    disliked                 = _dedup_keep_order([x.strip() for x in disliked_raw if x and x.strip()])

    # Validate/adjust partner age range if both present
    pref_min = row.preference_age_min
    pref_max = row.preference_age_max
    if pref_min is not None and pref_max is not None and pref_min > pref_max:
        logger.warning(
            "preference_age_min > preference_age_max for user %s (%s > %s) — swapping",
            row.id, pref_min, pref_max
        )
        pref_min, pref_max = pref_max, pref_min

    # Parse created_at
    created_at = _parse_dt(row.created_at)

    # Build domain object (field names kept identical to DB for clarity)
    return User(
        id=row.id,
        display_name=row.display_name,
        email=row.email,
        age=row.age,
        gender=row.gender,
        description=row.description,
        photo_url=row.photo_url,
        favorite_category=row.favorite_category,
        preference_gender=row.preference_gender,
        preference_age_min=pref_min,
        preference_age_max=pref_max,
        favorite_games=favorite_games,
        languages=languages,
        preference_categories=preference_categories,
        preference_languages=preference_languages,
        liked=liked,
        disliked=disliked,
        created_at=created_at,
    )

def _get_any(d: dict, names: list[str], default=None):
    """Return the first present non-None key from names in dict d."""
    for name in names:
        if name in d and d[name] is not None:
            return d[name]
    return default

def fetch_users_api(api_url: str, timeout: float = 10.0) -> List[User]:
    """
    Fetch users from backend API and map them into domain Users.
    Expected response: list of objects (or {"data": [...]}) with DB-like field names.
    """
    headers = {"Accept": "application/json"}
    with httpx.Client(timeout=timeout, headers=headers) as client:
        resp = client.get(api_url)
        resp.raise_for_status()
        try:
            payload = resp.json()
        except json.JSONDecodeError as e:
            logger.error("API returned non-JSON payload: %s", e)
            raise

    # Accept both a top-level list and {"data": [...]}
    if isinstance(payload, dict) and isinstance(payload.get("data"), list):
        rows_src = payload["data"]
    elif isinstance(payload, list):
        rows_src = payload
    else:
        logger.error("Unexpected API payload shape: %r", type(payload))
        raise ValueError("Unexpected API payload shape (expected list or {'data': [...]})")

    users: List[User] = []
    for item in rows_src:
        # We expect DB-like names exactly in DB: id, display_name, ..., created_at
        bu = BackendUserRow(
            id=str(_get_any(item, ["id", "userId", "user_id"], "")),
            display_name=_get_any(item, ["display_name", "displayName", "name"]),
            email=_get_any(item, ["email"]),
            age=_to_int(_get_any(item, ["age"])),
            gender=_get_any(item, ["gender"]),
            description=_get_any(item, ["description", "bio"]),
            photo_url=_get_any(item, ["photo_url", "photoUrl", "avatarUrl", "avatar"]),
            favorite_category=_get_any(item, ["favorite_category", "favoriteCategory"]),
            preference_gender=_get_any(item, ["preference_gender", "preferenceGender"]),
            preference_age_min=_to_int(_get_any(item, ["preference_age_min", "preferenceAgeMin"])),
            preference_age_max=_to_int(_get_any(item, ["preference_age_max", "preferenceAgeMax"])),
            favorite_games=_get_any(item, ["favorite_games", "favoriteGames"]),
            languages=_get_any(item, ["languages"]),
            preference_categories=_get_any(item, ["preference_categories", "preferenceCategories"]),
            preference_languages=_get_any(item, ["preference_languages", "preferenceLanguages"]),
            liked=_get_any(item, ["liked"]),
            disliked=_get_any(item, ["disliked"]),
            created_at=_get_any(item, ["created_at", "createdAt"]),
        )
        users.append(map_backend_to_user(bu))

    return users

