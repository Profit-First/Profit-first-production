# Kubernetes Networking - Backend & Frontend Communication

## How Backend and Frontend Interact in Kubernetes Cluster

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Namespace: profit-first                │    │
│  │                                                      │    │
│  │  ┌──────────────┐         ┌──────────────┐        │    │
│  │  │   Frontend   │         │   Backend    │        │    │
│  │  │   Pod(s)     │────────▶│   Pod(s)     │        │    │
│  │  │  (Nginx)     │         │  (Express)   │        │    │
│  │  └──────────────┘         └──────────────┘        │    │
│  │         │                         │                │    │
│  │         │                         │                │    │
│  │  ┌──────▼──────┐         ┌───────▼──────┐        │    │
│  │  │  Frontend   │         │   Backend    │        │    │
│  │  │  Service    │         │   Service    │        │    │
│  │  │ (ClusterIP) │         │ (ClusterIP)  │        │    │
│  │  └─────────────┘         └──────────────┘        │    │
│  │         │                         │                │    │
│  └─────────┼─────────────────────────┼────────────────┘    │
│            │                         │                      │
│  ┌─────────▼─────────────────────────▼────────────────┐    │
│  │              Ingress Controller                     │    │
│  │  (Routes traffic based on domain/path)             │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Internet  │
                    │    Users    │
                    └─────────────┘
```

## Communication Methods

### Method 1: Nginx Proxy (Recommended - Already Configured)

**How it works:**
1. User accesses frontend at `http://yourdomain.com`
2. Frontend (Nginx) serves React app
3. React app makes API calls to `/api/*`
4. Nginx proxies `/api/*` requests to backend service
5. Backend processes request and returns response

**Configuration in `frontend-profit-first/client/nginx.conf`:**

```nginx
# Proxy API requests to backend
location /api {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

**Key Points:**
- `http://backend:3000` - Uses Kubernetes DNS
- `backend` - Name of backend Service
- `3000` - Backend service port
- All `/api` requests are automatically forwarded to backend

### Method 2: Ingress Controller (Production)

**How it works:**
1. Ingress routes traffic based on domain/path
2. `yourdomain.com` → Frontend Service
3. `api.yourdomain.com` → Backend Service

**Configuration in `k8s/ingress/ingress.yaml`:**

```yaml
spec:
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
  
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 3000
```

## Kubernetes DNS Resolution

### How Services Communicate

Kubernetes provides built-in DNS for service discovery:

**DNS Format:**
```
<service-name>.<namespace>.svc.cluster.local
```

**Examples:**
```bash
# Full DNS name
backend.profit-first.svc.cluster.local

# Short name (within same namespace)
backend

# With port
backend:3000
```

### Service Configuration

**Backend Service (`k8s/backend/backend-service.yaml`):**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend              # DNS name: backend
  namespace: profit-first
spec:
  type: ClusterIP           # Internal only
  ports:
  - port: 3000              # Service port
    targetPort: 3000        # Container port
  selector:
    app: backend            # Selects backend pods
```

**Frontend Service (`k8s/frontend/frontend-service.yaml`):**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: profit-first
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: frontend
```

## Network Flow Examples

### Example 1: User Loads Website

```
1. User → http://yourdomain.com
2. Ingress → frontend Service (port 80)
3. Service → frontend Pod (Nginx)
4. Nginx → Serves React app (index.html, JS, CSS)
5. Browser loads React app
```

### Example 2: API Call from Frontend

```
1. React app → fetch('/api/data/dashboard')
2. Browser → http://yourdomain.com/api/data/dashboard
3. Nginx (in frontend pod) → Proxies to http://backend:3000/api/data/dashboard
4. Kubernetes DNS → Resolves 'backend' to backend Service IP
5. Backend Service → Routes to backend Pod
6. Backend Pod → Processes request
7. Response → backend Pod → Service → Nginx → Browser
```

### Example 3: Direct Backend Access (Development)

```bash
# Port forward to backend
kubectl port-forward -n profit-first svc/backend 3000:3000

# Now accessible at
curl http://localhost:3000/health
```

## Network Policies (Optional Security)

To restrict communication, you can add Network Policies:

**Allow only frontend to backend:**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-network-policy
  namespace: profit-first
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 3000
```

## Service Types Explained

### ClusterIP (Default - Used in Your Setup)
- **Internal only** - Not accessible from outside cluster
- **Use case:** Backend, Redis, internal services
- **Access:** Only from within cluster or via Ingress

### NodePort (Used for Monitoring)
- **External access** via `<node-ip>:<nodePort>`
- **Use case:** Prometheus (30090), Grafana (30300)
- **Port range:** 30000-32767

### LoadBalancer (Cloud Providers)
- **External IP** from cloud provider
- **Use case:** Production ingress
- **Cost:** Usually costs extra

## Environment Variables for Frontend

**In `k8s/frontend/frontend-configmap.yaml`:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: frontend-config
  namespace: profit-first
data:
  BACKEND_HOST: "backend"
  BACKEND_PORT: "3000"
  VITE_API_URL: "https://api.yourdomain.com"
```

**Usage in React:**
```javascript
// For production (via Ingress)
const API_URL = import.meta.env.VITE_API_URL || '/api';

// API calls
fetch(`${API_URL}/data/dashboard`)
```

## Testing Communication

### 1. Test Backend Service

```bash
# From within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n profit-first -- curl http://backend:3000/health

# Expected output: {"status":"OK","timestamp":"..."}
```

### 2. Test Frontend to Backend

```bash
# Port forward frontend
kubectl port-forward -n profit-first svc/frontend 8080:80

# Open browser
http://localhost:8080

# Check browser console for API calls
# Should see requests to /api/* being proxied to backend
```

### 3. Test DNS Resolution

```bash
# Get a shell in frontend pod
kubectl exec -it -n profit-first <frontend-pod-name> -- sh

# Test DNS
nslookup backend
# Should resolve to backend service IP

# Test connection
wget -O- http://backend:3000/health
```

## Common Issues & Solutions

### Issue 1: Frontend can't reach backend

**Symptoms:**
- API calls fail with connection refused
- Network errors in browser console

**Solutions:**
```bash
# Check backend service exists
kubectl get svc -n profit-first backend

# Check backend pods are running
kubectl get pods -n profit-first -l app=backend

# Check backend logs
kubectl logs -n profit-first -l app=backend

# Verify nginx config
kubectl exec -n profit-first <frontend-pod> -- cat /etc/nginx/conf.d/default.conf
```

### Issue 2: DNS not resolving

**Symptoms:**
- "backend: Name or service not known"

**Solutions:**
```bash
# Check CoreDNS is running
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check service exists in same namespace
kubectl get svc -n profit-first

# Use full DNS name
http://backend.profit-first.svc.cluster.local:3000
```

### Issue 3: CORS errors

**Symptoms:**
- CORS policy errors in browser

**Solutions:**
- Backend already configured for CORS in `Server.js`
- Check `FRONTEND_URL` in backend environment
- Verify Nginx proxy headers are set

## Production Best Practices

### 1. Use Ingress with TLS

```yaml
spec:
  tls:
  - hosts:
    - yourdomain.com
    - api.yourdomain.com
    secretName: profit-first-tls
```

### 2. Separate API Domain

- Frontend: `https://yourdomain.com`
- Backend: `https://api.yourdomain.com`

### 3. Enable Network Policies

Restrict pod-to-pod communication for security.

### 4. Use Service Mesh (Advanced)

Consider Istio or Linkerd for:
- Mutual TLS
- Traffic management
- Observability

## Monitoring Network Traffic

### View Service Endpoints

```bash
# See which pods are behind a service
kubectl get endpoints -n profit-first backend
kubectl get endpoints -n profit-first frontend
```

### Check Network Connectivity

```bash
# From frontend to backend
kubectl exec -n profit-first <frontend-pod> -- wget -O- http://backend:3000/health

# From backend to redis
kubectl exec -n profit-first <backend-pod> -- redis-cli -h redis ping
```

### Monitor with Prometheus

Prometheus already configured to scrape:
- Kubernetes services
- Backend metrics
- Pod metrics

Access: http://<node-ip>:30090

## Summary

**Your Setup:**
1. ✅ Frontend (Nginx) proxies `/api/*` to backend
2. ✅ Backend Service provides stable endpoint
3. ✅ Kubernetes DNS resolves service names
4. ✅ ClusterIP keeps services internal
5. ✅ Ingress provides external access
6. ✅ All communication is within cluster (secure)

**Communication Path:**
```
User → Ingress → Frontend Service → Frontend Pod (Nginx)
                                          ↓
                                    Proxy /api/*
                                          ↓
                                   Backend Service → Backend Pod
```

**Key Files:**
- `frontend-profit-first/client/nginx.conf` - Proxy configuration
- `k8s/backend/backend-service.yaml` - Backend service
- `k8s/frontend/frontend-service.yaml` - Frontend service
- `k8s/ingress/ingress.yaml` - External routing

Everything is already configured and ready to work! 🚀
