#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matchmaking Two‑Tower Prototype (v2)

A PyTorch-based matchmaking system using two-tower neural networks
with BPR (Bayesian Personalized Ranking) loss for learning user preferences.

Features:
- User profile management (age, gender, game preferences)
- Positive/negative interaction labeling
- Two-tower neural network architecture
- BPR-based training
- Top-K recommendations
- CSV import/export

Academic References:
- Goodfellow, Bengio, Courville (2016) Deep Learning. MIT Press.
- Rendle (2009) BPR: Bayesian Personalized Ranking from Implicit Feedback. UAI.
- Covington et al. (2016) Deep Neural Networks for YouTube Recommendations. RecSys.
"""

from ui.app import App


def main():
    """Launch the matchmaking application."""
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
