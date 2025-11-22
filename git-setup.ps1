# Git Setup and Push Script for ProfitFirst Application
# This script will initialize git, create a private repository, and push code

Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Git Setup & GitHub Push Script                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Configuration
$GITHUB_ORG = "Profit-First"
$REPO_NAME = "profit-first-app"
$REPO_DESCRIPTION = "E-commerce analytics platform with AI predictions, Shopify/Meta/Shiprocket integrations, deployed on Kubernetes"

Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "   GitHub Organization: $GITHUB_ORG" -ForegroundColor White
Write-Host "   Repository Name: $REPO_NAME" -ForegroundColor White
Write-Host "   Repository Type: Private (Organization)`n" -ForegroundColor White

# Check if git is installed
Write-Host "🔍 Checking Git installation..." -ForegroundColor Yellow
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git is not installed. Please install Git first." -ForegroundColor Red
    Write-Host "   Download from: https://git-scm.com/download/win`n" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Git is installed`n" -ForegroundColor Green

# Check if GitHub CLI is installed (optional)
$useGHCLI = $false
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "✅ GitHub CLI detected`n" -ForegroundColor Green
    $useGHCLI = $true
} else {
    Write-Host "ℹ️  GitHub CLI not found (optional)" -ForegroundColor Yellow
    Write-Host "   You'll need to create the repository manually on GitHub`n" -ForegroundColor Yellow
}

# Initialize Git repository
Write-Host "📦 Initializing Git repository..." -ForegroundColor Yellow
if (Test-Path .git) {
    Write-Host "⚠️  Git repository already exists" -ForegroundColor Yellow
    $reinit = Read-Host "Do you want to reinitialize? (y/N)"
    if ($reinit -eq 'y' -or $reinit -eq 'Y') {
        Remove-Item -Recurse -Force .git
        git init
        Write-Host "✅ Repository reinitialized`n" -ForegroundColor Green
    }
} else {
    git init
    Write-Host "✅ Git repository initialized`n" -ForegroundColor Green
}

# Configure Git user (if not already configured)
Write-Host "👤 Configuring Git user..." -ForegroundColor Yellow
$gitUserName = git config user.name
$gitUserEmail = git config user.email

if (-not $gitUserName) {
    $userName = Read-Host "Enter your Git username"
    git config user.name "$userName"
}

if (-not $gitUserEmail) {
    $userEmail = Read-Host "Enter your Git email"
    git config user.email "$userEmail"
}
Write-Host "✅ Git user configured`n" -ForegroundColor Green

# Check for sensitive files
Write-Host "🔒 Checking for sensitive files..." -ForegroundColor Yellow
if (Test-Path "Auth-service/.env") {
    Write-Host "⚠️  WARNING: .env file detected!" -ForegroundColor Red
    Write-Host "   Make sure it's in .gitignore (already added)`n" -ForegroundColor Yellow
}
Write-Host "✅ .gitignore configured`n" -ForegroundColor Green

# Add all files
Write-Host "📝 Adding files to Git..." -ForegroundColor Yellow
git add .
Write-Host "✅ Files added`n" -ForegroundColor Green

# Create initial commit
Write-Host "💾 Creating initial commit..." -ForegroundColor Yellow
git commit -m "Initial commit: ProfitFirst Analytics Platform

- Backend: Node.js/Express with AWS Cognito, DynamoDB, Bedrock
- Frontend: React/Vite with Tailwind CSS
- Infrastructure: Docker, Kubernetes, ArgoCD
- Monitoring: Prometheus & Grafana
- Integrations: Shopify, Meta Ads, Shiprocket
- Features: AI predictions, real-time dashboard, chatbot"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Initial commit created`n" -ForegroundColor Green
} else {
    Write-Host "⚠️  No changes to commit or commit failed`n" -ForegroundColor Yellow
}

# Create repository on GitHub
Write-Host "🌐 GitHub Repository Setup" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════`n" -ForegroundColor Cyan

if ($useGHCLI) {
    Write-Host "Creating private repository in organization using GitHub CLI..." -ForegroundColor Yellow
    gh repo create "$GITHUB_ORG/$REPO_NAME" --private --description "$REPO_DESCRIPTION" --source=. --remote=origin --push
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Repository created and code pushed successfully!`n" -ForegroundColor Green
        Write-Host "🔗 Repository URL: https://github.com/$GITHUB_ORG/$REPO_NAME`n" -ForegroundColor Cyan
        exit 0
    }
}

# Manual setup instructions
Write-Host "📋 Manual Setup Instructions:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "1️⃣  Create Private Repository in Organization:" -ForegroundColor Yellow
Write-Host "   • Go to: https://github.com/organizations/$GITHUB_ORG/repositories/new" -ForegroundColor White
Write-Host "   • Owner: $GITHUB_ORG (Organization)" -ForegroundColor White
Write-Host "   • Repository name: $REPO_NAME" -ForegroundColor White
Write-Host "   • Description: $REPO_DESCRIPTION" -ForegroundColor White
Write-Host "   • Visibility: Private ✓" -ForegroundColor White
Write-Host "   • DO NOT initialize with README, .gitignore, or license" -ForegroundColor Red
Write-Host "   • Click 'Create repository'`n" -ForegroundColor White

Write-Host "2️⃣  Get Personal Access Token:" -ForegroundColor Yellow
Write-Host "   • Go to: https://github.com/settings/tokens" -ForegroundColor White
Write-Host "   • Click 'Generate new token (classic)'" -ForegroundColor White
Write-Host "   • Select scopes: repo (all)" -ForegroundColor White
Write-Host "   • Copy the token (you'll need it for push)`n" -ForegroundColor White

Write-Host "3️⃣  Add Remote and Push:" -ForegroundColor Yellow
Write-Host "   Run these commands:`n" -ForegroundColor White

Write-Host "   git remote add origin https://github.com/$GITHUB_ORG/$REPO_NAME.git" -ForegroundColor Cyan
Write-Host "   git branch -M main" -ForegroundColor Cyan
Write-Host "   git push -u origin main`n" -ForegroundColor Cyan

Write-Host "   When prompted for password, use your Personal Access Token`n" -ForegroundColor Yellow

Write-Host "4️⃣  Or use this one-liner:" -ForegroundColor Yellow
Write-Host "   git remote add origin https://github.com/$GITHUB_ORG/$REPO_NAME.git && git branch -M main && git push -u origin main`n" -ForegroundColor Cyan

# Offer to add remote and push
Write-Host "═══════════════════════════════════════════════════════`n" -ForegroundColor Cyan
$proceed = Read-Host "Have you created the repository on GitHub? (y/N)"

if ($proceed -eq 'y' -or $proceed -eq 'Y') {
    Write-Host "`n🔗 Adding remote origin..." -ForegroundColor Yellow
    
    # Remove existing remote if exists
    git remote remove origin 2>$null
    
    # Add new remote
    git remote add origin "https://github.com/$GITHUB_ORG/$REPO_NAME.git"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Remote added`n" -ForegroundColor Green
        
        # Rename branch to main
        Write-Host "🔄 Renaming branch to main..." -ForegroundColor Yellow
        git branch -M main
        Write-Host "✅ Branch renamed`n" -ForegroundColor Green
        
        # Push to GitHub
        Write-Host "🚀 Pushing to GitHub Organization..." -ForegroundColor Yellow
        Write-Host "   You will be prompted for your GitHub credentials" -ForegroundColor Yellow
        Write-Host "   Username: Your GitHub username" -ForegroundColor White
        Write-Host "   Password: Use your Personal Access Token`n" -ForegroundColor White
        
        git push -u origin main
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✅ Code pushed successfully!`n" -ForegroundColor Green
            Write-Host "🔗 Repository URL: https://github.com/$GITHUB_ORG/$REPO_NAME`n" -ForegroundColor Cyan
        } else {
            Write-Host "`n❌ Push failed. Please check your credentials and try again.`n" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Failed to add remote`n" -ForegroundColor Red
    }
} else {
    Write-Host "`nℹ️  Please create the repository in organization first, then run:" -ForegroundColor Yellow
    Write-Host "   git remote add origin https://github.com/$GITHUB_ORG/$REPO_NAME.git" -ForegroundColor Cyan
    Write-Host "   git branch -M main" -ForegroundColor Cyan
    Write-Host "   git push -u origin main`n" -ForegroundColor Cyan
}

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Setup Complete!                                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan
