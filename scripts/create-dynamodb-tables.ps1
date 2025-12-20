# DynamoDB Tables Creation Script (PowerShell)
# This script creates all required DynamoDB tables for the Profit First application

Write-Host "🚀 Creating DynamoDB tables..." -ForegroundColor Green
Write-Host ""

# Set AWS Region
$AWS_REGION = "ap-south-1"

# 1. Create Users Table
Write-Host "📝 Creating Users table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name Users `
    --attribute-definitions AttributeName=userId,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region $AWS_REGION

Write-Host "✅ Users table created" -ForegroundColor Green
Write-Host ""

# 2. Create Onboarding Table
Write-Host "📝 Creating Onboarding table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name Onboarding `
    --attribute-definitions AttributeName=userId,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region $AWS_REGION

Write-Host "✅ Onboarding table created" -ForegroundColor Green
Write-Host ""

# 3. Create Shopify Products Table
Write-Host "📝 Creating shopify_products table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name shopify_products `
    --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=productId,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH AttributeName=productId,KeyType=RANGE `
    --billing-mode PAY_PER_REQUEST `
    --region $AWS_REGION

Write-Host "✅ shopify_products table created" -ForegroundColor Green
Write-Host ""

# 4. Create Shopify Orders Table
Write-Host "📝 Creating shopify_orders table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name shopify_orders `
    --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=orderId,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH AttributeName=orderId,KeyType=RANGE `
    --billing-mode PAY_PER_REQUEST `
    --region $AWS_REGION

Write-Host "✅ shopify_orders table created" -ForegroundColor Green
Write-Host ""

# 5. Create Shopify Customers Table
Write-Host "📝 Creating shopify_customers table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name shopify_customers `
    --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=customerId,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH AttributeName=customerId,KeyType=RANGE `
    --billing-mode PAY_PER_REQUEST `
    --region $AWS_REGION

Write-Host "✅ shopify_customers table created" -ForegroundColor Green
Write-Host ""

# 6. Create Shopify Connections Table
Write-Host "📝 Creating shopify_connections table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name shopify_connections `
    --attribute-definitions AttributeName=userId,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region $AWS_REGION

Write-Host "✅ shopify_connections table created" -ForegroundColor Green
Write-Host ""

# 7. Create Meta Connections Table
Write-Host "📝 Creating meta_connections table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name meta_connections `
    --attribute-definitions AttributeName=userId,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region $AWS_REGION

Write-Host "✅ meta_connections table created" -ForegroundColor Green
Write-Host ""

# 8. Create Meta Insights Table
Write-Host "📝 Creating meta_insights table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name meta_insights `
    --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=date,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH AttributeName=date,KeyType=RANGE `
    --billing-mode PAY_PER_REQUEST `
    --region $AWS_REGION

Write-Host "✅ meta_insights table created" -ForegroundColor Green
Write-Host ""

# 9. Create Shipping Connections Table
Write-Host "📝 Creating shipping_connections table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name shipping_connections `
    --attribute-definitions AttributeName=userId,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region $AWS_REGION

Write-Host "✅ shipping_connections table created" -ForegroundColor Green
Write-Host ""

# 10. Create Shiprocket Shipments Table
Write-Host "📝 Creating shiprocket_shipments table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name shiprocket_shipments `
    --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=shipmentId,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH AttributeName=shipmentId,KeyType=RANGE `
    --billing-mode PAY_PER_REQUEST `
    --region $AWS_REGION

Write-Host "✅ shiprocket_shipments table created" -ForegroundColor Green
Write-Host ""

Write-Host "🎉 All DynamoDB tables created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Created tables:" -ForegroundColor Cyan
Write-Host "  1. Users"
Write-Host "  2. Onboarding"
Write-Host "  3. shopify_products"
Write-Host "  4. shopify_orders"
Write-Host "  5. shopify_customers"
Write-Host "  6. shopify_connections"
Write-Host "  7. meta_connections"
Write-Host "  8. meta_insights"
Write-Host "  9. shipping_connections"
Write-Host "  10. shiprocket_shipments"
Write-Host ""
Write-Host "⏳ Note: Tables may take a few seconds to become active." -ForegroundColor Yellow
Write-Host "🔍 Check status: aws dynamodb list-tables --region $AWS_REGION" -ForegroundColor Cyan
