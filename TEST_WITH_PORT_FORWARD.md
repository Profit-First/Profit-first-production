# Testing Application with Port-Forward (No Domain Required)

## Quick Test Setup

### Step 1: Check All Pods Running
```bash
kubectl get pods -n profit-first
```

Expected:
```
NAME                        READY   STATUS    RESTARTS   AGE
backend-xxx-xxx             1/1     Running   0          5m
backend-xxx-yyy             1/1     Running   0          5m
frontend-xxx-xxx            1/1     Running   0          5m
frontend-xxx-yyy            1/1     Running   0          5m
redis-xxx-xxx               1/1     Running   0          6m
```

### Step 2: Test Backend Directly
```bash
# Terminal 1: Expose backend
kubectl port-forward -n profit-first svc/backend 3000:3000

# Terminal 2: Test backend
curl http://localhost:3000/health
```

Expected: `{"status":"OK"}`

### Step 3: Test Frontend
```bash
# Terminal 3: Expose frontend
kubectl port-forward -n profit-first svc/frontend 8082:80

# Open browser: http://localhost:8082
```

## If Frontend Shows "Cannot connect to server"

This means frontend can't reach backend. The issue is that nginx inside the frontend pod tries to proxy to `http://backend:3000`, but this only works inside the cluster.

### Solution: Use kubectl exec to test

```bash
# Get frontend pod name
kubectl get pods -n profit-first -l app=frontend

# Test backend from inside frontend pod
kubectl exec -it <frontend-pod-name> -n profit-first -- wget -O- http://backend:3000/health
```

If this works, the internal networking is fine. The issue is just with port-forward testing.

### Better Testing Method: Use Ingress or NodePort

**Option 1: Change services to NodePort (for testing)**

```bash
# Edit backend service
kubectl patch svc backend -n profit-first -p '{"spec":{"type":"NodePort"}}'

# Edit frontend service  
kubectl patch svc frontend -n profit-first -p '{"spec":{"type":"NodePort"}}'

# Get NodePort ports
kubectl get svc -n profit-first

# Access via NodePort
# Frontend: http://<node-ip>:<frontend-nodeport>
# Backend: http://<node-ip>:<backend-nodeport>
```

**Option 2: Use LoadBalancer (if cloud provider supports)**

```bash
kubectl patch svc frontend -n profit-first -p '{"spec":{"type":"LoadBalancer"}}'
kubectl get svc frontend -n profit-first
# Wait for EXTERNAL-IP
```

## Troubleshooting

### Backend Pods Crashing
```bash
# Check logs
kubectl logs -l app=backend -n profit-first --tail=50

# Common issue: Missing secrets
# Update k8s/backend/backend-secret.yaml
```

### Frontend Can't Reach Backend
```bash
# Test from inside frontend pod
kubectl exec -it <frontend-pod> -n profit-first -- sh
wget -O- http://backend:3000/health

# If this works, internal networking is fine
```

### Redis Connection Issues
```bash
# Test Redis
kubectl run -it --rm redis-test --image=redis:7-alpine --restart=Never -n profit-first -- redis-cli -h redis ping

# Check backend logs for Redis connection
kubectl logs -l app=backend -n profit-first | grep -i redis
```
