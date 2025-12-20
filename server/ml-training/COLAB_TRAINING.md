# Colab Training (CSV -> TwoTower V6)

Use this guide to train the model in Google Colab and upload the output to the ML admin dashboard.

## Dataset format
Required CSV headers (case-insensitive):
`id, age, gender, favorite_games, liked, disliked`

Optional headers are ignored by the trainer. `favorite_games`, `liked`, and `disliked` accept JSON arrays
or comma-separated strings.

Canonical game tokens:
`dota2, cs2, valorant, lol, apex, overwatch2, fortnite, pubg, rocketleague, minecraft, hoi4, rust, phasmophobia, battlefield1, gta5rp`

Common aliases that are auto-normalized:
- CS:GO -> cs2
- Counter-Strike 2 -> cs2
- Dota 2 -> dota2
- League of Legends -> lol
- Apex Legends -> apex
- Overwatch -> overwatch2
- Hearts of Iron IV -> hoi4
- BF1 -> battlefield1
- GTA V -> gta5rp

## Colab steps
1. Open Colab and switch runtime to GPU (Runtime -> Change runtime type -> GPU).
2. Upload your CSV dataset to `/content` or mount Drive.
3. Bring in the training script and network package.

Option A (recommended): clone the repo
```
!git clone <YOUR_REPO_URL> teamup
%cd /content/teamup/server/ml-training
```

Option B: upload files manually
- Upload `server/ml-training/train_from_csv.py`
- Upload `server/network/` folder
- Place them under `/content/teamup/server/` so the paths match:
  - `/content/teamup/server/ml-training/train_from_csv.py`
  - `/content/teamup/server/network/`
```
%cd /content/teamup/server/ml-training
```

4. Install dependencies:
```
!pip install -q torch==2.0.1 numpy==1.24.3
```

5. Train and export a collab-tagged model:
```
!python train_from_csv.py \
  --csv-path /content/your-dataset.csv \
  --output-dir /content/models \
  --epochs 80 \
  --batch-size 16 \
  --lr 1e-4 \
  --tag collab
```

Output file example:
`/content/models/twotower_v6_YYYYMMDD_HHMMSS_collab.pt`

6. Download the model from Colab:
```
!ls /content/models
from google.colab import files
files.download("/content/models/twotower_v6_YYYYMMDD_HHMMSS_collab.pt")
```

## Upload and activate in local dashboard
1. Copy the file into the shared models volume:
```
docker cp twotower_v6_YYYYMMDD_HHMMSS_collab.pt teamup-ml-admin-api:/shared/models/
```
2. Activate the model via ML admin API:
```
curl -X POST http://localhost:6000/api/models/YYYYMMDD_HHMMSS_collab/activate
```
3. Refresh the ML admin dashboard and verify the active model.
