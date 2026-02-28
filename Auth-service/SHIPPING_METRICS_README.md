# Shipping Metrics Feature

## Overview
This feature calculates and displays shipping metrics from Shiprocket API data, including:
- **Shipping Spend**: Total freight charges for all shipments
- **RTO Delivered**: Count of orders with "RTO DELIVERED" status
- **Delivered Orders**: Count of successfully delivered orders
- **Revenue Earned**: Sum of COD charges from delivered orders

## Backend Implementation

### Service Method
Location: `services/shiprocket.service.js`

```javascript
calculateShippingMetrics(token, options)
```

**Parameters:**
- `token`: Shiprocket API authentication token
- `options`: Object with optional parameters
  - `startDate`: Filter by start date (format: YYYY-MM-DD)
  - `endDate`: Filter by end date (format: YYYY-MM-DD)
  - `perPage`: Records per page (default: 250)

**Returns:**
```javascript
{
  success: true,
  metrics: {
    shippingSpend: 23947.84,        // Total freight charges
    rtoDeliveredCount: 72,          // RTO delivered count
    deliveredCount: 48,             // Delivered orders count
    revenueEarned: 2042.95,         // COD collected from delivered orders
    totalShipments: 200,            // Total shipments
    canceledCount: 78,              // Canceled orders
    pendingCount: 3,                // Pending orders
    deliveryRate: 24.00,            // Delivery success rate %
    rtoRate: 36.00,                 // RTO rate %
    netShippingCost: 21904.89       // Shipping spend - revenue earned
  },
  dateRange: {
    startDate: '2025-12-01',
    endDate: '2026-01-15'
  }
}
```

### Controller Endpoint
Location: `controllers/shipping.controller.js`

```javascript
GET /api/shipping/metrics
```

**Query Parameters:**
- `startDate` (optional): Start date for filtering
- `endDate` (optional): End date for filtering

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "success": true,
  "metrics": {
    "shippingSpend": 23947.84,
    "rtoDeliveredCount": 72,
    "deliveredCount": 48,
    "revenueEarned": 2042.95,
    "totalShipments": 200,
    "canceledCount": 78,
    "pendingCount": 3,
    "deliveryRate": 24.00,
    "rtoRate": 36.00,
    "netShippingCost": 21904.89
  },
  "dateRange": {
    "startDate": "2025-12-01",
    "endDate": "2026-01-15"
  }
}
```

## Frontend Implementation

### Component
Location: `frontend-profit-first/client/src/components/ShippingMetrics.jsx`

**Props:**
- `startDate`: Start date for filtering (format: YYYY-MM-DD)
- `endDate`: End date for filtering (format: YYYY-MM-DD)

**Usage:**
```jsx
import ShippingMetrics from '../components/ShippingMetrics';

<ShippingMetrics 
  startDate="2025-12-01"
  endDate="2026-01-15"
/>
```

### Integration
The component is integrated into the Shipping page (`pages/Shipping.jsx`) and automatically updates when the date range changes.

## Testing

### Backend Test Script
Location: `scripts/test-shipping-metrics.js`

**Setup:**
1. Add your Shiprocket token to `.env`:
   ```
   SHIPROCKET_TOKEN=your_token_here
   ```

2. Run the test:
   ```bash
   node scripts/test-shipping-metrics.js
   ```

**Expected Output:**
```
📊 Calculating metrics...
✅ Metrics calculated successfully!

📈 SHIPPING METRICS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Shipping Spend:      ₹23,947.84
📦 RTO Delivered:       72 orders
✅ Delivered Orders:    48 orders
💵 Revenue Earned:      ₹2,042.95
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total Shipments:     200
❌ Canceled:            78
⏳ Pending:             3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Delivery Rate:       24%
📉 RTO Rate:            36%
💸 Net Shipping Cost:   ₹21,904.89
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### API Testing with cURL

**Get metrics for all time:**
```bash
curl -X GET "http://localhost:3000/api/shipping/metrics" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get metrics for date range:**
```bash
curl -X GET "http://localhost:3000/api/shipping/metrics?startDate=2025-12-01&endDate=2026-01-15" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Calculation Logic

### Shipping Spend
- Sums all `freight_charges` from shipments
- Includes all shipment statuses (DELIVERED, RTO DELIVERED, CANCELED, PENDING)

### RTO Delivered Count
- Counts shipments with status = "RTO DELIVERED"

### Delivered Orders Count
- Counts shipments with status = "DELIVERED"

### Revenue Earned
- Sums `cod_charges` from shipments with status = "DELIVERED"
- Only includes successfully delivered orders where COD was collected

### Additional Metrics
- **Delivery Rate**: (Delivered / Total) × 100
- **RTO Rate**: (RTO Delivered / Total) × 100
- **Net Shipping Cost**: Shipping Spend - Revenue Earned

## Error Handling

The API handles the following error scenarios:
1. **No Shiprocket connection**: Returns 400 with message to connect account
2. **API errors**: Returns 500 with error details
3. **Invalid date format**: Returns error from Shiprocket API

Frontend component handles:
1. Loading states with spinner
2. Error states with retry button
3. Empty states when no data available

## Performance Considerations

- The API fetches all pages of shipments data (pagination handled automatically)
- Default page size: 250 records per request
- Calculations are performed in-memory after fetching
- Consider caching results for frequently accessed date ranges

## Future Enhancements

Potential improvements:
1. Cache metrics in DynamoDB for faster retrieval
2. Add real-time updates via WebSocket
3. Export metrics to CSV/Excel
4. Add more granular filtering (by courier, zone, etc.)
5. Historical trend analysis
6. Predictive analytics for RTO rates
