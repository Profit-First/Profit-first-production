# 🚀 Quick Production Deployment

## One-Command Deployment

### Windows
```bash
deploy-production.bat
```

### Linux/Mac
```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

---

## Manual Deployment (3 Steps)

### 1. Switch to Production Environment
```bash
# Backend
copy Auth-service\.env.production Auth-service\.env

# Frontend  
copy frontend-profit-first\client\.env.production frontend-profit-first\client\.env
```

### 2. Deploy with Docker
```bash
docker-compose down
docker-compose up -d --build
```

### 3. Verify
```bash
# Check status
docker-compose ps

# Check logs
docker-compose logs -f

# Test backend
curl http://localhost:3001/health
```

---

## ⚠️ Before First Deployment

### Update External Services (One-time setup)

1. **AWS Cognito**
   - Add callback: `https://profitfirstanalytics.co.in/api/auth/oauth/callback`

2. **Meta/Facebook**
   - Add redirect: `https://profitfirstanalytics.co.in/api/meta/callback`

3. **Shopify**
   - Update app URL: `https://profitfirstanalytics.co.in`
   - Add redirect: `https://profitfirstanalytics.co.in/api/shopify/callback`

---

## 🔄 Switch Back to Local Development

```bash
# Backend
copy Auth-service\.env.local Auth-service\.env

# Frontend
copy frontend-profit-first\client\.env.local frontend-profit-first\client\.env

# Use dev compose
docker-compose -f docker-compose.dev.yml up
```

---

## 📊 Monitoring Commands

```bash
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Check health
curl http://localhost:3001/health

# View container status
docker-compose ps
```

---

## 🆘 Troubleshooting

### Backend not starting?
```bash
docker-compose logs backend
```

### Frontend not loading?
```bash
docker exec profit-first-frontend cat /var/log/nginx/error.log
```

### Redis issues?
```bash
docker exec profit-first-redis redis-cli ping
```

---

## 📚 Full Documentation

See `PRODUCTION_DEPLOYMENT_GUIDE.md` for complete details.
