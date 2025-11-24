# ArgoCD Quick Start - Deploy in 5 Minutes

## ✅ Pre-Deployment Checklist

Before syncing ArgoCD, ensure:

1. **ECR Repositories Created**
   ```bash
   # Run this GitHub Actions workflow first
   # Go to: Actions → "Create ECR Repositories" → Run workflow
   ```

2. **Docker Images Built & Pushed**
   ```bash
   # Run these workflows to build images:
   # Actions → "Backend CI/CD" → Run workflow
   # Actions → "Frontend CI/CD" → Run workflow
   # OR
   # Actions → "Full Deploy" → Run workflow (builds both)
   ```

3. **Update Secrets** (CRITICAL!)
   ```bash
   # Edit: k8s/backend/backend-secret.yaml
   # Replace ALL placeholder values with real credentials
   ```

## 🚀 Deploy with ArgoCD

### Step 1: Install ArgoCD (if not installed)
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### Step 2: Apply ArgoCD Application
```bash
kubectl apply -f argocd/application.yaml
```

### Step 3: Watch Deployment
```bash
# Watch ArgoCD sync
kubectl get application profit-first-app -n argocd -w

# Watch pods starting
kubectl get pods -n profit-first -w
```

## ✅ Verify Deployment

### Check All Resources
```bash
kubectl get all -n profit-first
```

**Expected Output:**
```
NAME                            READY   STATUS    RESTARTS   AGE
pod/backend-xxx-xxx             1/1     Running   0          2m
pod/backend-xxx-yyy             1/1     Running   0          2m
pod/frontend-xxx-xxx            1/1     Running   0          2m
pod/frontend-xxx-yyy            1/1     Running   0          2m
pod/redis-xxx-xxx               1/1     Running   0          3m

NAME               TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
service/backend    ClusterIP   10.100.x.x      <none>        3000/TCP   2m
service/frontend   ClusterIP   10.100.x.x      <none>        80/TCP     2m
service/redis      ClusterIP   10.100.x.x      <none>        6379/TCP   3m

NAME                       READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/backend    2/2     2            2           2m
deployment.apps/frontend   2/2     2            2           2m
deployment.apps/redis      1/1     1            1           3m
```

### Test Backend
```bash
kubectl port-forward -n profit-first svc/backend 3000:3000
curl http://localhost:3000/health
# Expected: {"status":"OK"}
```

### Test Frontend
```bash
kubectl port-forward -n profit-first svc/frontend 8080:80
# Open: http://localhost:8080
```

### Test Redis
```bash
kubectl run -it --rm redis-test --image=redis:7-alpine --restart=Never -n profit-first -- redis-cli -h redis ping
# Expected: PONG
```

## 🔧 Troubleshooting

### Pods in ImagePullBackOff
**Problem:** Can't pull images from ECR

**Solution:**
```bash
# 1. Check if images exist
aws ecr describe-images --repository-name profit-first-backend --region ap-south-1
aws ecr describe-images --repository-name profit-first-frontend --region ap-south-1

# 2. If no images, run GitHub Actions to build them
# Go to: Actions → "Full Deploy" → Run workflow

# 3. Check if cluster has ECR access (IAM role/credentials)
```

### Pods in CrashLoopBackOff
**Problem:** Container starts but crashes

**Solution:**
```bash
# Check logs
kubectl logs -l app=backend -n profit-first --tail=50
kubectl logs -l app=frontend -n profit-first --tail=50

# Common issues:
# - Missing environment variables (check secrets)
# - Can't connect to Redis (check Redis is running)
# - Port already in use
```

### Backend Can't Connect to Redis
**Problem:** Backend logs show Redis connection errors

**Solution:**
```bash
# 1. Check Redis is running
kubectl get pods -l app=redis -n profit-first

# 2. Check Redis service
kubectl get svc redis -n profit-first

# 3. Test Redis from backend pod
kubectl exec -it <backend-pod> -n profit-first -- redis-cli -h redis ping
```

### ArgoCD Not Syncing
**Problem:** Application shows "OutOfSync"

**Solution:**
```bash
# Manual sync
kubectl patch application profit-first-app -n argocd --type merge -p '{"operation":{"sync":{}}}'

# Check sync status
kubectl describe application profit-first-app -n argocd
```

## 📊 Deployment Flow

```
1. GitHub Actions builds images → Pushes to ECR
2. GitHub Actions updates k8s/backend/backend-deployment.yaml with new image tag
3. GitHub Actions commits changes to main branch
4. ArgoCD detects Git changes (every 3 minutes)
5. ArgoCD syncs changes to Kubernetes cluster
6. Kubernetes pulls new images from ECR
7. Kubernetes creates/updates pods
8. Health checks pass → Pods marked Ready
9. Service routes traffic to new pods
```

## 🎯 Success Criteria

✅ All pods in `Running` state  
✅ Backend health check returns 200  
✅ Frontend accessible via browser  
✅ Redis responds to PING  
✅ ArgoCD shows "Synced" and "Healthy"  

## 📝 Important Notes

1. **First Deployment:** May take 5-10 minutes for all pods to start
2. **Image Updates:** ArgoCD auto-syncs every 3 minutes
3. **Secrets:** Must be updated before deployment
4. **Domain:** Update `k8s/ingress/ingress.yaml` for production domain
5. **Monitoring:** Check logs regularly during first deployment

## 🔗 Useful Links

- ArgoCD UI: `kubectl port-forward svc/argocd-server -n argocd 8080:443` → https://localhost:8080
- Get ArgoCD password: `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d`

Your application is ready to deploy! 🚀
