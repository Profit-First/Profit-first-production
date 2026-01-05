# 🔍 Debugging Steps for Shiprocket Dashboard Showing Zeros

## 🎯 **Your Issue**
- Shiprocket dashboard shows all zeros
- But your actual Shiprocket account has:
  - **22 shipments** in last 30 days
  - **15 delivered**, **3 in-transit**, **1 NDR pending**, **4 RTO**

## 🔧 **Step 1: Debug Your Real API Connection**

Run this command with your actual user ID:
```bash
cd Auth-service
node debug-real-shiprocket.js YOUR_USER_ID_HERE
```

**Example:**
```bash
node debug-real-shiprocket.js user_12345
```

This will test:
- ✅ If your Shiprocket token exists
- ✅ If API calls work
- ✅ What data is actually returned
- ✅ Different date ranges (7, 30, 90 days)

## 🔧 **Step 2: Check Browser Console**

1. Open your Shiprocket dashboard in browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Look for these logs:

**Good signs:**
```
📦 DIRECT Shiprocket Dashboard - User: [your-user-id]
✅ Shiprocket token found, fetching data directly from API...
📦 Found X orders on page 1
🚚 Found Y shipments on page 1
📊 Orders status breakdown: {...}
📊 Shipments status breakdown: {...}
```

**Bad signs:**
```
❌ No Shiprocket token found
❌ Error fetching orders: 401 Unauthorized
⚠️ No orders found on page 1
⚠️ No shipments found on page 1
```

## 🔧 **Step 3: Check Network Tab**

1. In Developer Tools, go to Network tab
2. Refresh the dashboard
3. Look for API calls to:
   - `https://apiv2.shiprocket.in/v1/external/orders`
   - `https://apiv2.shiprocket.in/v1/external/shipments`

**Check:**
- ✅ Status 200 (success)
- ❌ Status 401 (unauthorized - token issue)
- ❌ Status 429 (rate limited)
- ❌ Status 500 (server error)

## 🔧 **Step 4: Test Debug API Endpoint**

Visit this URL in your browser (replace with your domain):
```
https://your-domain.com/api/data/shiprocket-debug?startDate=2025-11-01&endDate=2025-12-31
```

This will show:
- Connection status
- Token validity
- Sample API data
- Status breakdown

## 🚨 **Common Issues & Solutions**

### **Issue 1: Date Range Problem**
**Symptoms:** API calls work but return 0 records
**Solution:** 
- Try expanding date range to last 90 days
- Check if your orders are outside the selected range

### **Issue 2: Token Invalid**
**Symptoms:** 401 Unauthorized errors
**Solution:**
- Re-connect Shiprocket account in dashboard settings
- Generate new API token in Shiprocket panel

### **Issue 3: Rate Limiting**
**Symptoms:** 429 Too Many Requests
**Solution:**
- Wait 5-10 minutes
- Reduce API call frequency

### **Issue 4: Wrong Status Mapping**
**Symptoms:** Orders exist but show as 0 delivered
**Solution:**
- Check actual status strings in API response
- Update status detection logic

## 🎯 **Expected Debug Output**

When working correctly, you should see:
```
✅ Token found: eyJ0eXAiOiJKV1QiLCJhbGc...
✅ Orders found: 22
✅ Shipments found: 22
📊 Orders status breakdown: {
  "DELIVERED": 15,
  "IN TRANSIT": 3,
  "NDR PENDING": 1,
  "RTO DELIVERED": 4
}
📊 Metrics calculated:
   Total Orders: 22
   Delivered: 15
   In Transit: 3
   NDR Pending: 1
   RTO: 4
```

## 🔄 **Next Steps**

1. **Run debug script** with your user ID
2. **Share the output** so I can see what's happening
3. **Check browser console** for API errors
4. **Try different date ranges** if needed

The debug script will show exactly what's happening with your API calls and help identify the root cause of the zero values.

## 📞 **Need Help?**

If debug script shows errors, share:
1. The complete debug output
2. Your browser console logs
3. Network tab showing API responses
4. Your date range settings

This will help pinpoint exactly why the dashboard shows zeros despite having 22 shipments in your account.