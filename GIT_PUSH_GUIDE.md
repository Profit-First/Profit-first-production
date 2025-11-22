# GitHub Push Guide

Quick guide to push your code to GitHub private repository.

## Quick Start (Automated)

### Windows (PowerShell)
```powershell
.\git-setup.ps1
```

### Linux/Mac (Bash)
```bash
chmod +x git-setup.sh
./git-setup.sh
```

## Manual Steps

### Step 1: Create GitHub Repository in Organization

1. Go to: https://github.com/organizations/Profit-First/repositories/new
2. Fill in details:
   - **Owner:** Profit-First (Organization)
   - **Repository name:** profit-first-app
   - **Description:** E-commerce analytics platform with AI predictions
   - **Visibility:** ✅ Private
   - **DO NOT** check "Initialize with README"
3. Click **"Create repository"**

### Step 2: Get Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Give it a name: "ProfitFirst App"
4. Select scopes:
   - ✅ **repo** (all sub-options)
5. Click **"Generate token"**
6. **Copy the token** (you won't see it again!)

### Step 3: Initialize Git (if not already done)

```bash
# Initialize git
git init

# Configure user (first time only)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: ProfitFirst Analytics Platform"
```

### Step 4: Push to GitHub Organization

```bash
# Add remote
git remote add origin https://github.com/Profit-First/profit-first-app.git

# Rename branch to main
git branch -M main

# Push to GitHub
git push -u origin main
```

**When prompted:**
- **Username:** Your GitHub username (must have access to Profit-First organization)
- **Password:** Paste your Personal Access Token (not your GitHub password!)

## One-Liner Command

```bash
git init && git add . && git commit -m "Initial commit: ProfitFirst Analytics Platform" && git remote add origin https://github.com/Profit-First/profit-first-app.git && git branch -M main && git push -u origin main
```

## Verify Push

After pushing, verify at:
```
https://github.com/Profit-First/profit-first-app
```

## What Gets Pushed

### ✅ Included:
- Backend code (Auth-service/)
- Frontend code (frontend-profit-first/)
- Kubernetes manifests (k8s/)
- ArgoCD configuration (argocd/)
- Monitoring setup (monitoring/)
- Docker files
- Documentation
- Scripts

### ❌ Excluded (in .gitignore):
- node_modules/
- .env files (sensitive!)
- Build outputs (dist/, build/)
- Logs
- IDE settings (.vscode/)
- System files

## Important Security Notes

⚠️ **NEVER commit these files:**
- `.env` files (contain AWS credentials!)
- `node_modules/` (too large)
- Personal access tokens
- API keys or secrets

✅ **Already protected by .gitignore:**
- Auth-service/.env
- All .env files
- node_modules/
- Build outputs

## Troubleshooting

### Error: "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/Profit-First/profit-first-app.git
```

### Error: "Authentication failed"
- Make sure you're using Personal Access Token, not password
- Check token has 'repo' scope
- Token might be expired - generate new one

### Error: "Repository not found"
- Make sure repository is created in organization on GitHub
- Check repository name is correct: profit-first-app
- Check organization name is correct: Profit-First
- Ensure you have access to the organization

### Error: "Nothing to commit"
```bash
# Check status
git status

# If files not added
git add .
git commit -m "Initial commit"
```

## Future Updates

After initial push, to update code:

```bash
# Check what changed
git status

# Add changes
git add .

# Commit with message
git commit -m "Description of changes"

# Push to GitHub
git push
```

## Repository Structure on GitHub

```
profit-first-app/
├── Auth-service/              # Backend
├── frontend-profit-first/     # Frontend
├── k8s/                       # Kubernetes
├── argocd/                    # ArgoCD
├── monitoring/                # Monitoring
├── scripts/                   # Scripts
├── docker-compose.yml
├── docker-compose.dev.yml
├── README.md
└── Documentation files
```

## Clone Repository (Future)

To clone on another machine:

```bash
git clone https://github.com/Profit-First/profit-first-app.git
cd profit-first-app

# Setup backend
cd Auth-service
cp .env.example .env
# Edit .env with your credentials
npm install

# Setup frontend
cd ../frontend-profit-first/client
npm install
```

## Useful Git Commands

```bash
# Check status
git status

# View commit history
git log --oneline

# View remote URL
git remote -v

# Pull latest changes
git pull

# Create new branch
git checkout -b feature-name

# Switch branch
git checkout main

# View differences
git diff
```

## Support

If you encounter issues:
1. Check error message carefully
2. Verify repository exists on GitHub
3. Ensure Personal Access Token is valid
4. Check .gitignore is working: `git status` should not show .env files

## Quick Reference

| Action | Command |
|--------|---------|
| Initialize | `git init` |
| Add files | `git add .` |
| Commit | `git commit -m "message"` |
| Add remote | `git remote add origin <url>` |
| Push | `git push -u origin main` |
| Status | `git status` |
| Log | `git log` |
| Pull | `git pull` |

---

**Repository URL:** https://github.com/Profit-First/profit-first-app

**Organization:** Profit-First

**Authentication:** Use Personal Access Token as password

**Note:** You must be a member of the Profit-First organization to push code
