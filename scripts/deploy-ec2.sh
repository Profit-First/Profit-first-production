#!/bin/bash

# EC2 Deployment Script for Profit First Application
# This script should be run ON your EC2 instance

set -e

echo "🚀 Deploying Profit First Application to EC2"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/Profit-First/Profit-first-production.git"
APP_DIR="/home/ubuntu/profit-first-production"
BACKEND_DIR="$APP_DIR/Auth-service"
FRONTEND_DIR="$APP_DIR/frontend-profit-first/client"

echo -e "${BLUE}📋 Deployment Configuration:${NC}"
echo -e "  Repository: $REPO_URL"
echo -e "  App Directory: $APP_DIR"
echo ""

# Step 1: Update system packages
echo -e "${YELLOW}📦 Step 1: Updating system packages...${NC}"
sudo apt-get update -y

# Step 2: Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo -e "${GREEN}✅ Node.js already installed: $(node -v)${NC}"
fi

# Step 3: Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PM2...${NC}"
    sudo npm install -g pm2
else
    echo -e "${GREEN}✅ PM2 already installed${NC}"
fi

# Step 4: Clone or pull latest code
if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}📥 Pulling latest code...${NC}"
    cd $APP_DIR
    git pull origin main
else
    echo -e "${YELLOW}📥 Cloning repository...${NC}"
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# Step 5: Deploy Backend
echo -e "${YELLOW}🔧 Step 5: Deploying Backend...${NC}"
cd $BACKEND_DIR

# Install dependencies
echo -e "${BLUE}  Installing backend dependencies...${NC}"
npm install

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found in $BACKEND_DIR${NC}"
    echo -e "${YELLOW}⚠️  Please create .env file with required environment variables${NC}"
    exit 1
fi

# Stop existing backend process
echo -e "${BLUE}  Stopping existing backend process...${NC}"
pm2 delete profit-first-backend 2>/dev/null || true

# Start backend with PM2
echo -e "${BLUE}  Starting backend with PM2...${NC}"
pm2 start Server.js --name profit-first-backend --time
pm2 save

echo -e "${GREEN}✅ Backend deployed successfully${NC}"

# Step 6: Deploy Frontend
echo -e "${YELLOW}🔧 Step 6: Deploying Frontend...${NC}"
cd $FRONTEND_DIR

# Install dependencies
echo -e "${BLUE}  Installing frontend dependencies...${NC}"
npm install

# Build frontend
echo -e "${BLUE}  Building frontend...${NC}"
npm run build

# Install nginx if not installed
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Nginx...${NC}"
    sudo apt-get install -y nginx
fi

# Copy build to nginx directory
echo -e "${BLUE}  Copying build to Nginx...${NC}"
sudo rm -rf /var/www/html/*
sudo cp -r dist/* /var/www/html/

# Configure Nginx
echo -e "${BLUE}  Configuring Nginx...${NC}"
sudo tee /etc/nginx/sites-available/profit-first > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    root /var/www/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/profit-first /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
echo -e "${BLUE}  Testing Nginx configuration...${NC}"
sudo nginx -t

# Restart nginx
echo -e "${BLUE}  Restarting Nginx...${NC}"
sudo systemctl restart nginx
sudo systemctl enable nginx

echo -e "${GREEN}✅ Frontend deployed successfully${NC}"

# Step 7: Setup PM2 startup
echo -e "${YELLOW}🔧 Step 7: Setting up PM2 startup...${NC}"
pm2 startup systemd -u $USER --hp $HOME
pm2 save

# Step 8: Display status
echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Application Status:${NC}"
pm2 list
echo ""
echo -e "${BLUE}🔗 Access your application:${NC}"
echo -e "  Frontend: http://$(curl -s ifconfig.me)"
echo -e "  Backend:  http://$(curl -s ifconfig.me)/api"
echo ""
echo -e "${BLUE}📝 Useful Commands:${NC}"
echo -e "  View backend logs:  pm2 logs profit-first-backend"
echo -e "  Restart backend:    pm2 restart profit-first-backend"
echo -e "  Stop backend:       pm2 stop profit-first-backend"
echo -e "  View nginx logs:    sudo tail -f /var/log/nginx/error.log"
echo ""
