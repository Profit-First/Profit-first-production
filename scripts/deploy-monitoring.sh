#!/bin/bash

# Monitoring deployment script

set -e

echo "📊 Deploying Monitoring Stack (Prometheus & Grafana)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create monitoring namespace
echo -e "${YELLOW}📦 Creating monitoring namespace...${NC}"
kubectl apply -f monitoring/prometheus/prometheus-namespace.yaml

# Deploy Prometheus
echo -e "${YELLOW}📦 Deploying Prometheus...${NC}"
kubectl apply -f monitoring/prometheus/prometheus-rbac.yaml
kubectl apply -f monitoring/prometheus/prometheus-configmap.yaml
kubectl apply -f monitoring/prometheus/prometheus-pvc.yaml
kubectl apply -f monitoring/prometheus/prometheus-deployment.yaml
kubectl apply -f monitoring/prometheus/prometheus-service.yaml

# Wait for Prometheus
echo -e "${YELLOW}⏳ Waiting for Prometheus...${NC}"
kubectl wait --for=condition=ready pod -l app=prometheus -n monitoring --timeout=180s

# Deploy Grafana
echo -e "${YELLOW}📦 Deploying Grafana...${NC}"
kubectl apply -f monitoring/grafana/grafana-secret.yaml
kubectl apply -f monitoring/grafana/grafana-configmap.yaml
kubectl apply -f monitoring/grafana/grafana-pvc.yaml
kubectl apply -f monitoring/grafana/grafana-deployment.yaml
kubectl apply -f monitoring/grafana/grafana-service.yaml

# Wait for Grafana
echo -e "${YELLOW}⏳ Waiting for Grafana...${NC}"
kubectl wait --for=condition=ready pod -l app=grafana -n monitoring --timeout=180s

echo -e "${GREEN}✅ Monitoring stack deployed successfully!${NC}"
echo ""
echo "📊 Monitoring Status:"
kubectl get all -n monitoring

echo ""
echo "🔗 Access monitoring:"
echo "  Prometheus: http://<node-ip>:30090"
echo "  Grafana:    http://<node-ip>:30300 (admin/admin123)"
