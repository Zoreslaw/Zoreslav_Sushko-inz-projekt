# TeamUp - Project Documentation

## Project Description

TeamUp is a full-stack team matching application implemented as a microservices architecture. The system consists of a React Native mobile application for iOS and Android platforms, a .NET backend API providing RESTful services, and a Python-based machine learning service utilizing a Two-Tower V6 neural network architecture for generating user recommendations.

### System Architecture

The application is organized into the following components:

- **Mobile Application**: React Native application built with Expo framework, providing cross-platform support for iOS and Android devices
- **Backend API**: ASP.NET Core 9.0 Web API implementing RESTful endpoints for user management and data operations
- **Machine Learning Service**: Flask-based service implementing neural network inference for recommendation generation
- **Database**: PostgreSQL database for persistent data storage
- **Cache Layer**: Redis implementation for performance optimization
- **ML Administration Dashboard**: Web-based interface for monitoring and managing the machine learning system
- **Database Management Interface**: pgAdmin web interface for database administration

## Prerequisites

Before proceeding with the installation and execution of the system, the following software components must be installed:

- **Docker Desktop**: Required for containerized deployment of backend services
  - Download: https://www.docker.com/products/docker-desktop
- **Node.js**: Version 18 or higher, required for running the React Native client application
- **.NET 9.0 SDK**: Optional, required only for local backend development without Docker containers

## System Installation and Execution

### Method 1: Docker-Based Deployment (Recommended)

This method deploys all backend services using Docker containers:

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Execute Docker Compose to build and start all services:
   ```bash
   docker-compose up --build
   ```

3. Wait for services to initialize (approximately 30-60 seconds)

4. Verify service status:
   ```bash
   docker-compose ps
   ```

### Method 2: Individual Service Deployment

#### Backend Services Only

To start only the backend infrastructure services:

```bash
cd server
docker-compose up postgres redis backend ml-service
```

#### Mobile Client Application

To start the React Native mobile application:

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install required dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npm start
   ```

4. Launch the application:
   - For Android emulator: Press `a`
   - For iOS simulator: Press `i`
   - For physical device: Scan the displayed QR code using the Expo Go application

5. Configure API endpoint:
   - Edit `client/config/constants.ts` and set the backend URL
   - For emulator/simulator: Use `http://localhost:5001`
   - For physical device: Use the host machine's IP address (e.g., `http://192.168.1.100:5001`)

### Production Build

To generate production builds of the mobile application:

```bash
# Development build
npm run build-development

# Production build
npm run build-production
```

## Service Endpoints

After successful deployment, the following services are accessible:

| Service | URL | Description |
|--------|-----|-------------|
| Backend API | http://localhost:5001 | Main REST API |
| Swagger Documentation | http://localhost:5001/swagger | Interactive API documentation |
| ML Service | http://localhost:5000 | Machine learning recommendation API |
| ML Admin Dashboard | http://localhost:3000 | ML system monitoring interface |
| ML Admin API | http://localhost:6000 | ML administration REST API |
| pgAdmin | http://localhost:5050 | Database management interface |
| PostgreSQL | localhost:5432 | Database server |
| Redis | localhost:6379 | Cache server |

**pgAdmin Access Credentials:**
- Email: `admin@admin.com`
- Password: `admin`

## System Verification

### Backend API Testing

Execute the following commands to verify backend functionality:

```bash
# Retrieve all users
curl http://localhost:5001/api/users

# Retrieve specific user by ID
curl http://localhost:5001/api/users/user-001

# Access Swagger UI
# Navigate to http://localhost:5001/swagger in web browser
```

### Machine Learning Service Testing

```bash
# Health check endpoint
curl http://localhost:5000/health

# Model information endpoint
curl http://localhost:5000/ml/model-info
```

### ML Admin Dashboard Access

Access the ML Admin Dashboard by navigating to http://localhost:3000 in a web browser.

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
│   ├── network/               # Machine learning neural network implementation
│   │   ├── models/            # Neural network model definitions
│   │   ├── training/          # Model training scripts
│   │   └── data/              # Training dataset files
│   │
│   ├── ml-service/            # ML inference service (Flask)
│   ├── ml-training/           # ML model training service
│   ├── ml-admin/              # ML administration dashboard and API
│   └── docker-compose.yml     # Docker orchestration configuration
│
└── README.md                   # This documentation file
```

## Configuration

### Database Connection Configuration

When using Docker, the backend automatically connects to PostgreSQL. For local development without Docker, modify the connection string in `server/TeamUp.Api/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=teamup;Username=teamup_user;Password=teamup_password"
  }
}
```

### Machine Learning Service Configuration

ML service parameters are configured in `server/docker-compose.yml`:
- Model file path: `/shared/models/twotower_v6_optimal.pt`
- Automatic training interval: 8 hours
- Minimum users required for training: 10
- Minimum interactions required for training: 5

## Docker Container Management

The following commands are used for managing Docker containers:

```bash
# Start all services in detached mode
docker-compose up -d

# Stop all services
docker-compose down

# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f ml-service
docker-compose logs -f ml-trainer

# Rebuild specific service
docker-compose build backend
docker-compose up -d backend

# Restart all services
docker-compose restart

# Check service status
docker-compose ps

# Remove all containers and volumes
docker-compose down -v
```

## Database Administration

### pgAdmin Interface

1. Access pgAdmin at http://localhost:5050
2. Authenticate using credentials:
   - Email: `admin@admin.com`
   - Password: `admin`
3. Add server connection:
   - Host: `postgres`
   - Port: `5432`
   - Database: `teamup`
   - Username: `teamup_user`
   - Password: `teamup_password`

### Command Line Database Access

```bash
# Connect to PostgreSQL container
docker exec -it teamup-postgres psql -U teamup_user -d teamup

# List database tables
\dt

# Execute SQL query
SELECT * FROM users LIMIT 10;
```

## Machine Learning System

### Automatic Model Training

The machine learning model is automatically trained under the following conditions:
- Upon system startup, if sufficient data exists
- Periodically every 8 hours
- Minimum requirements: 10 or more users, 5 or more user interactions

### Manual Training Initiation

Training can be initiated manually through two methods:

**Method 1: Administration Dashboard**
1. Access http://localhost:3000
2. Select "Trigger Manual Training" option

**Method 2: REST API**
```bash
curl -X POST http://localhost:6000/api/training/trigger
```

### Test Data Generation

Test user data can be generated using the following methods:

**Via Swagger UI:**
1. Access http://localhost:5001/swagger
2. Execute POST request to `/api/Users/random?count=50`

**Via Command Line:**
```bash
curl -X POST "http://localhost:5001/api/Users/random?count=50"
```

### Recommendation Retrieval

User recommendations can be obtained using:

**Via Swagger UI:**
POST request to `/api/Users/recommendations/{userId}?topK=10`

**Via Command Line:**
```bash
curl -X POST "http://localhost:5001/api/Users/recommendations/user-001?topK=10"
```

## Troubleshooting

### Service Startup Issues

If services fail to start:

```bash
# Verify Docker Desktop is running
docker ps

# Review service logs
docker-compose logs

# Rebuild and restart all services
docker-compose down
docker-compose up --build
```

### Port Conflict Resolution

If port conflicts occur, modify port mappings in `server/docker-compose.yml`:

```yaml
ports:
  - "5002:8080"  # Changed from default 5001
```

### Database Connection Errors

```bash
# Verify PostgreSQL container status
docker ps | grep postgres

# Verify connection string configuration
# Note: Use "postgres" as hostname in Docker environment
# Use "localhost" for local development without Docker
```

### Machine Learning Service Issues

```bash
# Review ML service logs
docker-compose logs ml-service

# Verify model file existence
docker exec -it teamup-ml-service ls -la /shared/models/

# Restart ML service
docker-compose restart ml-service
```

### Mobile Client Connection Issues

1. **For emulator/simulator**: Configure API endpoint as `http://localhost:5001`
2. **For physical device**: 
   - Determine host machine IP address: `ipconfig` (Windows) or `ifconfig` (macOS/Linux)
   - Configure `client/config/constants.ts` with `http://YOUR_IP:5001`
   - Ensure firewall allows connections on port 5001

### Complete System Reset

To reset the entire system:

```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Remove all container images
docker-compose down --rmi all

# Perform fresh installation
docker-compose up --build
```

## API Endpoint Reference

### Users API Endpoints

- `GET /api/users` - Retrieve all users
- `GET /api/users/{id}` - Retrieve user by identifier
- `POST /api/users/random?count={n}` - Generate random test users
- `POST /api/users/recommendations/{userId}?topK={n}` - Retrieve user recommendations

### Machine Learning Service Endpoints

- `GET /health` - Service health check
- `GET /ml/model-info` - Model information retrieval
- `POST /ml/recommend` - Recommendation generation (internal use)
- `POST /ml/batch-embed` - Batch embedding generation (internal use)

### ML Administration API Endpoints

- `GET /health` - Service health check
- `GET /api/stats` - System statistics retrieval
- `GET /api/training/logs` - Training log retrieval
- `POST /api/training/trigger` - Manual training initiation

## Default System Credentials

**PostgreSQL Database:**
- Database name: `teamup`
- Username: `teamup_user`
- Password: `teamup_password`

**pgAdmin Interface:**
- Email: `admin@admin.com`
- Password: `admin`

**Note:** These default credentials should be changed in production deployments.

## Development Procedures

### Backend Development

1. Modify .NET code in `server/TeamUp.Api/`
2. Rebuild container: `docker-compose build backend`
3. Restart service: `docker-compose restart backend`
4. Monitor logs: `docker-compose logs -f backend`

### Client Application Development

1. Modify React Native code in `client/`
2. Expo automatically reloads changes on save
3. For native module changes, rebuild: `npm run android` or `npm run ios`

### Machine Learning Model Updates

1. Model training occurs automatically every 8 hours
2. Training can be initiated manually via dashboard or API
3. New model files are automatically loaded by the ML service

## Production Deployment Considerations

### Environment Variables

Configure the following environment variables for production:

```bash
# PostgreSQL
POSTGRES_PASSWORD=<strong-password>

# Backend
ASPNETCORE_ENVIRONMENT=Production

# ML Service
FLASK_ENV=production
```

### Security Checklist

- [ ] Change all default passwords
- [ ] Implement HTTPS/TLS encryption
- [ ] Configure CORS policies appropriately
- [ ] Implement authentication (JWT tokens)
- [ ] Configure logging and monitoring systems
- [ ] Implement secrets management for credentials
- [ ] Establish database backup procedures

## System Verification Checklist

The system is functioning correctly when:

- All Docker containers report healthy status
- Swagger UI is accessible at http://localhost:5001/swagger
- ML service health check returns `{"status": "healthy"}` at http://localhost:5000/health
- ML Admin Dashboard is accessible at http://localhost:3000
- Mobile application successfully connects to backend API
- Recommendation endpoints return valid results

---

**Document Version:** 1.0  
**Last Updated:** 2025
