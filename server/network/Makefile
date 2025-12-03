.PHONY: help build up down restart logs clean migrate seed test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Build all Docker images
	docker-compose build

up: ## Start all services
	docker-compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 10
	@docker-compose ps

down: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose restart

logs: ## Show logs from all services
	docker-compose logs -f

logs-backend: ## Show logs from backend API
	docker-compose logs -f backend-api

logs-ml: ## Show logs from ML service
	docker-compose logs -f ml-service

logs-db: ## Show logs from PostgreSQL
	docker-compose logs -f postgres

ps: ## Show running containers
	docker-compose ps

clean: ## Stop and remove all containers, networks, and volumes
	docker-compose down -v
	docker system prune -f

migrate: ## Run database migrations
	@echo "Running EF Core migrations..."
	docker-compose exec backend-api dotnet ef database update

seed: ## Seed reference data
	@echo "Seeding reference data..."
	docker-compose exec postgres psql -U teamup_user -d teamup -f /docker-entrypoint-initdb.d/init-db.sql

shell-backend: ## Open shell in backend container
	docker-compose exec backend-api /bin/bash

shell-ml: ## Open shell in ML service container
	docker-compose exec ml-service /bin/bash

shell-db: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U teamup_user -d teamup

test-ml: ## Test ML service endpoint
	@echo "Testing ML service health..."
	curl -f http://localhost:5000/health || echo "ML service not responding"
	@echo ""
	@echo "Testing ML model info..."
	curl -s http://localhost:5000/ml/model-info | python3 -m json.tool || echo "Failed"

test-backend: ## Test backend API endpoint
	@echo "Testing backend health..."
	curl -f http://localhost:8080/health || echo "Backend not responding"

test-all: test-ml test-backend ## Test all services

init: build up migrate seed ## Initialize entire stack (first time setup)
	@echo ""
	@echo "✅ Stack initialized successfully!"
	@echo "Backend API: http://localhost:8080"
	@echo "ML Service: http://localhost:5000"
	@echo "PostgreSQL: localhost:5433"
	@echo "Redis: localhost:6379"

rebuild: down clean build up ## Rebuild and restart everything

status: ## Show detailed status of all services
	@echo "=== Docker Compose Services ==="
	@docker-compose ps
	@echo ""
	@echo "=== Health Checks ==="
	@echo -n "Backend API: "
	@curl -sf http://localhost:8080/health > /dev/null && echo "✅ OK" || echo "❌ DOWN"
	@echo -n "ML Service:  "
	@curl -sf http://localhost:5000/health > /dev/null && echo "✅ OK" || echo "❌ DOWN"
	@echo -n "PostgreSQL:  "
	@docker-compose exec -T postgres pg_isready -U teamup_user > /dev/null 2>&1 && echo "✅ OK" || echo "❌ DOWN"
	@echo -n "Redis:       "
	@docker-compose exec -T redis redis-cli ping > /dev/null 2>&1 && echo "✅ OK" || echo "❌ DOWN"

backup-db: ## Backup PostgreSQL database
	@echo "Creating database backup..."
	@mkdir -p backups
	@docker-compose exec -T postgres pg_dump -U teamup_user teamup > backups/teamup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup created in backups/ directory"

restore-db: ## Restore PostgreSQL database (usage: make restore-db FILE=backup.sql)
	@echo "Restoring database from $(FILE)..."
	@docker-compose exec -T postgres psql -U teamup_user teamup < $(FILE)
	@echo "Database restored"

