#!/bin/bash

# DynamoDB Tables Creation Script
# This script creates all required DynamoDB tables for the Profit First application

echo "🚀 Creating DynamoDB tables..."
echo ""

# Set AWS Region
AWS_REGION="ap-south-1"

# 1. Create Users Table
echo "📝 Creating Users table..."
aws dynamodb create-table \
    --table-name Users \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region $AWS_REGION

echo "✅ Users table created"
echo ""

# 2. Create Onboarding Table
echo "📝 Creating Onboarding table..."
aws dynamodb create-table \
    --table-name Onboarding \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region $AWS_REGION

echo "✅ Onboarding table created"
echo ""

# 3. Create Shopify Products Table
echo "📝 Creating shopify_products table..."
aws dynamodb create-table \
    --table-name shopify_products \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=productId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=productId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region $AWS_REGION

echo "✅ shopify_products table created"
echo ""

# 4. Create Shopify Orders Table
echo "📝 Creating shopify_orders table..."
aws dynamodb create-table \
    --table-name shopify_orders \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=orderId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=orderId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region $AWS_REGION

echo "✅ shopify_orders table created"
echo ""

# 5. Create Shopify Customers Table
echo "📝 Creating shopify_customers table..."
aws dynamodb create-table \
    --table-name shopify_customers \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=customerId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=customerId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region $AWS_REGION

echo "✅ shopify_customers table created"
echo ""

# 6. Create Shopify Connections Table
echo "📝 Creating shopify_connections table..."
aws dynamodb create-table \
    --table-name shopify_connections \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region $AWS_REGION

echo "✅ shopify_connections table created"
echo ""

# 7. Create Meta Connections Table
echo "📝 Creating meta_connections table..."
aws dynamodb create-table \
    --table-name meta_connections \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region $AWS_REGION

echo "✅ meta_connections table created"
echo ""

# 8. Create Meta Insights Table
echo "📝 Creating meta_insights table..."
aws dynamodb create-table \
    --table-name meta_insights \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=date,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=date,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region $AWS_REGION

echo "✅ meta_insights table created"
echo ""

# 9. Create Shipping Connections Table
echo "📝 Creating shipping_connections table..."
aws dynamodb create-table \
    --table-name shipping_connections \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region $AWS_REGION

echo "✅ shipping_connections table created"
echo ""

# 10. Create Shiprocket Shipments Table
echo "📝 Creating shiprocket_shipments table..."
aws dynamodb create-table \
    --table-name shiprocket_shipments \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=shipmentId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=shipmentId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region $AWS_REGION

echo "✅ shiprocket_shipments table created"
echo ""

echo "🎉 All DynamoDB tables created successfully!"
echo ""
echo "📋 Created tables:"
echo "  1. Users"
echo "  2. Onboarding"
echo "  3. shopify_products"
echo "  4. shopify_orders"
echo "  5. shopify_customers"
echo "  6. shopify_connections"
echo "  7. meta_connections"
echo "  8. meta_insights"
echo "  9. shipping_connections"
echo "  10. shiprocket_shipments"
echo ""
echo "⏳ Note: Tables may take a few seconds to become active."
echo "🔍 Check status: aws dynamodb list-tables --region $AWS_REGION"
