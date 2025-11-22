# Quick Start Guide

Get your Profit First application running in minutes!

## Choose Your Deployment Method

### 🐳 Option 1: Docker Compose (Easiest)

**Best for:** Quick testing, local development

```bash
# 1. Configure environment
cd Auth-service
cp .env.example .env
# Edit .env with your AWS credentials

# 2. Start all services
cd ..
docker-compose up -d

# 3. Access application
# Frontend: http://localhost
# Backend: http://localhost:3000/health
# Redis: localhost:6379
```

**That's it!** Your application is running.

---

### 🔥 Option 2: Docker Compose Dev (Hot Reload)

**Best for:** Active development

```bash
# 1. Configure environment (same as above)
cd Auth-service
cp .env.example .env
# Edit .env

# 2. Start with hot reload
cd ..
docker-compose -f docker-compose.dev.yml up

# 3. Access application
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

Code changes will auto-reload!

---

### ☸️ Option 3: Kubernetes (Production)

**Best for:** Production deployment, scalability

#### Prerequisites
- Kubernetes cluster (see [KUBERNETES_SETUP.md](KUBERNETES_SETUP.md))
- kubectl configured

#### Quick Deploy

```bash
# 1. Update secrets
nano k8s/backend/backend-secret.yaml
# Add your AWS credentials

# 2. Deploy application
chmod +x scripts/deploy.sh
./scripts/deploy.sh

# 3. Deploy monitoring
chmod +x scripts/deploy-monitoring.sh
./scripts/deploy-monitoring.sh

# 4. Access application
kubectl port-forward -n profit-first svc/frontend 8080:80
kubectl port-forward -n profit-first svc/backend 3000:3000
```

**Access:**
- Frontend: http://localhost:8080
- Backend: http://localhost:3000
- Prometheus: http://<node-ip>:30090
- Grafana: http://<node-ip>:30300

---

## Verification

### Check Services

**Docker:**
```bash
docker-compose ps
docker-compose logs -f
```

**Kubernetes:**
```bash
kubectl get all -n profit-first
kubectl get pods -n profit-first
```

### Test Backend

```bash
# Docker
curl http://localhost:3000/health

# Kubernetes
kubectl port-forward -n profit-first svc/backend 3000:3000
curl http://localhost:3000/health
```

### Test Frontend

**Docker:**
Open http://localhost (or http://localhost:5173 for dev)

**Kubernetes:**
```bash
kubectl port-forward -n profit-first svc/frontend 8080:80
```
Open http://localhost:8080

---

## Common Issues

### Port Already in Use

**Docker:**
Edit `docker-compose.yml` and change ports:
```yaml
ports:
  - "8080:80"    # Change 80 to 8080
  - "3001:3000"  # Change 3000 to 3001
```

**Kubernetes:**
Use port-forward with different local port:
```bash
kubectl port-forward -n profit-first svc/frontend 8080:80
```

### Backend Can't Connect to Redis

**Docker:**
```bash
docker-compose restart redis
docker-compose logs redis
```

**Kubernetes:**
```bash
kubectl get pods -n profit-first -l app=redis
kubectl logs -n profit-first -l app=redis
```

### Environment Variables Not Set

**Docker:**
Make sure `.env` file exists in `Auth-service/` directory

**Kubernetes:**
Check secrets:
```bash
kubectl get secret -n profit-first backend-secret
kubectl describe secret -n profit-first backend-secret
```

---

## Next Steps

### 1. Configure Monitoring

**Grafana:**
- Access: http://<node-ip>:30300
- Login: admin/admin123
- Import dashboards (see [monitoring/README.md](monitoring/README.md))

**Prometheus:**
- Access: http://<node-ip>:30090
- Check targets: Status → Targets

### 2. Setup ArgoCD (Optional)

```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Get password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Access UI
kubectl port-forward -n argocd svc/argocd-server 8080:443
# Open: https://localhost:8080
```

### 3. Configure Ingress (Production)

```bash
# Install Nginx Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Update domain in k8s/ingress/ingress.yaml
nano k8s/ingress/ingress.yaml

# Apply ingress
kubectl apply -f k8s/ingress/ingress.yaml
```

### 4. Setup CI/CD

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for GitHub Actions example.

---

## Useful Commands

### Docker Compose

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart service
docker-compose restart backend

# Rebuild and start
docker-compose up -d --build
```

### Kubernetes

```bash
# Get all resources
kubectl get all -n profit-first

# View logs
kubectl logs -f -n profit-first -l app=backend

# Describe pod
kubectl describe pod -n profit-first <pod-name>

# Execute command in pod
kubectl exec -it -n profit-first <pod-name> -- sh

# Port forward
kubectl port-forward -n profit-first svc/backend 3000:3000

# Scale deployment
kubectl scale deployment backend -n profit-first --replicas=3
```

---

## Documentation

- [Complete Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Docker Setup](DOCKER_SETUP.md)
- [Kubernetes Setup](KUBERNETES_SETUP.md)
- [Project Structure](PROJECT_STRUCTURE.md)
- [Folder Structure](FOLDER_STRUCTURE.md)
- [ArgoCD Guide](argocd/README.md)
- [Monitoring Guide](monitoring/README.md)

---

## Support

If you encounter issues:

1. Check logs (Docker or Kubernetes)
2. Verify environment variables
3. Check service connectivity
4. Review documentation
5. Check GitHub issues

---

## Quick Reference

| Component | Docker Port | K8s NodePort | K8s Service |
|-----------|-------------|--------------|-------------|
| Frontend  | 80 / 5173   | -            | frontend:80 |
| Backend   | 3000        | -            | backend:3000 |
| Redis     | 6379        | -            | redis:6379 |
| Prometheus| -           | 30090        | prometheus:9090 |
| Grafana   | -           | 30300        | grafana:3000 |
| ArgoCD    | -           | 30443        | argocd-server:443 |

---

**Happy Deploying! 🚀**
