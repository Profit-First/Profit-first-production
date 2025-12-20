#!/bin/bash

# Configuration
REGION="us-east-1"
CLUSTER_NAME="auth-service-cluster"
SERVICE_NAME="auth-service"
REPO_NAME="auth-service"

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create ECR repository
aws ecr create-repository --repository-name $REPO_NAME --region $REGION 2>/dev/null || true

# Get ECR login token
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Build and push Docker image
docker build -t $REPO_NAME .
docker tag $REPO_NAME:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest

# Update task definition with account ID and region
sed -i "s/<account-id>/$ACCOUNT_ID/g" task-definition.json
sed -i "s/<region>/$REGION/g" task-definition.json

# Create ECS cluster
aws ecs create-cluster --cluster-name $CLUSTER_NAME --region $REGION 2>/dev/null || true

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json --region $REGION

# Create or update service
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name $SERVICE_NAME \
  --task-definition auth-service \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --region $REGION 2>/dev/null || \
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --task-definition auth-service \
  --region $REGION

echo "Deployment initiated. Check ECS console for status."
