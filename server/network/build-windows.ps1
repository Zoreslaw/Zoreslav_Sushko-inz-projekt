# Windows PowerShell Build Script for TeamUp Server
# This is the Windows equivalent of the Makefile

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

function Show-Help {
    Write-Host ""
    Write-Host "TeamUp Server - Windows Build Commands" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\build-windows.ps1 <command>" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Available commands:" -ForegroundColor Green
    Write-Host "  prepare     - Prepare ML service files" -ForegroundColor White
    Write-Host "  build       - Build all Docker images" -ForegroundColor White
    Write-Host "  up          - Start all services" -ForegroundColor White
    Write-Host "  down        - Stop all services" -ForegroundColor White
    Write-Host "  restart     - Restart all services" -ForegroundColor White
    Write-Host "  logs        - Show logs from all services" -ForegroundColor White
    Write-Host "  logs-ml     - Show logs from ML service" -ForegroundColor White
    Write-Host "  logs-db     - Show logs from PostgreSQL" -ForegroundColor White
    Write-Host "  status      - Show status of all services" -ForegroundColor White
    Write-Host "  test-ml     - Test ML service" -ForegroundColor White
    Write-Host "  clean       - Stop and remove all containers" -ForegroundColor White
    Write-Host "  init        - First-time setup (prepare + build + up)" -ForegroundColor White
    Write-Host "  help        - Show this help message" -ForegroundColor White
    Write-Host ""
}

function Invoke-Prepare {
    Write-Host "🔧 Preparing ML Service..." -ForegroundColor Cyan
    & .\scripts\prepare-ml-service.ps1
}

function Invoke-Build {
    Write-Host "🏗️  Building Docker images..." -ForegroundColor Cyan
    docker-compose build
}

function Invoke-Up {
    Write-Host "🚀 Starting services..." -ForegroundColor Cyan
    docker-compose up -d
    Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    docker-compose ps
}

function Invoke-Down {
    Write-Host "🛑 Stopping services..." -ForegroundColor Cyan
    docker-compose down
}

function Invoke-Restart {
    Write-Host "🔄 Restarting services..." -ForegroundColor Cyan
    docker-compose restart
}

function Invoke-Logs {
    Write-Host "📋 Showing logs (Ctrl+C to exit)..." -ForegroundColor Cyan
    docker-compose logs -f
}

function Invoke-LogsML {
    Write-Host "📋 Showing ML service logs (Ctrl+C to exit)..." -ForegroundColor Cyan
    docker-compose logs -f ml-service
}

function Invoke-LogsDB {
    Write-Host "📋 Showing PostgreSQL logs (Ctrl+C to exit)..." -ForegroundColor Cyan
    docker-compose logs -f postgres
}

function Invoke-Status {
    Write-Host ""
    Write-Host "=== Docker Compose Services ===" -ForegroundColor Cyan
    docker-compose ps
    Write-Host ""
    Write-Host "=== Health Checks ===" -ForegroundColor Cyan
    
    # Test ML Service
    Write-Host -NoNewline "ML Service:  "
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ OK" -ForegroundColor Green
        } else {
            Write-Host "❌ DOWN" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ DOWN" -ForegroundColor Red
    }
    
    # Test PostgreSQL
    Write-Host -NoNewline "PostgreSQL:  "
    try {
        $pgResult = docker-compose exec -T postgres pg_isready -U teamup_user 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ OK" -ForegroundColor Green
        } else {
            Write-Host "❌ DOWN" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ DOWN" -ForegroundColor Red
    }
    
    # Test Redis
    Write-Host -NoNewline "Redis:       "
    try {
        $redisResult = docker-compose exec -T redis redis-cli ping 2>&1
        if ($redisResult -match "PONG") {
            Write-Host "✅ OK" -ForegroundColor Green
        } else {
            Write-Host "❌ DOWN" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ DOWN" -ForegroundColor Red
    }
    Write-Host ""
}

function Invoke-TestML {
    Write-Host "🧪 Testing ML service..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Testing health endpoint..." -ForegroundColor Yellow
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:5000/health" -Method Get
        $health | ConvertTo-Json -Depth 3
        Write-Host ""
        Write-Host "✅ ML service is healthy!" -ForegroundColor Green
    } catch {
        Write-Host "❌ ML service not responding" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

function Invoke-Clean {
    Write-Host "🧹 Cleaning up..." -ForegroundColor Cyan
    docker-compose down -v
    docker system prune -f
    Write-Host "✅ Cleanup complete!" -ForegroundColor Green
}

function Invoke-Init {
    Write-Host ""
    Write-Host "🎯 Initializing TeamUp Server..." -ForegroundColor Cyan
    Write-Host ""
    
    Invoke-Prepare
    Write-Host ""
    Invoke-Build
    Write-Host ""
    Invoke-Up
    
    Write-Host ""
    Write-Host "✅ Stack initialized successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Services available:" -ForegroundColor Cyan
    Write-Host "  ML Service:  http://localhost:5000" -ForegroundColor White
    Write-Host "  PostgreSQL:  localhost:5433" -ForegroundColor White
    Write-Host "  Redis:       localhost:6379" -ForegroundColor White
    Write-Host ""
}

# Main command dispatcher
switch ($Command.ToLower()) {
    "prepare"  { Invoke-Prepare }
    "build"    { Invoke-Build }
    "up"       { Invoke-Up }
    "down"     { Invoke-Down }
    "restart"  { Invoke-Restart }
    "logs"     { Invoke-Logs }
    "logs-ml"  { Invoke-LogsML }
    "logs-db"  { Invoke-LogsDB }
    "status"   { Invoke-Status }
    "test-ml"  { Invoke-TestML }
    "clean"    { Invoke-Clean }
    "init"     { Invoke-Init }
    "help"     { Show-Help }
    default    { 
        Write-Host "Unknown command: $Command" -ForegroundColor Red
        Show-Help
        exit 1
    }
}

