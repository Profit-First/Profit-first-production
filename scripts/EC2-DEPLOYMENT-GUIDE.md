# EC2 Deployment Guide for Profit First Application

## Prerequisites

1. **EC2 Instance Running**
   - Ubuntu 20.04 or later
   - At least 2GB RAM
   - Security Group allowing ports: 80 (HTTP), 443 (HTTPS), 3000 (Backend), 22 (SSH)

2. **SSH Access**
   - Your EC2 key pair (.pem file)
   - EC2 instance public IP address

3. **Environment Variables**
   - `.env` file with all required variables ready

## Deployment Steps

### Option 1: Automated Deployment (Recommended)

#### Step 1: Connect to EC2
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

#### Step 2: Download and Run Deployment Script
```bash
# Download the deployment script
curl -o deploy-ec2.sh https://raw.githubusercontent.com/Profit-First/Profit-first-production/main/scripts/deploy-ec2.sh

# Make it executable
chmod +x deploy-ec2.sh

# Run the deployment
./deploy-ec2.sh
```

#### Step 3: Setup Environment Variables
```bash
# Navigate to backend directory
cd /home/ubuntu/profit-first-production/Auth-service

# Create .env file
nano .env
```

Paste your environment variables:
```env
# Server Configuration
PORT=3000
NODE_ENV=production

# AWS Configuration
AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# DynamoDB Tables
USERS_TABLE=users
SHOPIFY_ORDERS_TABLE=shopify_orders
META_INSIGHTS_TABLE=meta_insights

# JWT Secret
JWT_SECRET=your-jwt-secret

# Shopify Configuration
SHOPIFY_API_KEY=your-shopify-key
SHOPIFY_API_SECRET=your-shopify-secret

# Meta Configuration
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret

# Groq API (for AI)
GROQ_API_KEY=your-groq-api-key

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
```

Save and exit (Ctrl+X, Y, Enter)

#### Step 4: Restart Backend
```bash
pm2 restart profit-first-backend
```

---

### Option 2: Manual Deployment

#### Step 1: Connect to EC2
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

#### Step 2: Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Step 3: Install PM2
```bash
sudo npm install -g pm2
```

#### Step 4: Clone Repository
```bash
cd /home/ubuntu
git clone https://github.com/Profit-First/Profit-first-production.git
cd profit-first-production
```

#### Step 5: Setup Backend
```bash
cd Auth-service
npm install

# Create .env file
nano .env
# (Paste your environment variables)

# Start with PM2
pm2 start Server.js --name profit-first-backend
pm2 save
pm2 startup
```

#### Step 6: Setup Frontend
```bash
cd ../frontend-profit-first/client
npm install
npm run build

# Install Nginx
sudo apt-get update
sudo apt-get install -y nginx

# Copy build files
sudo rm -rf /var/www/html/*
sudo cp -r dist/* /var/www/html/
```

#### Step 7: Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/profit-first
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name _;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/profit-first /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Post-Deployment

### Verify Deployment
```bash
# Check backend status
pm2 list
pm2 logs profit-first-backend

# Check nginx status
sudo systemctl status nginx

# Test backend API
curl http://localhost:3000/api/health

# Get your public IP
curl ifconfig.me
```

### Access Application
- Frontend: `http://YOUR_EC2_PUBLIC_IP`
- Backend API: `http://YOUR_EC2_PUBLIC_IP/api`

---

## Updating the Application

### Pull Latest Changes
```bash
cd /home/ubuntu/profit-first-production
git pull origin main

# Update backend
cd Auth-service
npm install
pm2 restart profit-first-backend

# Update frontend
cd ../frontend-profit-first/client
npm install
npm run build
sudo cp -r dist/* /var/www/html/
```

---

## Troubleshooting

### Backend Not Starting
```bash
# Check logs
pm2 logs profit-first-backend

# Check if port 3000 is in use
sudo lsof -i :3000

# Restart backend
pm2 restart profit-first-backend
```

### Frontend Not Loading
```bash
# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Check nginx status
sudo systemctl status nginx

# Restart nginx
sudo systemctl restart nginx
```

### Database Connection Issues
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check DynamoDB tables
aws dynamodb list-tables --region your-region
```

---

## Security Recommendations

1. **Setup HTTPS with SSL Certificate**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

2. **Setup Firewall**
   ```bash
   sudo ufw allow 22
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

3. **Secure Environment Variables**
   ```bash
   chmod 600 /home/ubuntu/profit-first-production/Auth-service/.env
   ```

4. **Regular Updates**
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   ```

---

## Monitoring

### Setup PM2 Monitoring
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### View Logs
```bash
# Backend logs
pm2 logs profit-first-backend

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## Useful Commands

```bash
# PM2 Commands
pm2 list                          # List all processes
pm2 restart profit-first-backend  # Restart backend
pm2 stop profit-first-backend     # Stop backend
pm2 delete profit-first-backend   # Delete process
pm2 logs profit-first-backend     # View logs
pm2 monit                         # Monitor resources

# Nginx Commands
sudo systemctl status nginx       # Check status
sudo systemctl restart nginx      # Restart nginx
sudo nginx -t                     # Test configuration
sudo systemctl reload nginx       # Reload configuration

# System Commands
df -h                            # Check disk space
free -m                          # Check memory
top                              # Monitor processes
```

---

## Support

If you encounter any issues:
1. Check the logs: `pm2 logs profit-first-backend`
2. Verify environment variables are set correctly
3. Ensure all AWS credentials are valid
4. Check security group allows required ports
