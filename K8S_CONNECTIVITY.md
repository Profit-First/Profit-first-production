# Kubernetes Internal Connectivity Guide

## 🔗 Service Communication Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        KUBERNETES CLUSTER                        │
│                      Namespace: profit-first                     │
│                                                                  │
│  ┌──────────────┐         ┌──────────────┐      ┌───────────┐  │
│  │   Frontend   │────────▶│   Backend    │─────▶│   Redis   │  │
│  │   (Nginx)    │  /api   │  (Node.js)   │      │  (Cache)  │  │
│  │   Port: 80   │         │  Port: 3000  │      │ Port:6379 │  │
│  └──────────────┘         └──────────────┘      └───────────┘  │
│         │                         │                     │        │
│         │                         │                     │        │
│    ┌────▼────┐              ┌────▼────┐          ┌─────▼─────┐ │
│    │ Service │              │ Service │          │  Service  │ │
│    │frontend │              │ backend │          │   redis   │ │
│    │ClusterIP│              │ClusterIP│          │ ClusterIP │ │
│    └────┬────┘              └────┬────┘          └───────────┘ │
│         │                         │                              │
└─────────┼─────────────────────────┼──────────────────────────────┘
          │                         │
          │                         │
     ┌────▼─────────────────────────▼────┐
     │          Ingress Controller        │
     │    Routes external traffic to      │
     │    frontend and backend services   │
     └────────────────┬───────────────────┘
                      │
                      │
              ┌───────▼────────┐
              │  External User  │
              │   (Browser)     │
              └─────────────────┘
```

## 📡 Internal Service Communication

### 1. Frontend → Backend
**How it works:**
- Frontend runs Nginx on port 80
- Nginx configuration proxies `/api/*` requests to backend
- Uses Kubernetes service DNS: `http://backend:3000`

**Configuration:**
```nginx
# frontend-profit-first/client/nginx.conf
location /api {
    proxy_pass http://backend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

**Kubernetes Service:**
```yaml
# k8s/backend/backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: backend  # DNS name: backend.profit-first.svc.cluster.local
  namespace: profit-first
spec:
  type: ClusterIP
  ports:
  - port: 3000
    targetPort: 3000
  selector:
    app: backend
```

**Example Request Flow:**
```
User Browser → https://yourdomain.com/api/auth/login
     ↓
Ingress → frontend service (port 80)
     ↓
Nginx in frontend pod → http://backend:3000/api/auth/login
     ↓
Backend pod processes request
```

### 2. Backend → Redis
**How it works:**
- Backend connects to Redis using environment variable `REDIS_URL`
- Uses Kubernetes service DNS: `redis://redis:6379`
- Redis client in backend automatically resolves service name

**Configuration:**
```yaml
# k8s/backend/backend-configmap.yaml
data:
  REDIS_URL: "redis://redis:6379"
```

**Backend Code:**
```javascript
// Auth-service/config/redis.config.js
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
```

**Kubernetes Service:**
```yaml
# k8s/redis/redis-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: redis  # DNS name: redis.profit-first.svc.cluster.local
  namespace: profit-first
spec:
  type: ClusterIP
  ports:
  - port: 6379
    targetPort: 6379
  selector:
    app: redis
```

**Example Connection Flow:**
```
Backend pod starts
     ↓
Reads REDIS_URL from environment: redis://redis:6379
     ↓
Kubernetes DNS resolves 'redis' to redis.profit-first.svc.cluster.local
     ↓
Connects to Redis service (ClusterIP: 10.100.x.x:6379)
     ↓
Redis service routes to Redis pod
     ↓
Connection established ✅
```

## 🌐 Kubernetes DNS Resolution

### Service DNS Names
In Kubernetes, services can be accessed using DNS names:

**Short form (same namespace):**
```
redis          → redis.profit-first.svc.cluster.local
backend        → backend.profit-first.svc.cluster.local
frontend       → frontend.profit-first.svc.cluster.local
```

**Full form (any namespace):**
```
redis.profit-first.svc.cluster.local
backend.profit-first.svc.cluster.local
frontend.profit-first.svc.cluster.local
```

### Why This Works
1. All pods in `profit-first` namespace can use short names
2. Kubernetes DNS automatically resolves service names to ClusterIP
3. ClusterIP load balances across all healthy pods with matching labels

## 🔧 Configuration Files Summary

### Backend Configuration
**File:** `k8s/backend/backend-configmap.yaml`
```yaml
data:
  NODE_ENV: "production"
  PORT: "3000"
  REDIS_URL: "redis://redis:6379"  # ← Connects to Redis service
  FRONTEND_URL: "https://yourdomain.com"  # ← For CORS
  AWS_REGION: "ap-south-1"
```

### Frontend Configuration
**File:** `k8s/frontend/frontend-configmap.yaml`
```yaml
data:
  VITE_API_URL: "/api"  # ← Nginx proxies to backend
```

### Nginx Proxy Configuration
**File:** `frontend-profit-first/client/nginx.conf`
```nginx
location /api {
    proxy_pass http://backend:3000;  # ← Proxies to backend service
}
```

## 🧪 Testing Connectivity

### Test 1: Redis Connection from Backend
```bash
# Get backend pod name
kubectl get pods -n profit-first -l app=backend

# Test Redis connection from backend pod
kubectl exec -it <backend-pod-name> -n profit-first -- sh

# Inside pod, test Redis
apk add redis  # Install redis-cli if not present
redis-cli -h redis ping
# Expected: PONG
```

### Test 2: Backend API from Frontend
```bash
# Get frontend pod name
kubectl get pods -n profit-first -l app=frontend

# Test backend connection from frontend pod
kubectl exec -it <frontend-pod-name> -n profit-first -- sh

# Inside pod, test backend
wget -O- http://backend:3000/health
# Expected: {"status":"OK"}
```

### Test 3: Full Request Flow
```bash
# Port forward to frontend
kubectl port-forward -n profit-first svc/frontend 8080:80

# Test API request through frontend
curl http://localhost:8080/api/health
# Expected: {"status":"OK"}
```

### Test 4: DNS Resolution
```bash
# From any pod in profit-first namespace
kubectl exec -it <any-pod> -n profit-first -- sh

# Test DNS resolution
nslookup redis
nslookup backend
nslookup frontend

# Expected output shows ClusterIP addresses
```

## 🚨 Troubleshooting

### Issue: Backend can't connect to Redis
**Symptoms:**
- Backend logs show: `Redis connection failed`
- Backend pod crashes or restarts

**Debug Steps:**
```bash
# 1. Check if Redis pod is running
kubectl get pods -n profit-first -l app=redis

# 2. Check Redis service exists
kubectl get svc redis -n profit-first

# 3. Check Redis logs
kubectl logs -l app=redis -n profit-first

# 4. Test Redis from backend pod
kubectl exec -it <backend-pod> -n profit-first -- redis-cli -h redis ping

# 5. Check backend environment variables
kubectl exec -it <backend-pod> -n profit-first -- env | grep REDIS
```

**Common Causes:**
- Redis pod not running → Check pod status
- Wrong service name → Should be `redis` not `redis-service`
- Wrong port → Should be `6379`
- Network policy blocking traffic → Check network policies

### Issue: Frontend can't reach Backend
**Symptoms:**
- API requests fail with 502 Bad Gateway
- Frontend shows connection errors

**Debug Steps:**
```bash
# 1. Check if backend pods are running
kubectl get pods -n profit-first -l app=backend

# 2. Check backend service
kubectl get svc backend -n profit-first

# 3. Test backend from frontend pod
kubectl exec -it <frontend-pod> -n profit-first -- wget -O- http://backend:3000/health

# 4. Check nginx configuration
kubectl exec -it <frontend-pod> -n profit-first -- cat /etc/nginx/conf.d/default.conf

# 5. Check nginx logs
kubectl logs -l app=frontend -n profit-first
```

**Common Causes:**
- Backend pods not ready → Check health probes
- Wrong service name in nginx.conf → Should be `backend`
- Wrong port → Should be `3000`
- Backend crashed → Check backend logs

### Issue: External requests fail
**Symptoms:**
- Can't access application from browser
- Ingress returns 404 or 503

**Debug Steps:**
```bash
# 1. Check ingress
kubectl get ingress -n profit-first

# 2. Check ingress details
kubectl describe ingress profit-first-ingress -n profit-first

# 3. Check if services are accessible
kubectl port-forward -n profit-first svc/frontend 8080:80
kubectl port-forward -n profit-first svc/backend 3000:3000

# 4. Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

## ✅ Verification Checklist

- [ ] Redis pod is running
- [ ] Redis service exists and has ClusterIP
- [ ] Backend pods are running (2 replicas)
- [ ] Backend service exists and has ClusterIP
- [ ] Backend can connect to Redis (check logs)
- [ ] Frontend pods are running (2 replicas)
- [ ] Frontend service exists and has ClusterIP
- [ ] Nginx config proxies /api to backend
- [ ] Ingress routes traffic to frontend and backend
- [ ] All health checks passing
- [ ] DNS resolution works for all services

## 📊 Network Flow Summary

**Internal Communication (ClusterIP):**
```
Frontend Pod → backend:3000 → Backend Pod → redis:6379 → Redis Pod
```

**External Communication (via Ingress):**
```
User → Ingress → frontend:80 → Frontend Pod
User → Ingress → backend:3000 → Backend Pod
```

**Key Points:**
1. ✅ All services use ClusterIP (internal only)
2. ✅ Ingress provides external access
3. ✅ DNS names resolve automatically within namespace
4. ✅ No hardcoded IP addresses needed
5. ✅ Services load balance across multiple pods

Your application is now properly configured for internal Kubernetes networking! 🚀
