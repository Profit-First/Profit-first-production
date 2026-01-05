# Shiprocket Dashboard Troubleshooting Guide

## Why am I seeing zeros in the Shiprocket Dashboard?

The Shiprocket Dashboard shows zeros when there's no data to display. Here are the most common reasons and solutions:

### 1. No Shiprocket Connection ⚠️

**Problem**: User hasn't connected their Shiprocket account
**Solution**: 
- Go to Settings/Integrations
- Connect your Shiprocket account
- Enter your Shiprocket API token

**How to check**: Look for this message in browser console:
```
⚠️ No Shiprocket connection found for user: [userId]
```

### 2. No Orders in Date Range 📅

**Problem**: Selected date range has no orders
**Solution**:
- Try expanding the date range (e.g., last 3 months)
- Check if orders exist in Shiprocket for that period
- Verify the date format in Shiprocket API

**How to check**: Look for this message in browser console:
```
📦 Fetched 0 shipments from Shiprocket API
```

### 3. No Delivered Orders 📦

**Problem**: Orders exist but none are marked as "delivered"
**Solution**:
- Check order statuses in Shiprocket dashboard
- Wait for orders to be delivered
- Verify status mapping in the code

**How to check**: Look for this message in browser console:
```
📦 Shiprocket Summary: 0 delivered out of X total shipments
```

### 4. API Connection Issues 🔌

**Problem**: Shiprocket API is not responding or token is invalid
**Solution**:
- Verify Shiprocket API token is valid
- Check internet connection
- Check Shiprocket API status

**How to check**: Look for error messages in browser console:
```
❌ Error fetching Shiprocket shipments: [error message]
```

## Testing the Dashboard

### Test with Mock Data
Run this command to test with sample data:
```bash
node test-with-sample-data.js
```

### Test API Connection
Run this command to test Shiprocket API:
```bash
node test-shiprocket-api.js
```

### Test Dashboard Controller
Run this command to test the controller:
```bash
node test-dashboard-mock.js
```

## Expected Data Flow

1. **User connects Shiprocket** → Token saved to `shipping_connections` table
2. **Dashboard loads** → Fetches orders from Shiprocket API using token
3. **Orders processed** → Filters for delivered orders only
4. **Metrics calculated** → Revenue, profit, delivery rate, etc.
5. **Data displayed** → Charts and cards show the metrics

## Common Status Codes

Shiprocket uses these status codes:
- `6, 7, 8` = Delivered (shows in revenue)
- `3, 4` = In Transit/Out for Delivery (not counted in revenue)
- `1, 2` = Pickup Pending/Scheduled (not counted in revenue)
- `9, 10` = RTO (Return to Origin)
- `5` = Cancelled

## Revenue Calculation

The dashboard calculates revenue from **delivered orders only**:
- Uses `order.total` field from Shiprocket API
- Fallback to `order.orderValue`, `order.codCharges`, etc.
- Only counts orders with status codes 6, 7, or 8
- COGS estimated as 40% of revenue

## Need Help?

1. Check browser console for error messages
2. Run the test scripts to verify functionality
3. Verify Shiprocket connection in database
4. Check if orders exist in the selected date range
5. Ensure orders are marked as "delivered" in Shiprocket