GitHub Actions CI/CD Workflows
================================

This directory contains automated CI/CD pipelines for the Profit First application.

Workflows:
----------

1. create-ecr-repos.yaml
   - One-time setup to create ECR repositories in AWS
   - Run manually via GitHub Actions UI
   - Creates: profit-first-backend and profit-first-frontend repos

2. backend-ci-cd.yaml
   - Triggers on: Push to main (Auth-service/** changes)
   - Builds backend Docker image
   - Pushes to AWS ECR
   - Updates k8s/backend/backend-deployment.yaml
   - ArgoCD auto-syncs the changes

3. frontend-ci-cd.yaml
   - Triggers on: Push to main (frontend-profit-first/** changes)
   - Builds frontend Docker image
   - Pushes to AWS ECR
   - Updates k8s/frontend/frontend-deployment.yaml
   - ArgoCD auto-syncs the changes

4. full-deploy.yaml
   - Triggers on: Push to main (any code changes)
   - Builds both backend and frontend
   - Updates both K8s manifests
   - Complete application deployment

5. manual-deploy.yaml
   - Manual deployment workflow
   - Deploy specific service (backend/frontend/both)
   - Choose environment (production/staging)
   - Specify image tag

Setup Required:
---------------

1. GitHub Secrets (Settings > Secrets and variables > Actions):
   - AWS_ACCESS_KEY_ID: Your AWS access key
   - AWS_SECRET_ACCESS_KEY: Your AWS secret key

2. AWS ECR Repositories:
   - Run "Create ECR Repositories" workflow first
   - Or create manually in AWS Console

3. ArgoCD:
   - Install ArgoCD in your Kubernetes cluster
   - Apply argocd/application.yaml
   - ArgoCD will watch k8s/ folder for changes

How It Works:
-------------

1. Developer pushes code to main branch
2. GitHub Actions detects changes
3. Builds Docker image with commit SHA as tag
4. Pushes image to AWS ECR
5. Updates Kubernetes manifest with new image tag
6. Commits and pushes manifest changes
7. ArgoCD detects manifest changes
8. ArgoCD syncs to Kubernetes cluster
9. New pods are deployed with updated image

Image Tagging:
--------------
- Each build uses commit SHA as tag (e.g., abc123def)
- Also tagged as "latest"
- Allows easy rollback to any previous version

Manual Deployment:
------------------
1. Go to Actions tab in GitHub
2. Select "Manual Deploy" workflow
3. Click "Run workflow"
4. Choose service, environment, and image tag
5. Click "Run workflow"

Monitoring:
-----------
- View workflow runs in GitHub Actions tab
- Check ArgoCD UI for sync status
- Monitor pods: kubectl get pods -n profit-first

Troubleshooting:
----------------
- If workflow fails, check GitHub Actions logs
- Verify AWS credentials are correct
- Ensure ECR repositories exist
- Check ArgoCD is installed and configured
- Verify Git push permissions

Notes:
------
- Workflows use AWS ECR (Elastic Container Registry)
- Images are tagged with commit SHA for traceability
- ArgoCD auto-syncs every 3 minutes by default
- Manual sync available in ArgoCD UI
