# TeamUp - Project Documentation

## Project Description

TeamUp is a full-stack team matching application implemented as a microservices architecture. The system consists of a React Native mobile application, a .NET backend API, and two recommendation services: a Two-Tower V6 neural network service and a Content-Based recommendation service using sparse feature vectors.

### System Architecture

The application is organized into the following components:

- **Mobile Application**: React Native application (Expo framework)
- **Backend API**: ASP.NET Core 9.0 Web API
- **ML Service**: Flask-based Two-Tower V6 neural network service
- **CB Service**: FastAPI-based Content-Based recommendation service
- **Database**: PostgreSQL
- **Cache**: Redis
- **ML Admin Dashboard**: Web interface for monitoring and algorithm selection
- **pgAdmin**: Database administration interface

## Prerequisites

- Docker Desktop: https://www.docker.com/products/docker-desktop
- Node.js 18+ (for mobile app)
- .NET 9.0 SDK (optional, for local backend development)

## System Installation and Execution

### Docker Deployment

```bash
cd server
docker-compose up --build
```

Wait 30-60 seconds for services to initialize. Verify with `docker-compose ps`.

### Mobile Client

```bash
cd client
npm install
npm start
```

- Android emulator: Press `a`
- iOS simulator: Press `i`
- Physical device: Scan QR code with Expo Go

Configure API endpoint in `client/config/constants.ts`:
- Emulator/simulator: `http://localhost:5001`
- Physical device: `http://YOUR_IP:5001`

## Service Endpoints

After successful deployment, the following services are accessible:

| Service | URL | Description |
|--------|-----|-------------|
| Backend API | http://localhost:5001 | Main REST API |
| Swagger | http://localhost:5001/swagger | API documentation |
| ML Service | http://localhost:5000 | Two-Tower neural network service |
| CB Service | http://localhost:5002 | Content-Based recommendation service |
| ML Admin Dashboard | http://localhost:3000 | Monitoring and algorithm selection |
| ML Admin API | http://localhost:6000 | ML administration API |
| pgAdmin | http://localhost:5050 | Database management |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |

**pgAdmin Access Credentials:**
- Email: `admin@admin.com`
- Password: `admin`

## Verification

```bash
# Backend API
curl http://localhost:5001/api/users

# ML Service
curl http://localhost:5000/health

# CB Service
curl http://localhost:5002/health

# Algorithm management
curl http://localhost:5001/api/users/algorithm
curl -X POST http://localhost:5001/api/users/algorithm -H "Content-Type: application/json" -d '{"algorithm": "ContentBased"}'
```

Access Swagger UI: http://localhost:5001/swagger  
Access ML Admin Dashboard: http://localhost:3000

## Project Structure

The project is organized according to the following directory structure:

```
TeamUpProject/
├── client/                      # React Native mobile application
│   ├── app/                    # Expo Router page components
│   ├── components/            # Reusable React components
│   ├── config/                 # Application configuration files
│   ├── hooks/                 # Custom React hooks
│   └── package.json
│
├── server/                     # Backend services
│   ├── TeamUp.Api/            # .NET Web API project
│   │   ├── Controllers/       # API endpoint controllers
│   │   ├── Models/            # Data models
│   │   ├── Data/              # Database context and migrations
│   │   ├── Services/          # Business logic services
│   │   └── Migrations/         # Entity Framework Core migrations
│   │
│   ├── network/               # ML neural network implementation
│   │   ├── models/            # Neural network model definitions
│   │   ├── training/          # Model training scripts
│   │   └── data/              # Training dataset files
│   │
│   ├── ml-service/            # Two-Tower ML service (Flask)
│   ├── cb-service/            # Content-Based service (FastAPI)
│   ├── ml-training/           # ML model training service
│   ├── ml-admin/              # ML administration dashboard and API
│   └── docker-compose.yml     # Docker orchestration
│
└── README.md                   # This documentation file
```

## Configuration

### Algorithm Selection

Two recommendation algorithms available:
- **TwoTower**: Neural network (default)
- **ContentBased**: Feature-based similarity

Change via:
- Dashboard: http://localhost:3000
- API: `POST /api/users/algorithm` with `{"algorithm": "TwoTower"}` or `{"algorithm": "ContentBased"}`

### ML Training

Configured in `server/docker-compose.yml`:
- Training interval: 8 hours
- Min users: 10
- Min interactions: 5

## Docker Commands

```bash
# Start/stop
docker-compose up -d
docker-compose down

# Logs
docker-compose logs -f [service-name]

# Rebuild service
docker-compose build [service-name]
docker-compose up -d [service-name]

# Status
docker-compose ps
```

## Database Access

**pgAdmin:** http://localhost:5050
- Email: `admin@admin.com`
- Password: `admin`
- Server: `postgres:5432`, Database: `teamup`, User: `teamup_user`, Password: `teamup_password`

**Command line:**
```bash
docker exec -it teamup-postgres psql -U teamup_user -d teamup
```

## ML Training

Automatic training: every 8 hours (min 10 users, 5 interactions)

Manual trigger:
```bash
curl -X POST http://localhost:6000/api/training/trigger
```

## Test Data

```bash
# Generate random users
curl -X POST "http://localhost:5001/api/users/random?count=50"

# Get recommendations
curl -X POST "http://localhost:5001/api/users/recommendations/user-001?topK=10"
```

## Troubleshooting

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs [service-name]

# Restart service
docker-compose restart [service-name]

# Rebuild service
docker-compose build [service-name]
docker-compose up -d [service-name]

# Full reset
docker-compose down -v
docker-compose up --build
```

## API Endpoint Reference

### Backend API Endpoints

- `GET /api/users` - Get all users
- `GET /api/users/{id}` - Get user by ID
- `POST /api/users/random?count={n}` - Generate random users
- `POST /api/users/recommendations/{userId}?topK={n}` - Get recommendations (uses current algorithm)
- `GET /api/users/algorithm` - Get current algorithm
- `POST /api/users/algorithm` - Set algorithm (`{"algorithm": "TwoTower"}` or `{"algorithm": "ContentBased"}`)

### ML Service Endpoints

- `GET /health` - Health check
- `GET /ml/model-info` - Model information
- `POST /ml/recommend` - Generate recommendations (internal)

### CB Service Endpoints

- `GET /health` - Health check
- `GET /ml/model-info` - Featurizer state information
- `POST /ml/recommend` - Generate recommendations (internal)

### ML Admin API Endpoints

- `GET /api/stats` - System statistics
- `GET /api/training/logs` - Training logs
- `POST /api/training/trigger` - Trigger training
- `GET /api/algorithm` - Get current algorithm
- `POST /api/algorithm` - Set algorithm

## Credentials

- PostgreSQL: `teamup_user` / `teamup_password`
- pgAdmin: `admin@admin.com` / `admin`

**Note:** Change defaults for production.

## Development

**Backend:**
```bash
docker-compose build backend
docker-compose restart backend
docker-compose logs -f backend
```

**Client:** Expo auto-reloads on save

**ML Training:** Automatic every 8 hours, or trigger manually via dashboard/API

## System Verification Checklist

System is functioning correctly when:

- All Docker containers are healthy
- Swagger UI accessible at http://localhost:5001/swagger
- ML service health: `curl http://localhost:5000/health`
- CB service health: `curl http://localhost:5002/health`
- ML Admin Dashboard accessible at http://localhost:3000
- Recommendation endpoints return valid results

---

**Document Version:** 1.0  
**Last Updated:** 2025
