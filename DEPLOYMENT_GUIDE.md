# Complete Deployment Guide

## Overview

This guide covers the complete deployment of the Profit First application using:
- **Docker & Docker Compose** - Local development and testing
- **Kubernetes (kubeadm)** - Production cluster
- **ArgoCD** - GitOps continuous deployment
- **Prometheus** - Metrics collection
- **Grafana** - Monitoring dashboards

## Project Structure

```
profit-first-app/
├── Auth-service/              # Backend (Node.js/Express)
├── frontend-profit-first/     # Frontend (React/Vite)
├── k8s/                       # Kubernetes manifests
├── argocd/                    # ArgoCD configuration
├── monitoring/                # Prometheus & Grafana
├── scripts/                   # Deployment scripts
├── docker-compose.yml         # Production Docker Compose
├── docker-compose.dev.yml     # Development Docker Compose
└── KUBERNETES_SETUP.md        # Detailed K8s setup guide
```

## Deployment Options

### Option 1: Docker Compose (Development)

**Best for:** Local development, testing

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Access:**
- Frontend: http://localhost
- Backend: http://localhost:3000
- Redis: localhost:6379

### Option 2: Docker Compose Dev (Hot Reload)

**Best for:** Active development with hot reload

```bash
# Start with hot reload
docker-compose -f docker-compose.dev.yml up

# Backend and frontend will auto-reload on code changes
```

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### Option 3: Kubernetes (Production)

**Best for:** Production deployment, scalability, high availability

See [KUBERNETES_SETUP.md](KUBERNETES_SETUP.md) for complete guide.

**Quick Start:**

```bash
# 1. Setup Kubernetes cluster (see KUBERNETES_SETUP.md)

# 2. Deploy application
./scripts/deploy.sh

# 3. Deploy monitoring
./scripts/deploy-monitoring.sh

# 4. Setup ArgoCD (optional)
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f argocd/
```

## Prerequisites

### For Docker Deployment
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum

### For Kubernetes Deployment
- Ubuntu/Debian server
- 2 CPUs, 4GB RAM minimum
- Root/sudo access
- Docker installed

## Configuration

### 1. Backend Environment Variables

Edit `Auth-service/.env`:

```env
# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Cognito
COGNITO_CLIENT_ID=your-client-id
COGNITO_USER_POOL_ID=your-pool-id

# DynamoDB
DYNAMODB_TABLE_NAME=Users

# Redis
REDIS_URL=redis://redis:6379
```

### 2. Kubernetes Secrets

Edit `k8s/backend/backend-secret.yaml` with your credentials.

### 3. Docker Registry

Update image names in:
- `k8s/backend/backend-deployment.yaml`
- `k8s/frontend/frontend-deployment.yaml`

## Monitoring Setup

### Prometheus
- Collects metrics from Kubernetes and application
- Access: http://<node-ip>:30090

### Grafana
- Visualizes metrics with dashboards
- Access: http://<node-ip>:30300
- Default: admin/admin123

### Recommended Dashboards
1. Kubernetes Cluster Monitoring (ID: 315)
2. Node Exporter Full (ID: 1860)
3. Kubernetes Pod Monitoring (ID: 6417)
4. Redis Dashboard (ID: 11835)

## ArgoCD Setup

### Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f argocd/argocd-install.yaml
```

### Get Admin Password

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### Deploy Application

```bash
# Update Git repo in argocd/application.yaml
kubectl apply -f argocd/application.yaml
```

## Verification

### Docker Compose

```bash
# Check services
docker-compose ps

# Check logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs redis

# Test backend
curl http://localhost:3000/health

# Test frontend
curl http://localhost
```

### Kubernetes

```bash
# Check all resources
kubectl get all -n profit-first

# Check pods
kubectl get pods -n profit-first

# Check logs
kubectl logs -f -n profit-first -l app=backend

# Test backend
kubectl port-forward -n profit-first svc/backend 3000:3000
curl http://localhost:3000/health

# Check monitoring
kubectl get all -n monitoring
```

## Troubleshooting

### Docker Issues

**Container won't start:**
```bash
docker-compose logs <service-name>
docker-compose restart <service-name>
```

**Port conflicts:**
Edit `docker-compose.yml` and change port mappings.

**Redis connection error:**
```bash
docker-compose exec redis redis-cli ping
```

### Kubernetes Issues

**Pod not starting:**
```bash
kubectl describe pod -n profit-first <pod-name>
kubectl logs -n profit-first <pod-name>
```

**Backend can't connect to Redis:**
```bash
kubectl get svc -n profit-first redis
kubectl run -it --rm redis-test --image=redis:7-alpine --restart=Never -n profit-first -- redis-cli -h redis ping
```

**Image pull errors:**
- Check image name in deployment
- Verify registry credentials
- Use `imagePullSecrets` if needed

## Scaling

### Docker Compose

```bash
# Scale backend
docker-compose up -d --scale backend=3
```

### Kubernetes

```bash
# Manual scaling
kubectl scale deployment backend -n profit-first --replicas=5

# Auto-scaling (HPA already configured)
kubectl get hpa -n profit-first
```

## Backup & Recovery

### Docker Volumes

```bash
# Backup Redis data
docker cp profit-first-redis:/data ./backup/redis-data

# Restore
docker cp ./backup/redis-data profit-first-redis:/data
```

### Kubernetes PVCs

```bash
# Backup
kubectl exec -n profit-first <redis-pod> -- tar czf /tmp/backup.tar.gz /data
kubectl cp profit-first/<redis-pod>:/tmp/backup.tar.gz ./backup.tar.gz

# Restore
kubectl cp ./backup.tar.gz profit-first/<redis-pod>:/tmp/backup.tar.gz
kubectl exec -n profit-first <redis-pod> -- tar xzf /tmp/backup.tar.gz -C /
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Kubernetes

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Build and push Docker images
      run: |
        docker build -t your-registry/backend:${{ github.sha }} ./Auth-service
        docker build -t your-registry/frontend:${{ github.sha }} ./frontend-profit-first/client
        docker push your-registry/backend:${{ github.sha }}
        docker push your-registry/frontend:${{ github.sha }}
    
    - name: Update Kubernetes manifests
      run: |
        sed -i "s|your-registry/backend:latest|your-registry/backend:${{ github.sha }}|" k8s/backend/backend-deployment.yaml
        sed -i "s|your-registry/frontend:latest|your-registry/frontend:${{ github.sha }}|" k8s/frontend/frontend-deployment.yaml
    
    - name: Commit and push
      run: |
        git config user.name github-actions
        git config user.email github-actions@github.com
        git add k8s/
        git commit -m "Update image tags to ${{ github.sha }}"
        git push
```

## Security Best Practices

1. **Never commit secrets** - Use `.env` files (gitignored)
2. **Use Kubernetes Secrets** - For sensitive data
3. **Enable RBAC** - Restrict access to resources
4. **Use Network Policies** - Control pod communication
5. **Scan images** - Use tools like Trivy
6. **Enable TLS** - Use cert-manager for certificates
7. **Regular updates** - Keep dependencies updated
8. **Audit logs** - Enable Kubernetes audit logging

## Performance Optimization

1. **Resource Limits** - Set appropriate CPU/memory limits
2. **HPA** - Auto-scale based on metrics
3. **Redis Caching** - Reduce database queries
4. **CDN** - Serve static assets from CDN
5. **Image Optimization** - Use multi-stage builds
6. **Connection Pooling** - Reuse database connections

## Support & Documentation

- [Docker Setup Guide](DOCKER_SETUP.md)
- [Kubernetes Setup Guide](KUBERNETES_SETUP.md)
- [Project Structure](PROJECT_STRUCTURE.md)
- [ArgoCD README](argocd/README.md)
- [Monitoring README](monitoring/README.md)
- [K8s README](k8s/README.md)

## Quick Reference

### Docker Commands
```bash
docker-compose up -d              # Start services
docker-compose down               # Stop services
docker-compose logs -f            # View logs
docker-compose ps                 # List services
docker-compose restart <service>  # Restart service
```

### Kubernetes Commands
```bash
kubectl get pods -n profit-first          # List pods
kubectl logs -f -n profit-first <pod>     # View logs
kubectl describe pod -n profit-first <pod> # Pod details
kubectl exec -it -n profit-first <pod> sh # Shell access
kubectl port-forward -n profit-first svc/backend 3000:3000 # Port forward
```

### Monitoring Commands
```bash
kubectl get all -n monitoring             # List monitoring resources
kubectl port-forward -n monitoring svc/prometheus 9090:9090 # Prometheus
kubectl port-forward -n monitoring svc/grafana 3000:3000    # Grafana
```
