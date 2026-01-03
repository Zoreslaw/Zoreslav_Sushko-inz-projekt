# TeamUp

TeamUp is a full-stack team matching application built around an Expo React Native client, a .NET 9 backend API, and two recommendation engines (Two-Tower neural model and a content-based model). The backend owns auth, profiles, swipes, matches, chat, and metrics while orchestrating ML inference and training. A separate ML admin API + dashboard provides training control, model management, and system monitoring.

## Contents
- Overview
- Architecture
- Services and ports
- Core flows
- Repository layout
- Setup and run
- Configuration
- API overview
- ML admin and training
- Data model
- Troubleshooting and tips
- Production notes

## Overview
- Mobile app: Expo + Expo Router UI for login, profile editing, swiping, matches, and chat.
- Backend: ASP.NET Core Web API with JWT auth, PostgreSQL persistence, and REST endpoints for the client.
- ML services:
  - Two-Tower hybrid model (Flask + PyTorch) for learned embeddings and ranking.
  - Content-based recommender (FastAPI) for sparse feature matching.
  - Hybrid blending in the backend combines both plus preference and interaction signals.
- Training: Scheduled trainer that retrains the Two-Tower model from production data and stores models in a shared volume.
- Admin: ML admin API (Flask) and dashboard (React) for metrics, logs, and model operations.

## Architecture
High-level data path:

```
Mobile App
  -> Backend API (.NET)
      -> PostgreSQL (users, interactions, chat, tokens)
      -> Two-Tower ML Service (inference)
      -> Content-Based Service (inference)
      -> Redis (training log streams)
  <- Recommendations + Chat + Profile

ML Trainer (scheduled)
  -> PostgreSQL (training data)
  -> /shared/models (twotower_v6_optimal.pt)
  -> /shared/logs (training.log + current_training.log)

ML Admin API
  -> Reads logs/models
  -> Triggers training and model activation
  -> Calls ML Service reload endpoint

ML Admin Dashboard
  -> ML Admin API
```

## Services and ports
All services are orchestrated via `server/docker-compose.yml`.

| Service | Tech | Path | Port (host -> container) | Purpose |
| --- | --- | --- | --- | --- |
| backend | ASP.NET Core 9 | `server/TeamUp.Api` | `5001 -> 8080` | REST API, auth, profile, matches, chat |
| postgres | PostgreSQL 16 | Docker image | `5433 -> 5432` | Primary database |
| redis | Redis 7 | Docker image | `6379 -> 6379` | Training log streams |
| ml-service | Flask + PyTorch | `server/network/ml-service` | `5000 -> 5000` | Two-Tower inference |
| cb-service | FastAPI | `server/cb-service` | `5002 -> 5001` | Content-based inference |
| ml-trainer | Python | `server/ml-training` | none | Scheduled model training |
| ml-admin-api | Flask | `server/ml-admin` | `6000 -> 6000` | Training control, metrics, model mgmt |
| ml-admin-dashboard | React | `server/ml-admin/dashboard` | `3000 -> 80` | Admin UI |
| pgadmin | pgAdmin 4 | Docker image | `5050 -> 80` | DB admin UI |

Web UIs:
- Swagger: `http://localhost:5001/swagger`
- ML Admin Dashboard: `http://localhost:3000`
- pgAdmin: `http://localhost:5050` (admin@admin.com / admin)

## Core flows
### Authentication and profile
- The app uses JWT access tokens + refresh tokens stored in AsyncStorage.
- Auth endpoints are under `api/auth/*` and return access + refresh tokens.
- Profile endpoints (`api/profile/*`) require JWT auth and manage user data.

### Swipes, matches, and chat
- `api/matches` returns candidate matches. The backend filters out self, liked, disliked, and users who disliked the current user.
- Swiping:
  - `POST /api/matches/like` adds a like, and if mutual, creates a conversation and pushes a notification.
  - `POST /api/matches/dislike` adds a dislike.
- Conversations and messages:
  - `api/conversations/*` manages 1:1 chats, unread counts, and read receipts.
  - `api/media/messages` uploads message images (stored under `uploads/messages`).

### Recommendation pipeline
- Algorithm selection is in-memory (`TwoTower`, `ContentBased`, or `Hybrid`) and resets on backend restart.
- Candidate construction excludes the requesting user, already liked/disliked users, and users who disliked the requester.
- Execution:
  - TwoTower: `ml-service` scores candidates using the TwoTowerHybrid model (age, gender, games, categories, languages, user hash).
  - ContentBased: `cb-service` scores candidates using sparse feature vectors + cosine similarity; rebuilds vocab if needed.
  - Hybrid: backend blends normalized scores from both services plus preference and interaction features.
- Hybrid weights are configured in `server/TeamUp.Api/appsettings.json` under `HybridRecommendation`.
- Matches fallback to a basic similarity scorer if ML services are unavailable.

### Training pipeline
- `ml-trainer` runs `scheduler.py` and retrains on a fixed interval.
- Training pulls users + interactions from Postgres and writes:
  - `twotower_v6_optimal.pt` to `/shared/models`
  - `training.log` and `current_training.log` to `/shared/logs`
- Minimum data thresholds are enforced before training (see `MIN_USERS`, `MIN_INTERACTIONS`).
- Logs stream through Redis to the ML Admin API for live updates.

### Steam integration
- Optional Steam profile connection for game and category data.
- Requires `Steam:ApiKey` in backend config.
- Endpoints: `/api/steam/connect`, `/api/steam/sync`, `/api/steam/disconnect`, `/api/steam/catalog`.

### Notifications and presence
- Expo push notifications are supported; device tokens are registered via `api/notifications/*`.
- The client sends presence heartbeats every 30s when authenticated.
- Android push is disabled in the client until Firebase/FCM is configured.

## Repository layout
```
TeamUpProject/
├── client/                  # Expo React Native app
│   ├── app/                 # Expo Router screens
│   ├── components/          # UI components
│   ├── services/            # API client wrapper
│   ├── hooks/               # Push notifications, etc.
│   ├── contexts/            # Auth + presence state
│   └── config/              # Backend URL + OpenAI key
├── server/
│   ├── TeamUp.Api/          # ASP.NET Core API
│   ├── network/             # Two-Tower model + ML service
│   ├── cb-service/          # Content-based ML service
│   ├── ml-training/         # Scheduled training
│   ├── ml-admin/            # Admin API + dashboard
│   ├── docker-compose.yml   # Full stack orchestration
│   └── docker-compose.override.yml # Dev overrides
└── README.md
```

## Setup and run
### Prerequisites
- Docker Desktop
- Node.js 18+
- .NET 9 SDK (optional for local backend dev)

### Start backend + ML stack (Docker)
```bash
cd server
docker-compose up --build
```

Check health:
```bash
docker-compose ps
curl http://localhost:5001/swagger
curl http://localhost:5000/health
curl http://localhost:5002/health
```

### Build the mobile app with EAS (required for device testing)
This project uses a custom Expo development client. You must build and install it once before using `npm start` for local debugging.

1) Create an Expo account:
- Sign up at `https://expo.dev/signup`.

2) Install and log in to EAS:
```bash
npm install -g eas-cli
eas login
```

3) Link or create the Expo project:
```bash
cd client
eas init
```
- This will connect the repo to an Expo project and update the EAS project ID.
- If you move to a new Expo project, update `extra.eas.projectId` in `client/app.config.js`.

4) Set app identifiers (important for credentials):
- iOS: `ios.bundleIdentifier` in `client/app.config.js`
- Android: `android.package` in `client/app.config.js`

5) Configure build credentials:
- iOS requires an Apple Developer account; EAS will prompt for App Store Connect credentials.
- Android uses a keystore; EAS can generate one or you can provide your own.
- Manage or rotate credentials via `eas credentials` and the Expo dashboard.

6) Set runtime environment variables:
- For development builds, set `EXPO_PUBLIC_BACKEND_URL` to your local machine IP.
- Use the Expo dashboard or `eas secret:create` for sensitive values.

7) Build a development client:
```bash
cd client
npm run build-development
# or
eas build --profile development --platform android
eas build --profile development --platform ios
```

8) Install the build on your device/emulator:
- Use the install link or QR code from the build on `https://expo.dev/accounts/<your-account>/projects`.

### Start the mobile client (after a dev build is installed)
```bash
cd client
npm install
npm start
```

`npm start` runs `expo start --dev-client`. Open the installed development build and connect to the Metro server.

Configure backend URL for the app in `client/config/constants.ts` (or set `EXPO_PUBLIC_BACKEND_URL`):
- Local machine: `http://localhost:5001`
- Android emulator: `http://10.0.2.2:5001`
- Physical device: `http://YOUR_LAN_IP:5001`

### Production builds (EAS)
```bash
cd client
npm run build-production
# or
eas build --profile production --platform android
eas build --profile production --platform ios
```

Optional submit to stores:
```bash
eas submit --profile production --platform android
eas submit --profile production --platform ios
```

### Optional: run backend locally (no Docker)
```bash
cd server/TeamUp.Api
dotnet restore
dotnet run
```
- Update `server/TeamUp.Api/appsettings.Development.json` if Postgres runs on a different host/port.

### Optional: dashboard dev mode
`docker-compose` loads `docker-compose.override.yml` automatically, which adds a live-reload dashboard container on port 3000. Remove the override or change the port if you want the static dashboard instead.

## Configuration
### Client (Expo)
- `EXPO_PUBLIC_BACKEND_URL` (preferred) or edit `client/config/constants.ts`.
- `EXPO_PUBLIC_OPENAI_API_KEY` to enable `getDescriptionSynergy` (optional).
- EAS build profiles live in `client/eas.json` (`development`, `preview`, `production`).
- App identifiers and Expo project ID live in `client/app.config.js` (`ios.bundleIdentifier`, `android.package`, `extra.eas.projectId`).

### Backend (.NET)
- `server/TeamUp.Api/appsettings.json`:
  - `ConnectionStrings:DefaultConnection`
  - `Jwt:Secret`, `Jwt:Issuer`, `Jwt:Audience`
  - `MLService:BaseUrl`, `CBService:BaseUrl`
  - `HybridRecommendation` weights and limits
  - `Steam:*` settings
- `ASPNETCORE_ENVIRONMENT=Development` and `ASPNETCORE_URLS=http://+:8080` are set in docker-compose.

### ML Service (Two-Tower)
- `MODEL_PATH` (default `/shared/models/twotower_v6_optimal.pt`)

### Content-Based Service
- `BACKEND_URL` (default `http://backend:8080`)

### ML Trainer
- `TRAINING_INTERVAL_HOURS` (docker-compose sets `24`)
- `TRAIN_ON_START` (docker-compose sets `false`)
- `MIN_USERS`, `MIN_INTERACTIONS`
- `DB_*`, `MODEL_PATH`, `LOG_PATH`, `REDIS_URL`

### ML Admin API
- `ML_SERVICE_URL`, `CB_SERVICE_URL`, `BACKEND_URL`
- `MODEL_PATH`, `LOG_PATH`, `REDIS_URL`

## API overview
Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Profiles:
- `GET /api/profile` (current user)
- `GET /api/profile/{id}` (public profile)
- `PUT /api/profile` (update)
- `GET /api/profile/stats`
- `POST /api/profile/avatar`

Matches and swipes:
- `GET /api/matches`
- `POST /api/matches/like`
- `POST /api/matches/dislike`

Conversations and messages:
- `GET /api/conversations`
- `GET /api/conversations/{id}`
- `POST /api/conversations`
- `GET /api/conversations/{id}/messages`
- `POST /api/conversations/{id}/messages`
- `POST /api/conversations/{id}/messages/read`

Notifications and presence:
- `POST /api/notifications/devices`
- `POST /api/notifications/devices/unregister`
- `GET /api/presence/{userId}`
- `POST /api/presence`
- `POST /api/presence/heartbeat`

Media:
- `POST /api/media/messages`

Users and interactions (admin/test):
- `GET /api/users`
- `GET /api/users/{id}`
- `POST /api/users/create`
- `POST /api/users/{id}/update`
- `DELETE /api/users/{id}`
- `POST /api/users/{id}/interactions`
- `POST /api/users/{id}/interactions/clear`
- `POST /api/users/interactions/purge`

Recommendations and evaluation:
- `POST /api/users/recommendations/{userId}?topK=10`
- `GET /api/users/algorithm`
- `POST /api/users/algorithm`
- `POST /api/users/metrics/{userId}`
- `GET /api/users/metrics/aggregate`
- `GET /api/users/metrics/compare`

Data seeding and datasets:
- `POST /api/users/random`
- `POST /api/users/random/bulk`
- `POST /api/users/generate-interactions`
- `POST /api/users/upload-dataset`

Steam (optional):
- `POST /api/steam/connect`
- `POST /api/steam/sync`
- `POST /api/steam/disconnect`
- `GET /api/steam/catalog?type=games|categories`

Note: `/api/users/*` and `/api/admin/*` endpoints are currently unauthenticated in code. Treat them as admin-only in production.

## ML admin and training
ML Admin API base: `http://localhost:6000`

Key endpoints:
- `GET /api/training/status`, `/api/training/logs`, `/api/training/logs/stream`
- `POST /api/training/trigger`, `/api/training/stop`
- `GET /api/models/history`, `POST /api/models/<version>/activate`, `POST /api/models/upload`
- `GET /api/algorithm`, `POST /api/algorithm` (proxy to backend)

ML Admin Dashboard: `http://localhost:3000`

## Data model (PostgreSQL)
Main tables are defined in `server/TeamUp.Api/Models`:
- `Users` (profile, preferences, liked/disliked, Steam data)
- `Conversations`, `ConversationParticipants`, `Messages`
- `RefreshTokens` (JWT refresh)
- `DeviceTokens` (Expo push)
- `UserPresences`

## Troubleshooting and tips
- If the mobile app cannot reach the API, set `EXPO_PUBLIC_BACKEND_URL` to your LAN IP and restart Expo.
- If recommendations fail, check `ml-service` and `cb-service` health endpoints.
- Training runs only when `MIN_USERS` and `MIN_INTERACTIONS` are satisfied.
- `uploads/` is stored in the backend container; add a volume if you need persistent media.

## Production notes
- Replace default JWT secrets and database credentials.
- Secure admin endpoints (`/api/users/*`, `/api/admin/*`).
- Configure proper storage for uploaded media.
- For Android push, set up Firebase/FCM and update the Expo config.
