# Production Deployment Guide

## 🚀 Quick Deployment Steps

### Prerequisites
- Docker and Docker Compose installed on production server
- Domain configured: `profitfirstanalytics.co.in` pointing to your server
- AWS credentials configured
- Ports 80 (HTTP) and optionally 443 (HTTPS) open

---

## Step 1: Prepare Environment Files

### Backend Environment
```bash
# Copy production environment to active .env
copy Auth-service\.env.production Auth-service\.env
```

### Frontend Environment
```bash
# Copy production environment to active .env
copy frontend-profit-first\client\.env.production frontend-profit-first\client\.env
```

---

## Step 2: Update External Services

### AWS Cognito Callback URLs
1. Go to AWS Console → Cognito → User Pools → Your Pool
2. Navigate to: App Integration → App Client Settings
3. Add to "Allowed callback URLs":
   - `https://profitfirstanalytics.co.in/api/auth/oauth/callback`
4. Add to "Allowed sign-out URLs":
   - `https://www.profitfirstanalytics.co.in`

### Meta/Facebook Redirect URIs
1. Go to Facebook Developer Console → Your App
2. Navigate to: Settings → Basic
3. Add to "Valid OAuth Redirect URIs":
   - `https://profitfirstanalytics.co.in/api/meta/callback`

### Shopify App Configuration
1. Go to Shopify Partners Dashboard → Your App
2. Update "App URL" to: `https://profitfirstanalytics.co.in`
3. Update "Allowed redirection URL(s)" to: `https://profitfirstanalytics.co.in/api/shopify/callback`

---

## Step 3: Deploy with Docker Compose

### Option A: Fresh Deployment
```bash
# Build and start all services
docker-compose up -d --build

# Check logs
docker-compose logs -f
```

### Option B: Update Existing Deployment
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart services
docker-compose down
docker-compose up -d --build

# Check status
docker-compose ps
```

---

## Step 4: Verify Deployment

### Check Service Health
```bash
# Check all containers are running
docker-compose ps

# Check backend health
curl http://localhost:3001/health

# Check Redis
docker exec profit-first-redis redis-cli ping
```

### Check Logs
```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend

# Redis only
docker-compose logs -f redis
```

---

## Step 5: Configure Reverse Proxy (Nginx/Caddy)

### Option A: Nginx Configuration
Create `/etc/nginx/sites-available/profitfirstanalytics.co.in`:

```nginx
server {
    listen 80;
    server_name profitfirstanalytics.co.in www.profitfirstanalytics.co.in;

    # Redirect HTTP to HTTPS (after SSL setup)
    # return 301 https://$server_name$request_uri;

    # For now, proxy to Docker
    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/profitfirstanalytics.co.in /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option B: Caddy Configuration (Automatic HTTPS)
Create `Caddyfile`:

```caddy
profitfirstanalytics.co.in, www.profitfirstanalytics.co.in {
    reverse_proxy localhost:80
}
```

Start Caddy:
```bash
caddy run
```

---

## Step 6: Setup SSL/HTTPS (Recommended)

### Using Certbot (Let's Encrypt)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d profitfirstanalytics.co.in -d www.profitfirstanalytics.co.in

# Auto-renewal is configured automatically
```

### Update docker-compose.yml for HTTPS
Change frontend port mapping:
```yaml
ports:
  - "443:80"  # HTTPS
```

---

## 🔄 Switching Between Environments

### Switch to Production
```bash
# Backend
copy Auth-service\.env.production Auth-service\.env

# Frontend
copy frontend-profit-first\client\.env.production frontend-profit-first\client\.env

# Restart services
docker-compose restart
```

### Switch to Local Development
```bash
# Backend
copy Auth-service\.env.local Auth-service\.env

# Frontend
copy frontend-profit-first\client\.env.local frontend-profit-first\client\.env

# Use dev compose file
docker-compose -f docker-compose.dev.yml up
```

---

## 📊 Monitoring & Maintenance

### View Logs
```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs -f backend
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
docker-compose restart redis
```

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Backup Redis Data
```bash
# Create backup
docker exec profit-first-redis redis-cli SAVE
docker cp profit-first-redis:/data/dump.rdb ./backup-$(date +%Y%m%d).rdb

# Restore backup
docker cp backup-20250106.rdb profit-first-redis:/data/dump.rdb
docker-compose restart redis
```

---

## 🐛 Troubleshooting

### Backend Not Starting
```bash
# Check logs
docker-compose logs backend

# Check environment variables
docker exec profit-first-backend env | grep -E "FRONTEND_URL|REDIS_URL|NODE_ENV"

# Restart backend
docker-compose restart backend
```

### Frontend Not Loading
```bash
# Check nginx logs
docker exec profit-first-frontend cat /var/log/nginx/error.log

# Check if backend is reachable
docker exec profit-first-frontend wget -O- http://backend:3000/health

# Rebuild frontend
docker-compose up -d --build frontend
```

### Redis Connection Issues
```bash
# Check Redis is running
docker exec profit-first-redis redis-cli ping

# Check backend can reach Redis
docker exec profit-first-backend ping redis

# Restart Redis
docker-compose restart redis
```

### CORS Errors
Check backend `.env` file:
```bash
CORS_ORIGIN=https://profitfirstanalytics.co.in,https://www.profitfirstanalytics.co.in
FRONTEND_URL=https://www.profitfirstanalytics.co.in
```

### 401 Unauthorized Errors
1. Check AWS Cognito callback URLs are correct
2. Check Meta/Facebook redirect URIs are correct
3. Verify tokens are being stored in localStorage
4. Check backend logs for authentication errors

---

## 📝 Important Notes

1. **Never commit `.env` files to Git** - They contain secrets!
2. **Always use `.env.production` for production** - Contains correct URLs
3. **Test locally first** - Use `docker-compose.dev.yml` for testing
4. **Monitor logs regularly** - Check for errors and performance issues
5. **Backup Redis data** - Contains cache and session data
6. **Keep secrets secure** - Rotate API keys and tokens regularly

---

## 🔗 Service URLs

### Production
- Frontend: https://www.profitfirstanalytics.co.in
- Backend API: https://profitfirstanalytics.co.in/api
- Health Check: https://profitfirstanalytics.co.in/api/health

### Local Development
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Redis: localhost:6379

---

## 📞 Support

If you encounter issues:
1. Check logs: `docker-compose logs -f`
2. Verify environment variables are correct
3. Ensure external services (AWS, Meta, Shopify) are configured
4. Check firewall and port settings
5. Review this guide for troubleshooting steps
