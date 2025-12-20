# DynamoDB Tables Setup

## Quick Start

### Step 1: Install Dependencies (if not already installed)
```bash
cd Auth-service
npm install
```

### Step 2: Set Environment Variables
Make sure your `.env` file has AWS credentials:
```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Step 3: Run the Script
```bash
# From project root
node scripts/createDynamoTables.js
```

## What This Script Does

✅ Creates 10 DynamoDB tables:
1. **Users** - User accounts
2. **Onboarding** - Onboarding progress
3. **shopify_products** - Shopify product catalog
4. **shopify_orders** - Shopify orders (for Order Confirmation)
5. **shopify_customers** - Shopify customer data
6. **shopify_connections** - Shopify store connections
7. **meta_connections** - Meta/Facebook ad account connections
8. **meta_insights** - Meta ads performance data
9. **shipping_connections** - Shiprocket connections
10. **shiprocket_shipments** - Shipment tracking data

## Features

- ✅ **Automatic Check**: Skips tables that already exist
- ✅ **Pay-per-request**: No upfront costs, pay only for what you use
- ✅ **Error Handling**: Shows clear success/error messages
- ✅ **Summary Report**: Shows how many tables created/skipped/failed

## Expected Output

```
🚀 Starting DynamoDB tables creation...

📍 Region: ap-south-1

✅ Table "Users" already exists - skipping
📝 Creating table: Onboarding...
✅ Table "Onboarding" created successfully!
...

==================================================
📊 Summary:
   ✅ Created: 5 tables
   ⏭️  Skipped: 5 tables (already exist)
   ❌ Failed: 0 tables
==================================================

🎉 All tables are ready!

📋 Created/Verified tables:
   1. Users
   2. Onboarding
   3. shopify_products
   4. shopify_orders
   5. shopify_customers
   6. shopify_connections
   7. meta_connections
   8. meta_insights
   9. shipping_connections
   10. shiprocket_shipments

✨ Script completed successfully!
```

## Troubleshooting

### Error: "Missing credentials"
Make sure AWS credentials are set in `.env` file or run:
```bash
aws configure
```

### Error: "Access Denied"
Your AWS IAM user needs `dynamodb:CreateTable` and `dynamodb:DescribeTable` permissions.

### Check if tables exist
```bash
aws dynamodb list-tables --region ap-south-1
```

### Delete a table (if needed)
```bash
aws dynamodb delete-table --table-name TABLE_NAME --region ap-south-1
```

## Next Steps

After tables are created:
1. Connect your Shopify store (Settings → Integrations)
2. Orders will automatically sync to `shopify_orders` table
3. View orders in Order Confirmation page
