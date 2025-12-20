#!/bin/bash

# Create ECS Task Execution Role
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}' 2>/dev/null || true

aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Create ECS Task Role
aws iam create-role --role-name ecsTaskRole --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}' 2>/dev/null || true

# Attach policies for AWS services
aws iam attach-role-policy --role-name ecsTaskRole --policy-arn arn:aws:iam::aws:policy/AmazonCognitoPowerUser
aws iam attach-role-policy --role-name ecsTaskRole --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
aws iam attach-role-policy --role-name ecsTaskRole --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess

# Create CloudWatch log group
aws logs create-log-group --log-group-name /ecs/auth-service 2>/dev/null || true

echo "IAM roles and log group created successfully."
