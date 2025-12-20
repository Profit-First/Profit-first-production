#!/bin/bash

# Stop existing container
docker stop auth-service 2>/dev/null || true
docker rm auth-service 2>/dev/null || true

# Build image
docker build -t auth-service .

# Run container
docker run -d \
  --name auth-service \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  auth-service

echo "Auth service deployed on port 3000"
docker ps | grep auth-service
