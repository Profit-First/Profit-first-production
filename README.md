# Profit First Analytics Platform

E-commerce analytics platform with AI-powered predictions and chatbot, featuring Shopify, Meta Ads, and Shiprocket integrations.

## 🚀 Quick Start

Choose your deployment method:

### 🐳 Docker Compose (Recommended for Quick Start)
```bash
cd Auth-service
cp .env.example .env
# Edit .env with your credentials
cd ..
docker-compose up -d
```
**Access:** Frontend at http://localhost, Backend at http://localhost:3000

### ☸️ Kubernetes (Production)
```bash
./scripts/deploy.sh
./scripts/deploy-monitoring.sh
```

### 💻 Local Development
```bash
# Backend
cd Auth-service
npm install
npm run dev

# Frontend
cd frontend-profit-first/client
npm install
npm run dev
```

📖 **See [QUICK_START.md](QUICK_START.md) for detailed instructions**

## 📚 Documentation

- **[QUICK_START.md](QUICK_START.md)** - Get started in minutes
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Complete deployment guide
- **[DOCKER_SETUP.md](DOCKER_SETUP.md)** - Docker & Docker Compose guide
- **[KUBERNETES_SETUP.md](KUBERNETES_SETUP.md)** - Kubernetes cluster setup with kubeadm
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Project architecture
- **[FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md)** - Complete folder structure

## ✨ Features

- 📊 Real-time dashboard with business metrics
- 🤖 AI predictions for revenue, orders, and profit
- 💬 AI chatbot for business insights (AWS Bedrock)
- 🛍️ Shopify integration (OAuth + GraphQL)
- 📱 Meta/Facebook Ads integration
- 📦 Shiprocket shipping integration
- ⚡ Redis caching for performance
- 🔐 AWS Cognito authentication
- 📈 Prometheus & Grafana monitoring
- 🔄 ArgoCD GitOps deployment

## 🏗️ Architecture

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│   Frontend  │─────▶│   Backend   │─────▶│     Redis    │
│  (React)    │      │  (Express)  │      │   (Cache)    │
└─────────────┘      └─────────────┘      └──────────────┘
                            │
                            ├─────▶ AWS Cognito (Auth)
                            ├─────▶ AWS DynamoDB (Database)
                            ├─────▶ AWS Bedrock (AI)
                            ├─────▶ Shopify API
                            ├─────▶ Meta Ads API
                            └─────▶ Shiprocket API
```

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js 18
- **Framework:** Express.js
- **Authentication:** AWS Cognito (JWT)
- **Database:** AWS DynamoDB
- **Cache:** Redis
- **AI:** AWS Bedrock (Claude/Nova)
- **Integrations:** Shopify, Meta Ads, Shiprocket

### Frontend
- **Framework:** React 19
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Charts:** Recharts, Highcharts
- **HTTP Client:** Axios

### Infrastructure
- **Containerization:** Docker & Docker Compose
- **Orchestration:** Kubernetes (kubeadm)
- **GitOps:** ArgoCD
- **Monitoring:** Prometheus & Grafana
- **Web Server:** Nginx (production)

## 📦 Project Structure

```
profit-first-app/
├── Auth-service/              # Backend (Node.js/Express)
├── frontend-profit-first/     # Frontend (React/Vite)
├── k8s/                       # Kubernetes manifests
├── argocd/                    # ArgoCD configuration
├── monitoring/                # Prometheus & Grafana
├── scripts/                   # Deployment scripts
├── docker-compose.yml         # Production Docker Compose
└── docker-compose.dev.yml     # Development Docker Compose
```

## 🔧 Configuration

### Environment Variables

Create `Auth-service/.env` from `.env.example`:

```env
# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# AWS Cognito
COGNITO_CLIENT_ID=your-client-id
COGNITO_USER_POOL_ID=your-pool-id

# DynamoDB
DYNAMODB_TABLE_NAME=Users

# Redis
REDIS_URL=redis://redis:6379
```

### Kubernetes Secrets

Update `k8s/backend/backend-secret.yaml` with your credentials before deploying.

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/oauth/url` - Get OAuth URL
- `GET /api/auth/oauth/callback` - OAuth callback

### Dashboard
- `GET /api/data/dashboard` - Dashboard metrics
- `GET /api/predictions` - AI predictions

### Integrations
- `POST /api/shopify/connect` - Connect Shopify
- `POST /api/meta/connect` - Connect Meta Ads
- `POST /api/shipping/connect` - Connect Shiprocket

### AI
- `POST /api/ai/chat` - Chat with AI assistant

### User
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile

## 📊 Monitoring

### Prometheus
- **URL:** http://<node-ip>:30090
- **Metrics:** Application, Kubernetes, Redis

### Grafana
- **URL:** http://<node-ip>:30300
- **Username:** admin
- **Password:** admin123 (change in production)
- **Dashboards:** Kubernetes, Application, Redis

### Recommended Dashboards
1. Kubernetes Cluster Monitoring (ID: 315)
2. Node Exporter Full (ID: 1860)
3. Kubernetes Pod Monitoring (ID: 6417)
4. Redis Dashboard (ID: 11835)

## 🔄 CI/CD with ArgoCD

### Install ArgoCD
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f argocd/argocd-install.yaml
```

### Deploy Application
```bash
# Update Git repo in argocd/application.yaml
kubectl apply -f argocd/application.yaml
```

### Access ArgoCD
```bash
# Get password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Access UI at https://<node-ip>:30443
```

## 🧪 Testing

### Health Check
```bash
# Docker
curl http://localhost:3000/health

# Kubernetes
kubectl port-forward -n profit-first svc/backend 3000:3000
curl http://localhost:3000/health
```

### View Logs
```bash
# Docker
docker-compose logs -f backend

# Kubernetes
kubectl logs -f -n profit-first -l app=backend
```

## 🔒 Security

- JWT token authentication
- AWS Cognito user management
- Rate limiting on API endpoints
- Helmet.js security headers
- Input validation and sanitization
- CORS configuration
- Kubernetes secrets for sensitive data
- Network policies (recommended)

## 📈 Scaling

### Docker Compose
```bash
docker-compose up -d --scale backend=3
```

### Kubernetes (HPA Configured)
```bash
# Manual scaling
kubectl scale deployment backend -n profit-first --replicas=5

# Auto-scaling based on CPU/Memory (already configured)
kubectl get hpa -n profit-first
```

## 🐛 Troubleshooting

### Common Issues

**Port conflicts:**
- Change ports in `docker-compose.yml`
- Use different NodePort in Kubernetes

**Backend can't connect to Redis:**
```bash
# Docker
docker-compose restart redis

# Kubernetes
kubectl get pods -n profit-first -l app=redis
```

**Environment variables not set:**
- Check `.env` file exists in `Auth-service/`
- Verify Kubernetes secrets are applied

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for more troubleshooting.

## 📝 License

Proprietary - All rights reserved

## 🤝 Support

For issues and questions:
1. Check documentation files
2. Review logs (Docker or Kubernetes)
3. Verify configuration
4. Check GitHub issues

---

**Made with ❤️ for E-commerce Analytics**
