# Push to GitHub Organization - Quick Guide

## Step-by-Step Instructions

### Step 1: Create Repository in Organization

1. **Go to:** https://github.com/organizations/Profit-First/repositories/new

2. **Fill in:**
   - Owner: **Profit-First** (Organization)
   - Repository name: **profit-first-app**
   - Description: E-commerce analytics platform with AI predictions
   - Visibility: ✅ **Private**
   - ❌ **DO NOT** check "Initialize with README"

3. **Click:** "Create repository"

### Step 2: Get Personal Access Token

1. **Go to:** https://github.com/settings/tokens

2. **Click:** "Generate new token (classic)"

3. **Configure:**
   - Note: "ProfitFirst App"
   - Expiration: Choose duration
   - Scopes: ✅ **repo** (all sub-options)

4. **Click:** "Generate token"

5. **Copy the token** (you won't see it again!)

### Step 3: Run Automated Script

Open PowerShell in your project directory and run:

```powershell
.\git-setup.ps1
```

**Follow the prompts:**
- Confirm repository creation: `y`
- Enter your GitHub username when prompted
- Paste your Personal Access Token when asked for password

### Alternative: Manual Commands

If you prefer manual setup:

```bash
# Initialize git
git init

# Add all files
git add .

# Create commit
git commit -m "Initial commit: ProfitFirst Analytics Platform"

# Add remote (organization)
git remote add origin https://github.com/Profit-First/profit-first-app.git

# Rename branch
git branch -M main

# Push to organization
git push -u origin main
```

**When prompted for credentials:**
- Username: Your GitHub username
- Password: Paste your Personal Access Token

## Verify Success

After pushing, verify at:
```
https://github.com/Profit-First/profit-first-app
```

You should see all your code in the private organization repository!

## What Gets Pushed

✅ **Included:**
- Backend code (Auth-service/)
- Frontend code (frontend-profit-first/)
- Kubernetes manifests (k8s/)
- ArgoCD configuration (argocd/)
- Monitoring setup (monitoring/)
- Docker files
- Documentation
- Scripts

❌ **Excluded (Protected):**
- .env files (AWS credentials!)
- node_modules/
- Build outputs
- Logs

## Troubleshooting

### "Repository not found"
- Ensure repository is created in Profit-First organization
- Check you're a member of the organization
- Verify repository name: profit-first-app

### "Authentication failed"
- Use Personal Access Token, not password
- Ensure token has 'repo' scope
- Check token hasn't expired

### "Permission denied"
- Ensure you're a member of Profit-First organization
- Check you have write access to the organization
- Contact organization admin if needed

## Important Notes

⚠️ **Organization Access:**
- You must be a member of the Profit-First organization
- You need write permissions to push code
- Contact organization owner if you don't have access

🔒 **Security:**
- Never commit .env files (already protected)
- Use Personal Access Token, not password
- Keep your token secure

## Future Updates

After initial push, to update code:

```bash
# Check changes
git status

# Add changes
git add .

# Commit
git commit -m "Description of changes"

# Push
git push
```

## Clone on Another Machine

```bash
git clone https://github.com/Profit-First/profit-first-app.git
cd profit-first-app

# Setup backend
cd Auth-service
cp .env.example .env
# Edit .env with credentials
npm install

# Setup frontend
cd ../frontend-profit-first/client
npm install
```

---

**Organization:** Profit-First  
**Repository:** profit-first-app  
**Type:** Private  
**URL:** https://github.com/Profit-First/profit-first-app
