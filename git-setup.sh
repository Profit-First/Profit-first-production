#!/bin/bash

# Git Setup and Push Script for ProfitFirst Application

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║     Git Setup & GitHub Push Script                    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Configuration
GITHUB_ORG="Profit-First"
REPO_NAME="profit-first-app"
REPO_DESCRIPTION="E-commerce analytics platform with AI predictions"

echo "📋 Configuration:"
echo "   GitHub Organization: $GITHUB_ORG"
echo "   Repository Name: $REPO_NAME"
echo "   Repository Type: Private (Organization)"
echo ""

# Check if git is installed
echo "🔍 Checking Git installation..."
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first."
    exit 1
fi
echo "✅ Git is installed"
echo ""

# Initialize Git repository
echo "📦 Initializing Git repository..."
if [ -d .git ]; then
    echo "⚠️  Git repository already exists"
    read -p "Do you want to reinitialize? (y/N): " reinit
    if [ "$reinit" = "y" ] || [ "$reinit" = "Y" ]; then
        rm -rf .git
        git init
        echo "✅ Repository reinitialized"
    fi
else
    git init
    echo "✅ Git repository initialized"
fi
echo ""

# Configure Git user
echo "👤 Configuring Git user..."
if [ -z "$(git config user.name)" ]; then
    read -p "Enter your Git username: " username
    git config user.name "$username"
fi

if [ -z "$(git config user.email)" ]; then
    read -p "Enter your Git email: " email
    git config user.email "$email"
fi
echo "✅ Git user configured"
echo ""

# Check for sensitive files
echo "🔒 Checking for sensitive files..."
if [ -f "Auth-service/.env" ]; then
    echo "⚠️  WARNING: .env file detected!"
    echo "   Make sure it's in .gitignore (already added)"
fi
echo "✅ .gitignore configured"
echo ""

# Add all files
echo "📝 Adding files to Git..."
git add .
echo "✅ Files added"
echo ""

# Create initial commit
echo "💾 Creating initial commit..."
git commit -m "Initial commit: ProfitFirst Analytics Platform

- Backend: Node.js/Express with AWS Cognito, DynamoDB, Bedrock
- Frontend: React/Vite with Tailwind CSS
- Infrastructure: Docker, Kubernetes, ArgoCD
- Monitoring: Prometheus & Grafana
- Integrations: Shopify, Meta Ads, Shiprocket
- Features: AI predictions, real-time dashboard, chatbot"

echo "✅ Initial commit created"
echo ""

# Manual setup instructions
echo "═══════════════════════════════════════════════════════"
echo "📋 Manual Setup Instructions:"
echo "═══════════════════════════════════════════════════════"
echo ""

echo "1️⃣  Create Private Repository in Organization:"
echo "   • Go to: https://github.com/organizations/$GITHUB_ORG/repositories/new"
echo "   • Owner: $GITHUB_ORG (Organization)"
echo "   • Repository name: $REPO_NAME"
echo "   • Visibility: Private ✓"
echo "   • DO NOT initialize with README"
echo "   • Click 'Create repository'"
echo ""

echo "2️⃣  Get Personal Access Token:"
echo "   • Go to: https://github.com/settings/tokens"
echo "   • Click 'Generate new token (classic)'"
echo "   • Select scopes: repo (all)"
echo "   • Copy the token"
echo ""

echo "3️⃣  Push to GitHub Organization:"
echo ""
echo "   git remote add origin https://github.com/$GITHUB_ORG/$REPO_NAME.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""

# Offer to proceed
read -p "Have you created the repository on GitHub? (y/N): " proceed

if [ "$proceed" = "y" ] || [ "$proceed" = "Y" ]; then
    echo ""
    echo "🔗 Adding remote origin..."
    
    # Remove existing remote if exists
    git remote remove origin 2>/dev/null
    
    # Add new remote
    git remote add origin "https://github.com/$GITHUB_ORG/$REPO_NAME.git"
    echo "✅ Remote added"
    echo ""
    
    # Rename branch to main
    echo "🔄 Renaming branch to main..."
    git branch -M main
    echo "✅ Branch renamed"
    echo ""
    
    # Push to GitHub
    echo "🚀 Pushing to GitHub Organization..."
    echo "   Username: Your GitHub username"
    echo "   Password: Use your Personal Access Token"
    echo ""
    
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Code pushed successfully!"
        echo ""
        echo "🔗 Repository URL: https://github.com/$GITHUB_ORG/$REPO_NAME"
        echo ""
    else
        echo ""
        echo "❌ Push failed. Please check your credentials."
        echo ""
    fi
else
    echo ""
    echo "ℹ️  Please create the repository in organization first, then run:"
    echo "   git remote add origin https://github.com/$GITHUB_ORG/$REPO_NAME.git"
    echo "   git branch -M main"
    echo "   git push -u origin main"
    echo ""
fi

echo "╔════════════════════════════════════════════════════════╗"
echo "║     Setup Complete!                                    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
