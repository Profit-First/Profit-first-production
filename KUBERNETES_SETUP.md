# Kubernetes Setup Guide with Kubeadm, ArgoCD, Prometheus & Grafana

Complete guide to deploy Profit First application on Kubernetes cluster.

## Prerequisites

- Ubuntu/Debian server (minimum 2 CPUs, 4GB RAM)
- Root or sudo access
- Docker installed
- Internet connectivity

## Table of Contents

1. [Kubernetes Cluster Setup with Kubeadm](#1-kubernetes-cluster-setup-with-kubeadm)
2. [Install ArgoCD](#2-install-argocd)
3. [Deploy Application](#3-deploy-application)
4. [Install Prometheus](#4-install-prometheus)
5. [Install Grafana](#5-install-grafana)
6. [Configure Monitoring](#6-configure-monitoring)

---

## 1. Kubernetes Cluster Setup with Kubeadm

### Step 1.1: Prepare the System

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Disable swap
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# Load kernel modules
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

# Configure sysctl
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system
```

### Step 1.2: Install Container Runtime (containerd)

```bash
# Install containerd
sudo apt-get install -y containerd

# Configure containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml

# Enable SystemdCgroup
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

# Restart containerd
sudo systemctl restart containerd
sudo systemctl enable containerd
```

### Step 1.3: Install Kubeadm, Kubelet, and Kubectl

```bash
# Add Kubernetes repository
sudo apt-get install -y apt-transport-https ca-certificates curl gpg

curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

# Install Kubernetes components
sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl

# Enable kubelet
sudo systemctl enable kubelet
```

### Step 1.4: Initialize Kubernetes Cluster (Master Node)

```bash
# Initialize cluster
sudo kubeadm init --pod-network-cidr=10.244.0.0/16

# Configure kubectl for current user
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# Verify cluster
kubectl get nodes
```

### Step 1.5: Install Pod Network (Flannel)

```bash
# Install Flannel CNI
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

# Wait for all pods to be ready
kubectl get pods -n kube-flannel
kubectl get pods -n kube-system
```

### Step 1.6: Join Worker Nodes (Optional)

On worker nodes, run the join command from kubeadm init output:

```bash
sudo kubeadm join <master-ip>:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>
```

---

## 2. Install ArgoCD

### Step 2.1: Install ArgoCD

```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD pods to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
```

### Step 2.2: Expose ArgoCD Server

```bash
# Apply NodePort service
kubectl apply -f argocd/argocd-install.yaml

# Or use port-forward for testing
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

### Step 2.3: Get ArgoCD Admin Password

```bash
# Get initial password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo

# Access ArgoCD UI
# URL: https://<node-ip>:30443
# Username: admin
# Password: <from above command>
```

### Step 2.4: Install ArgoCD CLI (Optional)

```bash
# Download ArgoCD CLI
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
rm argocd-linux-amd64

# Login to ArgoCD
argocd login <node-ip>:30443 --username admin --password <password> --insecure

# Change password
argocd account update-password
```

---

## 3. Deploy Application

### Step 3.1: Create Namespace

```bash
# Create profit-first namespace
kubectl apply -f k8s/namespace.yaml
```

### Step 3.2: Update Secrets

Edit `k8s/backend/backend-secret.yaml` with your actual credentials:

```bash
# Edit secret file
nano k8s/backend/backend-secret.yaml

# Apply secrets
kubectl apply -f k8s/backend/backend-secret.yaml
```

### Step 3.3: Deploy Redis

```bash
# Deploy Redis
kubectl apply -f k8s/redis/redis-pvc.yaml
kubectl apply -f k8s/redis/redis-deployment.yaml
kubectl apply -f k8s/redis/redis-service.yaml

# Verify Redis
kubectl get pods -n profit-first -l app=redis
```

### Step 3.4: Deploy Backend

```bash
# Apply backend resources
kubectl apply -f k8s/backend/backend-configmap.yaml
kubectl apply -f k8s/backend/backend-deployment.yaml
kubectl apply -f k8s/backend/backend-service.yaml
kubectl apply -f k8s/backend/backend-hpa.yaml

# Verify backend
kubectl get pods -n profit-first -l app=backend
kubectl logs -f -n profit-first -l app=backend
```

### Step 3.5: Deploy Frontend

```bash
# Apply frontend resources
kubectl apply -f k8s/frontend/frontend-configmap.yaml
kubectl apply -f k8s/frontend/frontend-deployment.yaml
kubectl apply -f k8s/frontend/frontend-service.yaml

# Verify frontend
kubectl get pods -n profit-first -l app=frontend
```

### Step 3.6: Setup Ingress (Optional)

```bash
# Install Nginx Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Apply ingress
kubectl apply -f k8s/ingress/ingress.yaml

# Get ingress IP
kubectl get ingress -n profit-first
```

### Step 3.7: Deploy with ArgoCD

```bash
# Update Git repository URL in argocd/application.yaml
nano argocd/application.yaml

# Apply ArgoCD application
kubectl apply -f argocd/application.yaml

# Check application status
kubectl get applications -n argocd
argocd app get profit-first-app
```

---

## 4. Install Prometheus

### Step 4.1: Create Monitoring Namespace

```bash
# Create namespace
kubectl apply -f monitoring/prometheus/prometheus-namespace.yaml
```

### Step 4.2: Deploy Prometheus

```bash
# Apply RBAC
kubectl apply -f monitoring/prometheus/prometheus-rbac.yaml

# Apply ConfigMap
kubectl apply -f monitoring/prometheus/prometheus-configmap.yaml

# Apply PVC
kubectl apply -f monitoring/prometheus/prometheus-pvc.yaml

# Deploy Prometheus
kubectl apply -f monitoring/prometheus/prometheus-deployment.yaml
kubectl apply -f monitoring/prometheus/prometheus-service.yaml

# Verify Prometheus
kubectl get pods -n monitoring -l app=prometheus
```

### Step 4.3: Access Prometheus

```bash
# Access via NodePort
# URL: http://<node-ip>:30090

# Or port-forward
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# URL: http://localhost:9090
```

---

## 5. Install Grafana

### Step 5.1: Deploy Grafana

```bash
# Apply secret (change password first!)
kubectl apply -f monitoring/grafana/grafana-secret.yaml

# Apply ConfigMap
kubectl apply -f monitoring/grafana/grafana-configmap.yaml

# Apply PVC
kubectl apply -f monitoring/grafana/grafana-pvc.yaml

# Deploy Grafana
kubectl apply -f monitoring/grafana/grafana-deployment.yaml
kubectl apply -f monitoring/grafana/grafana-service.yaml

# Verify Grafana
kubectl get pods -n monitoring -l app=grafana
```

### Step 5.2: Access Grafana

```bash
# Access via NodePort
# URL: http://<node-ip>:30300
# Username: admin
# Password: admin123 (or what you set in grafana-secret.yaml)

# Or port-forward
kubectl port-forward -n monitoring svc/grafana 3000:3000
# URL: http://localhost:3000
```

---

## 6. Configure Monitoring

### Step 6.1: Verify Prometheus Data Source in Grafana

1. Login to Grafana
2. Go to Configuration → Data Sources
3. Prometheus should be already configured
4. Click "Test" to verify connection

### Step 6.2: Import Dashboards

Import these dashboard IDs in Grafana:

- **Kubernetes Cluster Monitoring**: 315
- **Node Exporter Full**: 1860
- **Kubernetes Pod Monitoring**: 6417
- **Redis Dashboard**: 11835

Steps:
1. Go to Dashboards → Import
2. Enter dashboard ID
3. Select Prometheus data source
4. Click Import

### Step 6.3: Create Custom Dashboard for Application

1. Go to Dashboards → New Dashboard
2. Add panels for:
   - Backend API response time
   - Request rate
   - Error rate
   - Redis cache hit rate
   - Pod CPU/Memory usage

---

## Verification Commands

```bash
# Check all resources
kubectl get all -n profit-first
kubectl get all -n monitoring
kubectl get all -n argocd

# Check pod logs
kubectl logs -f -n profit-first <pod-name>

# Check pod details
kubectl describe pod -n profit-first <pod-name>

# Check services
kubectl get svc -n profit-first
kubectl get svc -n monitoring

# Check ingress
kubectl get ingress -n profit-first

# Check HPA
kubectl get hpa -n profit-first

# Check PVC
kubectl get pvc -n profit-first
kubectl get pvc -n monitoring
```

---

## Troubleshooting

### Pods not starting

```bash
# Check pod events
kubectl describe pod -n profit-first <pod-name>

# Check logs
kubectl logs -n profit-first <pod-name>

# Check previous logs (if pod restarted)
kubectl logs -n profit-first <pod-name> --previous
```

### Backend can't connect to Redis

```bash
# Check Redis service
kubectl get svc -n profit-first redis

# Test Redis connection
kubectl run -it --rm redis-test --image=redis:7-alpine --restart=Never -n profit-first -- redis-cli -h redis ping
```

### Prometheus not scraping metrics

```bash
# Check Prometheus targets
# Go to Prometheus UI → Status → Targets

# Check service discovery
# Go to Prometheus UI → Status → Service Discovery

# Check RBAC permissions
kubectl get clusterrolebinding prometheus
```

### Grafana can't connect to Prometheus

```bash
# Check Prometheus service
kubectl get svc -n monitoring prometheus

# Test connection from Grafana pod
kubectl exec -it -n monitoring <grafana-pod> -- curl http://prometheus:9090/api/v1/status/config
```

---

## Cleanup

```bash
# Delete application
kubectl delete namespace profit-first

# Delete monitoring
kubectl delete namespace monitoring

# Delete ArgoCD
kubectl delete namespace argocd

# Reset cluster (WARNING: This will destroy the cluster)
sudo kubeadm reset
sudo rm -rf /etc/cni/net.d
sudo rm -rf $HOME/.kube/config
```

---

## Production Recommendations

1. **High Availability**: Deploy 3 master nodes
2. **Persistent Storage**: Use cloud provider storage classes
3. **SSL/TLS**: Configure cert-manager for automatic certificates
4. **Backup**: Setup Velero for cluster backups
5. **Monitoring**: Add alerting rules in Prometheus
6. **Logging**: Deploy EFK/ELK stack
7. **Security**: Implement Network Policies
8. **Secrets**: Use external secret management (Vault, AWS Secrets Manager)
9. **CI/CD**: Integrate with GitHub Actions or GitLab CI
10. **Resource Limits**: Set proper resource requests and limits

---

## Useful Links

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kubeadm Documentation](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
