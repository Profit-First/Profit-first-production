# Direct Commands to Push to Organization

Since you're already logged in to GitHub, run these commands directly in your terminal.

## Option 1: Using Quick Script (Easiest)

```powershell
.\quick-push.ps1
```

This will automatically:
1. Initialize git
2. Add all files
3. Create commit
4. Create repository in organization
5. Push code

---

## Option 2: Manual Commands (Step by Step)

### Step 1: Initialize Git

```bash
git init
git add .
git commit -m "Initial commit: ProfitFirst Analytics Platform"
```

### Step 2: Create Repository in Organization

```bash
gh repo create Profit-First/profit-first-production --private
```

### Step 3: Add Remote and Push

```bash
git remote add origin https://github.com/Profit-First/profit-first-production.git
git branch -M main
git push -u origin main
```

---

## Option 3: One-Liner Command

Copy and paste this entire command:

```bash
git init && git add . && git commit -m "Initial commit: ProfitFirst Analytics Platform" && gh repo create Profit-First/profit-first-production --private && git remote add origin https://github.com/Profit-First/profit-first-production.git && git branch -M main && git push -u origin main
```

---

## Verify Success

After pushing, check your repository at:
```
https://github.com/Profit-First/profit-first-production
```

---

## If GitHub CLI Not Installed

If `gh` command doesn't work, install GitHub CLI:

**Windows (PowerShell):**
```powershell
winget install --id GitHub.cli
```

**Or download from:**
https://cli.github.com/

After installation, login:
```bash
gh auth login
```

---

## Troubleshooting

### "gh: command not found"
Install GitHub CLI from: https://cli.github.com/

### "You must be authenticated"
Run: `gh auth login`

### "Organization not found"
- Ensure you're a member of Profit-First organization
- Check organization name is correct: Profit-First

### "Repository already exists"
If repository already exists, just push:
```bash
git remote add origin https://github.com/Profit-First/profit-first-production.git
git branch -M main
git push -u origin main
```

---

## What Gets Pushed

✅ Backend, Frontend, Kubernetes, ArgoCD, Monitoring, Docker files, Documentation

❌ .env files, node_modules, build outputs (protected by .gitignore)

---

**Organization:** Profit-First  
**Repository:** profit-first-production  
**Type:** Private  
**URL:** https://github.com/Profit-First/profit-first-production
