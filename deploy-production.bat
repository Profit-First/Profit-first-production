@echo off
REM Production Deployment Script for Profit First Analytics (Windows)
REM This script automates the deployment process

echo.
echo ========================================
echo   Production Deployment Starting...
echo ========================================
echo.

REM Step 1: Check if Docker is running
echo [1/9] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)
echo SUCCESS: Docker is running
echo.

REM Step 2: Pull latest changes
echo [2/9] Pulling latest changes from Git...
git pull origin main
if errorlevel 1 (
    echo ERROR: Failed to pull from Git
    pause
    exit /b 1
)
echo SUCCESS: Code updated
echo.

REM Step 3: Backup current .env files
echo [3/9] Backing up current environment files...
if exist "Auth-service\.env" (
    copy /Y "Auth-service\.env" "Auth-service\.env.backup" >nul
    echo SUCCESS: Backend .env backed up
)
if exist "frontend-profit-first\client\.env" (
    copy /Y "frontend-profit-first\client\.env" "frontend-profit-first\client\.env.backup" >nul
    echo SUCCESS: Frontend .env backed up
)
echo.

REM Step 4: Copy production environment files
echo [4/9] Setting up production environment...
copy /Y "Auth-service\.env.production" "Auth-service\.env" >nul
copy /Y "frontend-profit-first\client\.env.production" "frontend-profit-first\client\.env" >nul
echo SUCCESS: Production environment configured
echo.

REM Step 5: Stop existing containers
echo [5/9] Stopping existing containers...
docker-compose down
echo SUCCESS: Containers stopped
echo.

REM Step 6: Build and start services
echo [6/9] Building and starting services...
echo This may take a few minutes...
docker-compose up -d --build
if errorlevel 1 (
    echo ERROR: Failed to start services
    pause
    exit /b 1
)
echo SUCCESS: Services started
echo.

REM Step 7: Wait for services to be healthy
echo [7/9] Waiting for services to be healthy...
timeout /t 10 /nobreak >nul

REM Check backend health
echo [8/9] Checking backend health...
set /a attempts=0
:healthcheck
set /a attempts+=1
curl -f http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    if %attempts% LSS 30 (
        timeout /t 2 /nobreak >nul
        goto healthcheck
    ) else (
        echo ERROR: Backend health check failed
        echo Check logs with: docker-compose logs backend
        pause
        exit /b 1
    )
)
echo SUCCESS: Backend is healthy
echo.

REM Step 8: Show running containers
echo [9/9] Checking running containers...
docker-compose ps
echo.

REM Success message
echo.
echo ========================================
echo   Deployment Completed Successfully!
echo ========================================
echo.
echo Application URLs:
echo   Frontend: http://localhost:80
echo   Backend:  http://localhost:3001
echo.
echo Useful commands:
echo   View logs:        docker-compose logs -f
echo   Restart services: docker-compose restart
echo   Stop services:    docker-compose down
echo.
echo IMPORTANT REMINDERS:
echo   - Configure reverse proxy (Nginx/Caddy) for HTTPS
echo   - Update AWS Cognito callback URLs
echo   - Update Meta/Facebook redirect URIs
echo   - Update Shopify app configuration
echo.
echo Press any key to view recent logs...
pause >nul
docker-compose logs --tail=50
echo.
pause
