# Local vs Production Setup Guide

## Quick Summary

| Setting | LOCAL | PRODUCTION |
|---------|-------|------------|
| `FRONTEND_URL` | `http://localhost:5173` | `https://www.profitfirstanalytics.co.in` |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:3000` | `https://profitfirstanalytics.co.in,https://www.profitfirstanalytics.co.in` |
| `COGNITO_REDIRECT_URI` | `http://localhost:3000/api/auth/oauth/callback` | `https://profitfirstanalytics.co.in/api/auth/oauth/callback` |
| `FB_REDIRECT_URI` | `http://localhost:3000/api/meta/callback` | `https://profitfirstanalytics.co.in/api/meta/callback` |
| `BASE_URL` | `http://localhost:3000` | `https://profitfirstanalytics.co.in` |
| `REDIS_URL` | `redis://localhost:6379` | `redis://redis:6379` |
| `NODE_ENV` | `development` | `production` |
| `TRUST_PROXY` | `false` | `true` |

---

## Files Created

- `.env` - Current active config (set to LOCAL)
- `.env.local` - Backup of local settings
- `.env.production` - Backup of production settings

---

## How to Run Locally

### Option 1: Docker Compose (Recommended)
```bash
docker-compose -f docker-compose.dev.yml up --build
```
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### Option 2: Without Docker
```bash
# Terminal 1 - Start Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Terminal 2 - Start Backend
cd Auth-service
npm install
npm run dev

# Terminal 3 - Start Frontend
cd frontend-profit-first/client
npm install
npm run dev
```

---

## Before Pushing to GitHub for Production

### Step 1: Update `.env` file
Copy contents from `.env.production` to `.env`:
```bash
copy Auth-service\.env.production Auth-service\.env
```

### Step 2: Update docker-compose.dev.yml (if using for production)
Change Redis URL in environment:
```yaml
environment:
  - REDIS_URL=redis://redis:6379
```

### Step 3: Verify these files have production URLs:
- `Auth-service/.env` → All URLs should be `profitfirstanalytics.co.in`

---

## After Pulling from GitHub for Local Development

### Step 1: Update `.env` file
Copy contents from `.env.local` to `.env`:

```bash
copy Auth-service\.env.local Auth-service\.env
```

---

## Important Notes

1. **Never commit `.env` to GitHub** - It contains secrets!
2. **axios.js** uses `/api` (relative URL) - works for both local and production
3. **vite.config.js** proxies `/api` to `localhost:3000` for local dev
4. **nginx.conf** proxies `/api` to `backend:3000` for production Docker

---

## AWS Cognito Setup (One-time)

For OAuth to work locally, add these callback URLs in AWS Cognito Console:
1. Go to AWS Cognito > User Pools > Your Pool > App Integration > App Client
2. Add to "Allowed callback URLs":
   - `http://localhost:3000/api/auth/oauth/callback` (for local)
   - `https://profitfirstanalytics.co.in/api/auth/oauth/callback` (for production)

## Meta/Facebook Setup (One-time)

Add these redirect URIs in Facebook Developer Console:
- `http://localhost:3000/api/meta/callback` (for local)
- `https://profitfirstanalytics.co.in/api/meta/callback` (for production)
