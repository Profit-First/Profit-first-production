# Docker Setup Guide

This guide explains how to run the Profit First application using Docker and Docker Compose.

## Prerequisites

- Docker installed (version 20.10 or higher)
- Docker Compose installed (version 2.0 or higher)
- `.env` file configured in `Auth-service/` directory

## Architecture

The application consists of three services:

1. **Redis** - In-memory cache (port 6379)
2. **Backend** - Node.js/Express API (port 3000)
3. **Frontend** - React app served by Nginx (port 80)

## Quick Start

### 1. Configure Environment Variables

Make sure you have a `.env` file in the `Auth-service/` directory with all required variables:

```bash
cd Auth-service
cp .env.example .env
# Edit .env with your actual values
```

Required variables:
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `COGNITO_CLIENT_ID`
- `COGNITO_USER_POOL_ID`
- `DYNAMODB_TABLE_NAME`
- `REDIS_URL=redis://redis:6379` (automatically set in docker-compose)

### 2. Build and Start All Services

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f redis
```

### 3. Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **Redis**: localhost:6379

## Docker Commands

### Start Services
```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d backend
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clears Redis data)
docker-compose down -v
```

### Rebuild Services
```bash
# Rebuild all services
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f redis
```

### Execute Commands in Containers
```bash
# Access backend shell
docker-compose exec backend sh

# Access Redis CLI
docker-compose exec redis redis-cli

# Check Redis connection
docker-compose exec redis redis-cli ping
```

### Check Service Status
```bash
# View running containers
docker-compose ps

# View resource usage
docker stats
```

## Development Mode

For development with hot-reload:

### Backend Development
```bash
# Stop production backend
docker-compose stop backend

# Run backend locally with nodemon
cd Auth-service
npm install
npm run dev
```

### Frontend Development
```bash
# Stop production frontend
docker-compose stop frontend

# Run frontend locally with Vite
cd frontend-profit-first/client
npm install
npm run dev
```

Keep Redis running in Docker:
```bash
docker-compose up -d redis
```

## Troubleshooting

### Backend won't start
1. Check if Redis is running: `docker-compose ps redis`
2. Check backend logs: `docker-compose logs backend`
3. Verify `.env` file exists and has all required variables
4. Check Redis connection: `docker-compose exec redis redis-cli ping`

### Frontend shows 502 Bad Gateway
1. Check if backend is healthy: `curl http://localhost:3000/health`
2. Check backend logs: `docker-compose logs backend`
3. Restart services: `docker-compose restart`

### Redis connection errors
1. Check Redis is running: `docker-compose ps redis`
2. Check Redis logs: `docker-compose logs redis`
3. Test connection: `docker-compose exec redis redis-cli ping`
4. Verify REDIS_URL in backend: `redis://redis:6379`

### Port conflicts
If ports 80, 3000, or 6379 are already in use:

Edit `docker-compose.yml` and change the port mappings:
```yaml
ports:
  - "8080:80"    # Frontend (change 8080 to any available port)
  - "3001:3000"  # Backend (change 3001 to any available port)
  - "6380:6379"  # Redis (change 6380 to any available port)
```

### Clear all data and restart
```bash
# Stop and remove everything
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Rebuild and start fresh
docker-compose up -d --build
```

## Production Deployment

For production deployment:

1. Update environment variables in `.env`
2. Set `NODE_ENV=production`
3. Configure proper domain names
4. Set up SSL/TLS certificates
5. Use a reverse proxy (Nginx/Traefik)
6. Enable Docker secrets for sensitive data
7. Set up monitoring and logging
8. Configure backup for Redis data

## Health Checks

All services include health checks:

- **Backend**: HTTP GET to `/health` endpoint
- **Redis**: `redis-cli ping` command
- **Frontend**: Nginx process check

View health status:
```bash
docker-compose ps
```

## Data Persistence

Redis data is persisted in a Docker volume named `redis_data`. This ensures cache data survives container restarts.

To backup Redis data:
```bash
docker-compose exec redis redis-cli SAVE
docker cp profit-first-redis:/data/dump.rdb ./backup/
```

To restore Redis data:
```bash
docker cp ./backup/dump.rdb profit-first-redis:/data/
docker-compose restart redis
```

## Network

All services communicate through a custom bridge network `profit-first-network`. This allows services to communicate using service names (e.g., `redis`, `backend`, `frontend`).

## Resource Limits

To add resource limits, edit `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```
