#!/bin/bash

# Production Deployment Script for Profit First Analytics
# This script automates the deployment process

set -e  # Exit on error

echo "🚀 Starting Production Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if Docker is running
echo "📦 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Step 2: Pull latest changes
echo "📥 Pulling latest changes from Git..."
git pull origin main
echo -e "${GREEN}✅ Code updated${NC}"
echo ""

# Step 3: Backup current .env files
echo "💾 Backing up current environment files..."
if [ -f "Auth-service/.env" ]; then
    cp Auth-service/.env Auth-service/.env.backup
    echo -e "${GREEN}✅ Backend .env backed up${NC}"
fi
if [ -f "frontend-profit-first/client/.env" ]; then
    cp frontend-profit-first/client/.env frontend-profit-first/client/.env.backup
    echo -e "${GREEN}✅ Frontend .env backed up${NC}"
fi
echo ""

# Step 4: Copy production environment files
echo "⚙️  Setting up production environment..."
cp Auth-service/.env.production Auth-service/.env
cp frontend-profit-first/client/.env.production frontend-profit-first/client/.env
echo -e "${GREEN}✅ Production environment configured${NC}"
echo ""

# Step 5: Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down
echo -e "${GREEN}✅ Containers stopped${NC}"
echo ""

# Step 6: Build and start services
echo "🏗️  Building and starting services..."
docker-compose up -d --build
echo -e "${GREEN}✅ Services started${NC}"
echo ""

# Step 7: Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check backend health
echo "🔍 Checking backend health..."
for i in {1..30}; do
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend health check failed${NC}"
        echo "Check logs with: docker-compose logs backend"
        exit 1
    fi
    sleep 2
done
echo ""

# Step 8: Show running containers
echo "📊 Running containers:"
docker-compose ps
echo ""

# Step 9: Show logs
echo "📝 Recent logs:"
docker-compose logs --tail=20
echo ""

# Success message
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "🌐 Application URLs:"
echo "   Frontend: http://localhost:80"
echo "   Backend:  http://localhost:3001"
echo ""
echo "📊 Useful commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Restart services: docker-compose restart"
echo "   Stop services:    docker-compose down"
echo ""
echo -e "${YELLOW}⚠️  Remember to configure your reverse proxy (Nginx/Caddy) for HTTPS${NC}"
echo -e "${YELLOW}⚠️  Update AWS Cognito, Meta, and Shopify callback URLs${NC}"
echo ""
