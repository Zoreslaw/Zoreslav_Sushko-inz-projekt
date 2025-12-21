from typing import Dict, Callable
from src.data_models import User

def make_eligibility_filter(probe: User) -> Callable[[User], bool]:
    """
    Return a predicate(user) that checks hard constraints:
    - age within probe.preference_age_[min,max] if both present
    - gender match if probe.preference_gender in {"Male","Female"}; "Any" passes
    """
    def _ok(u: User) -> bool:
        # age window
        if probe.preference_age_min is not None and u.age is not None:
            if u.age < probe.preference_age_min:
                return False
        if probe.preference_age_max is not None and u.age is not None:
            if u.age > probe.preference_age_max:
                return False
        # gender
        if probe.preference_gender:
            pref = probe.preference_gender.strip().lower()
            if pref not in ("any", ""):
                if u.gender and u.gender.lower() != pref:
                    return False
        return True
    return _ok
