#!/bin/bash

# Deployment script for Profit First application

set -e

echo "🚀 Deploying Profit First Application to Kubernetes"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed${NC}"
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Connected to Kubernetes cluster${NC}"

# Create namespace
echo -e "${YELLOW}📦 Creating namespace...${NC}"
kubectl apply -f k8s/namespace.yaml

# Deploy Redis
echo -e "${YELLOW}📦 Deploying Redis...${NC}"
kubectl apply -f k8s/redis/redis-pvc.yaml
kubectl apply -f k8s/redis/redis-deployment.yaml
kubectl apply -f k8s/redis/redis-service.yaml

# Wait for Redis to be ready
echo -e "${YELLOW}⏳ Waiting for Redis to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=redis -n profit-first --timeout=120s

# Deploy Backend
echo -e "${YELLOW}📦 Deploying Backend...${NC}"
kubectl apply -f k8s/backend/backend-configmap.yaml
kubectl apply -f k8s/backend/backend-secret.yaml
kubectl apply -f k8s/backend/backend-deployment.yaml
kubectl apply -f k8s/backend/backend-service.yaml
kubectl apply -f k8s/backend/backend-hpa.yaml

# Wait for Backend to be ready
echo -e "${YELLOW}⏳ Waiting for Backend to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=backend -n profit-first --timeout=180s

# Deploy Frontend
echo -e "${YELLOW}📦 Deploying Frontend...${NC}"
kubectl apply -f k8s/frontend/frontend-configmap.yaml
kubectl apply -f k8s/frontend/frontend-deployment.yaml
kubectl apply -f k8s/frontend/frontend-service.yaml

# Wait for Frontend to be ready
echo -e "${YELLOW}⏳ Waiting for Frontend to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=frontend -n profit-first --timeout=120s

# Deploy Ingress (optional)
if [ -f "k8s/ingress/ingress.yaml" ]; then
    echo -e "${YELLOW}📦 Deploying Ingress...${NC}"
    kubectl apply -f k8s/ingress/ingress.yaml
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "📊 Application Status:"
kubectl get all -n profit-first

echo ""
echo "🔗 Access your application:"
echo "  Backend:  kubectl port-forward -n profit-first svc/backend 3000:3000"
echo "  Frontend: kubectl port-forward -n profit-first svc/frontend 8080:80"
