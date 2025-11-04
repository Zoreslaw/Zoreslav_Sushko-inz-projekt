#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tkinter GUI application for the matchmaking system.
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from typing import Optional

from models.domain import DataStore, UserProfile, GAMES
from models.neural_network_v6 import TwoTowerV6Extreme
from data.io import import_users_from_csv, export_users_to_csv
from training.trainer_v6 import train_model_v6_extreme
from recommendation.recommender_v6 import topk_recommend_v6


class App(tk.Tk):
    """Main application window for matchmaking system."""
    
    def __init__(self):
        super().__init__()
        self.title("Matchmaking Two‑Tower Prototype")
        self.geometry("1180x760")

        self.dat = DataStore()
        self.model: Optional[TwoTowerV6Extreme] = None

        self._build_widgets()

    def _build_widgets(self):
        """Build all GUI widgets."""
        # Menubar for Import/Export
        menubar = tk.Menu(self)
        filemenu = tk.Menu(menubar, tearoff=0)
        filemenu.add_command(label="Import Users (CSV)...", command=self.on_import_csv)
        filemenu.add_command(label="Export Users (CSV)...", command=self.on_export_csv)
        menubar.add_cascade(label="File", menu=filemenu)
        self.config(menu=menubar)

        # Main panels
        left = ttk.LabelFrame(self, text="Create Users")
        mid = ttk.LabelFrame(self, text="Label Pairs (Pos/Neg)")
        right = ttk.LabelFrame(self, text="Train & Recommend")
        left.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=6, pady=6)
        mid.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=6, pady=6)
        right.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=6, pady=6)

        self._build_left_panel(left)
        self._build_middle_panel(mid)
        self._build_right_panel(right)

    def _build_left_panel(self, parent):
        """Build the user creation panel."""
        # Age input
        frm_age = ttk.Frame(parent)
        frm_age.pack(anchor="w", pady=4)
        ttk.Label(frm_age, text="Age (12..60):").pack(side=tk.LEFT)
        self.age_var = tk.IntVar(value=22)
        ttk.Spinbox(frm_age, from_=12, to=60, textvariable=self.age_var, width=6).pack(side=tk.LEFT, padx=6)

        # Gender selection
        frm_gender = ttk.Frame(parent)
        frm_gender.pack(anchor="w", pady=4)
        ttk.Label(frm_gender, text="Gender:").pack(side=tk.LEFT)
        self.gender_var = tk.StringVar(value="M")
        ttk.Radiobutton(frm_gender, text="M", variable=self.gender_var, value="M").pack(side=tk.LEFT)
        ttk.Radiobutton(frm_gender, text="F", variable=self.gender_var, value="F").pack(side=tk.LEFT)

        # Games selection
        ttk.Label(parent, text="Select games (Ctrl/Shift for multi):").pack(anchor="w")
        self.games_listbox = tk.Listbox(parent, selectmode=tk.MULTIPLE, height=10, exportselection=False)
        for g in GAMES:
            self.games_listbox.insert(tk.END, g)
        self.games_listbox.pack(fill=tk.X, padx=2, pady=2)

        ttk.Button(parent, text="Add User", command=self.on_add_user).pack(pady=6)

        # Users list
        ttk.Label(parent, text="Users:").pack(anchor="w")
        self.users_list = tk.Listbox(parent, height=14, exportselection=False)
        self.users_list.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)

        ttk.Button(parent, text="Seed Demo Users (10)", command=self.on_seed_demo).pack(pady=4)

    def _build_middle_panel(self, parent):
        """Build the interaction labeling panel."""
        ttk.Label(parent, text="Select U (source user):").pack(anchor="w")
        self.u_list = tk.Listbox(parent, height=10, exportselection=False)
        self.u_list.pack(fill=tk.X, padx=2, pady=2)
        
        ttk.Label(parent, text="Select V (candidate user):").pack(anchor="w")
        self.v_list = tk.Listbox(parent, height=10, exportselection=False)
        self.v_list.pack(fill=tk.X, padx=2, pady=2)
        
        frm_btns = ttk.Frame(parent)
        frm_btns.pack(pady=6)
        ttk.Button(frm_btns, text="Add Positive (u,v)", command=self.on_add_positive).pack(side=tk.LEFT, padx=4)
        ttk.Button(frm_btns, text="Add Negative (u,v)", command=self.on_add_negative).pack(side=tk.LEFT, padx=4)
        
        ttk.Label(parent, text="Positives:").pack(anchor="w")
        self.pos_list = tk.Listbox(parent, height=6, exportselection=False)
        self.pos_list.pack(fill=tk.X, padx=2, pady=2)
        
        ttk.Label(parent, text="Negatives:").pack(anchor="w")
        self.neg_list = tk.Listbox(parent, height=6, exportselection=False)
        self.neg_list.pack(fill=tk.X, padx=2, pady=2)

    def _build_right_panel(self, parent):
        """Build the training and recommendation panel."""
        # Training controls
        frm_train = ttk.Frame(parent)
        frm_train.pack(anchor="w", pady=4, fill=tk.X)
        ttk.Label(frm_train, text="Epochs:").pack(side=tk.LEFT)
        self.epochs_var = tk.IntVar(value=80)  # OPTIMAL: 80 epochs
        ttk.Spinbox(frm_train, from_=1, to=200, textvariable=self.epochs_var, width=6).pack(side=tk.LEFT, padx=6)
        ttk.Button(parent, text="Train Model (BPR)", command=self.on_train).pack(pady=6)
        
        ttk.Separator(parent, orient="horizontal").pack(fill=tk.X, pady=8)
        
        # Recommendation controls
        ttk.Label(parent, text="Recommend for user:").pack(anchor="w")
        self.rec_user_list = tk.Listbox(parent, height=8, exportselection=False)
        self.rec_user_list.pack(fill=tk.X, padx=2, pady=2)
        
        frm_k = ttk.Frame(parent)
        frm_k.pack(anchor="w", pady=4)
        ttk.Label(frm_k, text="Top-K:").pack(side=tk.LEFT)
        self.k_var = tk.IntVar(value=5)
        ttk.Spinbox(frm_k, from_=1, to=20, textvariable=self.k_var, width=6).pack(side=tk.LEFT, padx=6)
        ttk.Button(parent, text="Get Recommendations", command=self.on_recommend).pack(pady=6)
        
        # Log output
        ttk.Label(parent, text="Log:").pack(anchor="w")
        self.log = tk.Text(parent, height=18)
        self.log.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)

    # ---------------------------
    # Helper methods
    # ---------------------------

    def log_print(self, msg: str):
        """Print a message to the log widget."""
        self.log.insert(tk.END, msg + "\n")
        self.log.see(tk.END)
        self.update_idletasks()

    def refresh_user_lists(self):
        """Refresh all user list widgets."""
        def fmt_user(p: UserProfile) -> str:
            games = ",".join(p.games)
            return f"[{p.user_id}] age={p.age} g={p.gender} games={games}"
        
        self.users_list.delete(0, tk.END)
        self.u_list.delete(0, tk.END)
        self.v_list.delete(0, tk.END)
        self.rec_user_list.delete(0, tk.END)
        for p in self.dat.users:
            s = fmt_user(p)
            self.users_list.insert(tk.END, s)
            self.u_list.insert(tk.END, s)
            self.v_list.insert(tk.END, s)
            self.rec_user_list.insert(tk.END, s)

    def _get_selected_index(self, lb: tk.Listbox) -> Optional[int]:
        """Get the selected index from a listbox."""
        sel = lb.curselection()
        if not sel:
            return None
        return sel[0]

    def _reindex_user_ids(self):
        """Ensure user_id matches list index after import."""
        for i, u in enumerate(self.dat.users):
            u.user_id = i

    # ---------------------------
    # Event handlers
    # ---------------------------

    def on_import_csv(self):
        """Handle CSV import."""
        path = filedialog.askopenfilename(
            title="Import Users CSV",
            filetypes=[("CSV files", "*.csv")]
        )
        if not path:
            return
        try:
            import_users_from_csv(self.dat, path)
            self._reindex_user_ids()
            self.refresh_user_lists()
            self.log_print(f"Imported users from: {path}")
        except Exception as e:
            messagebox.showerror("Import error", str(e))

    def on_export_csv(self):
        """Handle CSV export."""
        path = filedialog.asksaveasfilename(
            title="Export Users CSV",
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")]
        )
        if not path:
            return
        try:
            export_users_to_csv(self.dat, path)
            self.log_print(f"Exported users to: {path}")
        except Exception as e:
            messagebox.showerror("Export error", str(e))

    def on_add_user(self):
        """Handle adding a new user."""
        age = self.age_var.get()
        gender = self.gender_var.get()
        selected = [self.games_listbox.get(i) for i in self.games_listbox.curselection()]
        
        if age < 12 or age > 60:
            messagebox.showerror("Invalid age", "Age must be in [12,60].")
            return
        if gender not in ("M", "F"):
            messagebox.showerror("Invalid gender", "Gender must be M or F.")
            return
        
        uid = self.dat.add_user(age, gender, selected)
        self.log_print(f"Added user {uid}")
        self.refresh_user_lists()

    def on_seed_demo(self):
        """Seed diverse demonstration users with random characteristics."""
        import random
        
        # Define game categories for more diverse combinations
        fps_games = ["valorant", "cs2", "apex", "overwatch2", "pubg", "battlefield1"]
        moba_games = ["lol", "dota2"]
        casual_games = ["minecraft", "fortnite", "rocketleague"]
        survival_games = ["rust", "phasmophobia"]
        strategy_games = ["hoi4"]
        roleplay_games = ["gta5rp"]
        
        generated_users = []
        
        for i in range(10):
            # Random age with diverse distribution
            age = random.choice([
                random.randint(12, 18),  # Young gamers
                random.randint(19, 25),  # College age
                random.randint(26, 35),  # Adults
                random.randint(36, 50),  # Mature gamers
            ])
            
            # Balanced gender distribution
            gender = random.choice(["M", "F"])
            
            # Diverse game preferences
            game_preference = random.choice([
                "fps_only",       # FPS specialist
                "moba_only",      # MOBA specialist  
                "casual_only",    # Casual gamer
                "fps_casual",     # FPS + casual
                "moba_casual",    # MOBA + casual
                "fps_moba",       # Competitive gamer
                "survival",       # Survival/horror games
                "strategy",       # Strategy games
                "roleplay",       # Roleplay games
                "variety",        # Plays everything
                "single_game"     # One-game specialist
            ])
            
            if game_preference == "fps_only":
                games = random.sample(fps_games, random.randint(1, 3))
            elif game_preference == "moba_only":
                games = random.sample(moba_games, random.randint(1, 2))
            elif game_preference == "casual_only":
                games = random.sample(casual_games, random.randint(1, 3))
            elif game_preference == "fps_casual":
                games = random.sample(fps_games, random.randint(1, 2)) + \
                        random.sample(casual_games, random.randint(1, 2))
            elif game_preference == "moba_casual":
                games = random.sample(moba_games, 1) + \
                        random.sample(casual_games, random.randint(1, 2))
            elif game_preference == "fps_moba":
                games = random.sample(fps_games, random.randint(1, 2)) + \
                        random.sample(moba_games, 1)
            elif game_preference == "survival":
                games = random.sample(survival_games, random.randint(1, 2))
            elif game_preference == "strategy":
                games = strategy_games + random.sample(casual_games, random.randint(0, 1))
            elif game_preference == "roleplay":
                games = roleplay_games + random.sample(fps_games, random.randint(0, 1))
            elif game_preference == "variety":
                games = random.sample(fps_games, 1) + \
                        random.sample(moba_games, 1) + \
                        random.sample(casual_games, 1)
            else:  # single_game
                games = [random.choice(GAMES)]
            
            generated_users.append((age, gender, games))
        
        # Add users to datastore
        for age, gender, games in generated_users:
            self.dat.add_user(age, gender, games)
        
        self.log_print("Seeded 10 diverse random users:")
        for i, (age, gender, games) in enumerate(generated_users):
            self.log_print(f"  User {i}: {age}{gender}, plays {', '.join(games)}")
        
        self.refresh_user_lists()

    def on_add_positive(self):
        """Handle adding a positive interaction."""
        u_idx = self._get_selected_index(self.u_list)
        v_idx = self._get_selected_index(self.v_list)
        if u_idx is None or v_idx is None:
            messagebox.showerror("Select users", "Select U and V users first.")
            return
        if u_idx == v_idx:
            messagebox.showerror("Invalid pair", "u and v must be different users.")
            return
        self.dat.add_positive(u_idx, v_idx)
        self.pos_list.insert(tk.END, f"({u_idx},{v_idx})")
        self.log_print(f"Added POS ({u_idx},{v_idx})")

    def on_add_negative(self):
        """Handle adding a negative interaction."""
        u_idx = self._get_selected_index(self.u_list)
        v_idx = self._get_selected_index(self.v_list)
        if u_idx is None or v_idx is None:
            messagebox.showerror("Select users", "Select U and V users first.")
            return
        if u_idx == v_idx:
            messagebox.showerror("Invalid pair", "u and v must be different users.")
            return
        self.dat.add_negative(u_idx, v_idx)
        self.neg_list.insert(tk.END, f"({u_idx},{v_idx})")
        self.log_print(f"Added NEG ({u_idx},{v_idx})")

    def on_train(self):
        """Handle model training."""
        if len(self.dat.users) < 3:
            messagebox.showerror("Not enough users", "Add at least 3 users.")
            return
        if len(self.dat.interactions.positives) < 1:
            messagebox.showerror("No positives", "Add at least one positive (u,v).")
            return
        
        epochs = self.epochs_var.get()
        try:
            self.log_print("Training with V6 EXTREME - OPTIMAL PARAMETERS:")
            self.log_print("  - Age embedding: 32-dim (CRITICAL for age learning!)")
            self.log_print("  - Learning rate: 1e-4 (stable convergence)")
            self.log_print("  - Batch size: 16 (precise gradients)")
            self.log_print("  - Focal InfoNCE loss + Multi-objective training")
            self.log_print("  - Weighted sampling for class balance")
            
            self.model = train_model_v6_extreme(
                self.dat,
                epochs=epochs,
                lr=1e-4,  # OPTIMAL: Stable and fast
                batch_size=16,  # OPTIMAL: Precise gradients
                device=None,
                log_fn=self.log_print,
                dropout=0.3,
                use_scheduler=True,
                focal_gamma=2.0,
                rejection_weight=0.5,
                intersection_weight=0.3,
                use_weighted_sampling=True,  # CRITICAL: Class balance
                emb_age_dim=32,  # CRITICAL: Doubled from 16!
                emb_user_dim=64,
                game_emb_dim=64,
                tower_hidden=(512, 256, 128),
                out_dim=128,
                temperature=0.07
            )
            self.log_print("Training finished with V6 EXTREME - OPTIMAL!")
        except Exception as e:
            messagebox.showerror("Training error", str(e))

    def on_recommend(self):
        """Handle generating recommendations."""
        if self.model is None:
            messagebox.showerror("No model", "Train the model first.")
            return
        
        idx = self._get_selected_index(self.rec_user_list)
        if idx is None:
            messagebox.showerror("Select user", "Select a user to recommend for.")
            return
        
        K = self.k_var.get()
        pairs = topk_recommend_v6(self.model, self.dat, idx, K=K, use_rejection_filter=False)
        if not pairs:
            self.log_print("No recommendations (not enough users).")
            return
        
        lines = [f"{idx} → top-{K}:"]
        for (vid, sc) in pairs:
            lines.append(f"  candidate {vid:2d} | score={sc:+.4f}")
        self.log_print("\n".join(lines))

