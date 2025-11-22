# Quick Push to GitHub Organization
# Run this if you're already logged in to GitHub

Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Quick Push to Organization                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$ORG_NAME = "Profit-First"
$REPO_NAME = "profit-first-production"

Write-Host "🏢 Organization: $ORG_NAME" -ForegroundColor Yellow
Write-Host "📦 Repository: $REPO_NAME" -ForegroundColor Yellow
Write-Host "🔒 Type: Private`n" -ForegroundColor Yellow

# Initialize git if not already done
if (-not (Test-Path .git)) {
    Write-Host "📦 Initializing Git repository..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git initialized`n" -ForegroundColor Green
} else {
    Write-Host "✅ Git already initialized`n" -ForegroundColor Green
}

# Configure git user if needed
$gitUserName = git config user.name
if (-not $gitUserName) {
    Write-Host "⚠️  Git user not configured" -ForegroundColor Yellow
    $userName = Read-Host "Enter your name"
    git config user.name "$userName"
}

$gitUserEmail = git config user.email
if (-not $gitUserEmail) {
    Write-Host "⚠️  Git email not configured" -ForegroundColor Yellow
    $userEmail = Read-Host "Enter your email"
    git config user.email "$userEmail"
}

# Add all files
Write-Host "📝 Adding files..." -ForegroundColor Yellow
git add .
Write-Host "✅ Files added`n" -ForegroundColor Green

# Create commit
Write-Host "💾 Creating commit..." -ForegroundColor Yellow
git commit -m "Initial commit: ProfitFirst Analytics Platform

- Backend: Node.js/Express with AWS Cognito, DynamoDB, Bedrock
- Frontend: React/Vite with Tailwind CSS
- Infrastructure: Docker, Kubernetes, ArgoCD
- Monitoring: Prometheus & Grafana
- Integrations: Shopify, Meta Ads, Shiprocket
- Features: AI predictions, real-time dashboard, chatbot"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit created`n" -ForegroundColor Green
} else {
    Write-Host "⚠️  Nothing to commit or commit failed`n" -ForegroundColor Yellow
}

# Check if GitHub CLI is available
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "✅ GitHub CLI detected`n" -ForegroundColor Green
    Write-Host "🚀 Creating repository and pushing..." -ForegroundColor Yellow
    
    # Create repository in organization and push
    gh repo create "$ORG_NAME/$REPO_NAME" --private --source=. --remote=origin --push
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ SUCCESS! Repository created and code pushed!`n" -ForegroundColor Green
        Write-Host "🔗 Repository URL: https://github.com/$ORG_NAME/$REPO_NAME`n" -ForegroundColor Cyan
    } else {
        Write-Host "`n❌ Failed to create repository or push" -ForegroundColor Red
        Write-Host "Try manual commands below`n" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ GitHub CLI not found" -ForegroundColor Red
    Write-Host "Please install GitHub CLI or use manual commands`n" -ForegroundColor Yellow
}

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Manual Commands (if needed)                        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "If the above failed, run these commands:`n" -ForegroundColor Yellow
Write-Host "# Create repository using GitHub CLI" -ForegroundColor Cyan
Write-Host "gh repo create $ORG_NAME/$REPO_NAME --private`n" -ForegroundColor White

Write-Host "# Add remote and push" -ForegroundColor Cyan
Write-Host "git remote add origin https://github.com/$ORG_NAME/$REPO_NAME.git" -ForegroundColor White
Write-Host "git branch -M main" -ForegroundColor White
Write-Host "git push -u origin main`n" -ForegroundColor White

Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan
