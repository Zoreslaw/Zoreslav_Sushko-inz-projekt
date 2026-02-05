#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSV import/export utilities for user profiles.

CSV format:
user_id,age,gender,games
0,22,M,valorant;cs2
1,21,M,valorant;apex
...
"""

import csv
from models.domain import DataStore, GAMES


def export_users_to_csv(dat: DataStore, path: str) -> None:
    """Export user profiles to CSV file."""
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["user_id", "age", "gender", "games"])
        for u in dat.users:
            games = ";".join(u.games)
            w.writerow([u.user_id, u.age, u.gender, games])


def import_users_from_csv(dat: DataStore, path: str) -> None:
    """Import user profiles from CSV file. Clears existing users."""
    dat.clear()
    with open(path, "r", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            age = int(row["age"])
            gender = row["gender"].strip()
            games = [g.strip() for g in row["games"].split(";") if g.strip()]
            # Filter to known games
            games = [g for g in games if g in GAMES]
            dat.add_user(age, gender, games)

