/**
 * Shiprocket Dashboard Controller - CORRECTED FORMULAS
 * 
 * Uses shiprocket.service.js to fetch data from both APIs:
 * - Orders API: Revenue, Payment type (COD/Prepaid), Order status
 * - Shipments API: Shipping charges, RTO charges, Delivery status
 * 
 * FORMULAS:
 * - Forward Shipping Cost = SUM(charges.freight_charges)
 * - RTO Cost = SUM(charges.charged_weight_amount_rto)
 * - Delivered Orders = COUNT(status = "DELIVERED")
 * - RTO Orders = COUNT(status IN ("RTO DELIVERED", "RTO INITIATED"))
 * - NDR Orders = COUNT(status IN ("NDR", "UNDELIVERED"))
 * - In Transit = COUNT(status IN ("IN TRANSIT", "OUT FOR DELIVERY", "PICKED UP"))
 * - Delivery Rate = (Delivered / Total Shipped) × 100
 * - RTO Rate = (RTO / Total Shipped) × 100
 */

const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');
const shiprocketService = require('../services/shiprocket.service');

/**
 * Main Shiprocket Dashboard Controller
 */
async function getShiprocketDashboardData(req, res) {
  const startTime = Date.now();

  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    console.log(`\n📦 ========================================`);
    console.log(`📦 Shiprocket Dashboard Request`);
    console.log(`📦 ========================================`);
    console.log(`👤 User: ${userId}`);
    console.log(`📅 Date Range: ${startDate} to ${endDate}`);
    console.log(`� U========================================\n`);

    // Get Shiprocket token, Meta insights, and business expenses
    const [shiprocketToken, metaInsights, businessExpensesData] = await Promise.all([
      getShiprocketToken(userId),
      getMetaInsights(userId, startDate, endDate),
      getBusinessExpenses(userId)
    ]);

    if (!shiprocketToken) {
      console.log(`❌ No Shiprocket token found for user: ${userId}`);
      return res.json({
        summary: createEmptyMetrics(),
        metadata: {
          error: 'Please connect your Shiprocket account'
        }
      });
    }

    // 🚀 FETCH FROM SHIPROCKET API - PROPER METHOD
    // Step 1: Fetch Orders (has order.total for revenue)
    // Step 2: Fetch Shipments (has delivery status)
    // Step 3: Merge them by order_id
    console.log(`🔄 Fetching Orders and Shipments from Shiprocket API...`);

    const axios = require('axios');
    const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';
    
    // Fetch Orders (contains revenue data)
    console.log(`📦 Step 1: Fetching Orders...`);
    let allOrders = [];
    let orderPage = 1;
    let hasMoreOrders = true;

    while (hasMoreOrders && orderPage <= 2) {
      const ordersResponse = await axios.get(`${SHIPROCKET_API_BASE}/orders`, {
        headers: {
          'Authorization': `Bearer ${shiprocketToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          page: orderPage,
          per_page: 250
        }
      });

      const orders = ordersResponse.data?.data || [];
      allOrders = allOrders.concat(orders);

      const pagination = ordersResponse.data?.meta?.pagination;
      if (pagination && pagination.current_page < pagination.total_pages) {
        orderPage++;
      } else {
        hasMoreOrders = false;
      }
    }

    console.log(`   ✅ Fetched ${allOrders.length} orders`);

    // Fetch Shipments (contains delivery status)
    console.log(`📦 Step 2: Fetching Shipments...`);
    let allShipments = [];
    let shipmentPage = 1;
    let hasMoreShipments = true;

    while (hasMoreShipments && shipmentPage <= 2) {
      const shipmentsResponse = await axios.get(`${SHIPROCKET_API_BASE}/shipments`, {
        headers: {
          'Authorization': `Bearer ${shiprocketToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          page: shipmentPage,
          per_page: 250
        }
      });

      const shipments = shipmentsResponse.data?.data || [];
      allShipments = allShipments.concat(shipments);

      const pagination = shipmentsResponse.data?.meta?.pagination;
      if (pagination && pagination.current_page < pagination.total_pages) {
        shipmentPage++;
      } else {
        hasMoreShipments = false;
      }
    }

    console.log(`   ✅ Fetched ${allShipments.length} shipments`);

    // Merge Orders and Shipments
    console.log(`🔗 Step 3: Merging Orders + Shipments...`);
    const shipmentMap = new Map(allShipments.map(s => [s.order_id, s]));
    
    const shiprocketData = allOrders.map(order => {
      const shipment = shipmentMap.get(order.id);
      
      return {
        // From Order (revenue data)
        id: order.id,
        order_id: order.id,
        channel_order_id: order.channel_order_id,
        customer_name: order.customer_name,
        total: order.total,  // ← ORDER REVENUE
        payment_method: order.payment_method,
        created_at: order.created_at,
        
        // From Shipment (status data)
        shipmentId: shipment?.id,
        status: shipment?.status || 'PENDING',  // ← DELIVERY STATUS
        awb: shipment?.awb,
        courier: shipment?.courier_name,
        charges: shipment?.charges || {},
        
        // Combined
        channel_name: order.channel_name || shipment?.channel_name
      };
    });

    console.log(`   ✅ Merged ${shiprocketData.length} records`);

    console.log(`📊 Data fetched from Shiprocket API:`);
    console.log(`   Total records: ${shiprocketData.length}`);
    console.log(`   Data source: shiprocket_api_direct`);
    console.log(`   Meta insights: ${metaInsights.length}`);

    // Calculate all metrics using CORRECT formulas
    // Filter shiprocketData by startDate/endDate
    const filteredShiprocketData = shiprocketData.filter(item => {
      // Shiprocket API uses created_at field
      const dateStr = item.created_at;
      if (!dateStr) return false;
      
      try {
        // Parse Shiprocket date format: "13th Dec 2025 06:43 AM"
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        
        const dateOnly = d.toISOString().split('T')[0];
        return dateOnly >= startDate && dateOnly <= endDate;
      } catch (error) {
        return false;
      }
    });

    console.log(`   Filtered records (${startDate} to ${endDate}): ${filteredShiprocketData.length}`);

    const metrics = calculateMetrics(filteredShiprocketData, metaInsights, businessExpensesData);

    const duration = Date.now() - startTime;
    console.log(`✅ Dashboard completed in ${duration}ms`);

    res.json({
      summary: metrics.summary,
      performanceChartData: metrics.chartData,
      financialsBreakdownData: metrics.financials,
      metadata: {
        totalRecords: filteredShiprocketData.length,
        dataSource: 'shiprocket_api_direct',
        cacheAge: 0,
        dateRange: { startDate, endDate },
        lastUpdated: new Date().toISOString(),
        fetchTime: duration
      }
    });

  } catch (error) {
    console.error('❌ Shiprocket dashboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: error.message,
      summary: createEmptyMetrics()
    });
  }
}

/**
 * Get Shiprocket token from database with automatic refresh
 */
async function getShiprocketToken(userId) {
  try {
    const command = new QueryCommand({
      TableName: 'shipping_connections',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    });
    const result = await dynamoDB.send(command);
    const connection = result.Items?.[0];

    if (!connection || !connection.token) {
      return null;
    }

    // Check if token is expired or about to expire (< 1 day remaining)
    const expiresAt = connection.expiresAt ? new Date(connection.expiresAt) : null;
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (expiresAt && expiresAt < oneDayFromNow) {
      console.log(`🔄 Shiprocket token expired or expiring soon (expires: ${expiresAt.toISOString()})`);

      // Check if we have stored credentials for auto-refresh
      if (connection.email && connection.password) {
        console.log(`🔑 Auto-refreshing Shiprocket token for user: ${userId}`);

        try {
          // Import the connectShiprocket function
          const shippingController = require('./shipping.controller');
          const axios = require('axios');

          // Refresh token using stored credentials
          const response = await axios.post(
            'https://apiv2.shiprocket.in/v1/external/auth/login',
            {
              email: connection.email.trim(),
              password: connection.password
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              timeout: 30000
            }
          );

          if (response.status === 200 && response.data && response.data.token) {
            const newToken = response.data.token;
            const newExpiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

            console.log(`✅ Token refreshed successfully, new expiry: ${newExpiresAt}`);

            // Update token in database
            const { PutCommand } = require('@aws-sdk/lib-dynamodb');
            const updateCommand = new PutCommand({
              TableName: 'shipping_connections',
              Item: {
                ...connection,
                token: newToken,
                expiresAt: newExpiresAt,
                updatedAt: new Date().toISOString(),
                lastTokenRefresh: new Date().toISOString()
              }
            });

            await dynamoDB.send(updateCommand);

            return newToken;
          } else {
            console.error(`❌ Token refresh failed: Invalid response`);
            return connection.token; // Return old token, let API call fail naturally
          }
        } catch (refreshError) {
          console.error(`❌ Token refresh failed:`, refreshError.message);
          // Return old token, let API call fail naturally
          return connection.token;
        }
      } else {
        console.log(`⚠️  Token expired but no stored credentials for auto-refresh`);
        console.log(`   User must reconnect Shiprocket manually in settings`);
        return null; // Force user to reconnect
      }
    }

    return connection.token;
  } catch (error) {
    console.error('Error fetching Shiprocket token:', error.message);
    return null;
  }
}

/**
 * Get Meta insights from database
 */
async function getMetaInsights(userId, startDate, endDate) {
  try {
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
    const command = new QueryCommand({
      TableName: process.env.META_INSIGHTS_TABLE || 'meta_insights',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#date BETWEEN :startDate AND :endDate',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':startDate': startDate,
        ':endDate': endDate
      },
      ExpressionAttributeNames: { '#date': 'date' }
    });
    const result = await dynamoDB.send(command);
    return result.Items || [];
  } catch (error) {
    console.error('Error fetching Meta insights:', error.message);
    return [];
  }
}

/**
 * Get business expenses from database
 */
async function getBusinessExpenses(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'Users',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ProjectionExpression: 'businessExpenses'
    });
    const result = await dynamoDB.send(command);
    return result.Items?.[0]?.businessExpenses || {
      agencyFees: 0, rtoHandlingFees: 0, paymentGatewayFeePercent: 2.5,
      staffFees: 0, officeRent: 0, otherExpenses: 0
    };
  } catch (error) {
    console.error('Error fetching business expenses:', error.message);
    return { agencyFees: 0, rtoHandlingFees: 0, paymentGatewayFeePercent: 2.5, staffFees: 0, officeRent: 0, otherExpenses: 0 };
  }
}


/**
 * Calculate ALL metrics using CORRECT formulas
 * Uses merged data from shiprocket.service.js (Orders + Shipments APIs)
 */
function calculateMetrics(shiprocketData, metaInsights, businessExpenses) {

  console.log(`\n📊 CALCULATING METRICS...`);
  console.log(`   Total records: ${shiprocketData.length}`);

  // Debug: Log all unique statuses
  const allStatuses = {};
  shiprocketData.forEach(r => {
    const status = (r.shipmentStatus || r.status || 'NO_STATUS').toUpperCase().trim();
    const statusCode = r.statusCode;
    const key = `${status} (${statusCode})`;
    allStatuses[key] = (allStatuses[key] || 0) + 1;
  });
  console.log(`   All statuses:`, allStatuses);

  // ========== STATUS COUNTS ==========

  // Get status from merged data
  const getStatus = (record) => {
    // Use shipmentStatus from Shipments API if available, otherwise use status from Orders API
    return (record.shipmentStatus || record.status || '').toUpperCase().trim();
  };

  const getStatusCode = (record) => {
    return parseInt(record.statusCode) || 0;
  };

  // Delivered Orders = COUNT(status = "DELIVERED") - ONLY exact match
  const deliveredRecords = shiprocketData.filter(r => {
    const status = getStatus(r);
    const code = getStatusCode(r);
    // Status code 6 = Delivered, 7 = Delivered (COD), 8 = Delivered (Prepaid)
    return status === 'DELIVERED' || code === 6 || code === 7 || code === 8;
  });
  const deliveredCount = deliveredRecords.length;

  // RTO Orders = COUNT(status IN ("RTO DELIVERED", "RTO INITIATED"))
  const rtoRecords = shiprocketData.filter(r => {
    const status = getStatus(r);
    const code = getStatusCode(r);
    // Status code 9 = RTO
    return status === 'RTO DELIVERED' || status === 'RTO INITIATED' ||
      status.includes('RTO') || code === 9;
  });
  const rtoCount = rtoRecords.length;

  // NDR Orders = COUNT(status IN ("NDR", "UNDELIVERED"))
  const ndrRecords = shiprocketData.filter(r => {
    const status = getStatus(r);
    return status === 'NDR' || status === 'UNDELIVERED' || status.includes('NDR');
  });
  const ndrCount = ndrRecords.length;

  // In Transit = COUNT(status IN ("IN TRANSIT", "OUT FOR DELIVERY", "PICKED UP"))
  const inTransitRecords = shiprocketData.filter(r => {
    const status = getStatus(r);
    const code = getStatusCode(r);
    // Status code 4 = Shipped, 5 = In Transit
    return status === 'IN TRANSIT' || status === 'OUT FOR DELIVERY' ||
      status === 'PICKED UP' || status === 'SHIPPED' ||
      status.includes('TRANSIT') || status.includes('OUT FOR') ||
      code === 4 || code === 5;
  });
  const inTransitCount = inTransitRecords.length;

  // Awaiting Pickup = COUNT(status IN ("NEW", "READY TO SHIP", "PICKUP SCHEDULED"))
  const awaitingPickupRecords = shiprocketData.filter(r => {
    const status = getStatus(r);
    const code = getStatusCode(r);
    // Status code 1 = New, 2 = AWB Assigned, 3 = Pickup Scheduled
    return status === 'NEW' || status === 'READY TO SHIP' ||
      status === 'PICKUP SCHEDULED' || status === 'AWB ASSIGNED' ||
      status.includes('PICKUP') || status.includes('READY') ||
      code === 1 || code === 2 || code === 3;
  });
  const awaitingPickupCount = awaitingPickupRecords.length;

  // COD vs Prepaid (from payment_method field)
  const codRecords = shiprocketData.filter(r =>
    (r.paymentMethod || '').toLowerCase() === 'cod'
  );
  const prepaidRecords = shiprocketData.filter(r =>
    (r.paymentMethod || '').toLowerCase() === 'prepaid'
  );
  const codCount = codRecords.length;
  const prepaidCount = prepaidRecords.length;

  // ========== SHIPPING COSTS (from Shipments API via merged data) ==========

  // Shipping Charges = SUM(freight_charges) - from ALL shipped orders
  const shippingCharges = shiprocketData.reduce((sum, r) => {
    const freight = parseFloat(r.freightCharges || r.shippingCharges || 0);
    return sum + freight;
  }, 0);

  // Log sample freight charges for debugging
  console.log(`\n💰 FREIGHT CHARGES BREAKDOWN:`);
  const sampleRecords = shiprocketData.slice(0, 5);
  sampleRecords.forEach(r => {
    console.log(`   Order ${r.orderId}: ₹${r.freightCharges || 0} (status: ${r.status})`);
  });
  console.log(`   Total Shipping Charges: ₹${shippingCharges.toFixed(2)}`);

  // RTO Charges = SUM(freight_charges) from RTO orders only
  const rtoCharges = rtoRecords.reduce((sum, r) => {
    return sum + parseFloat(r.freightCharges || r.shippingCharges || r.appliedWeightAmount || 0);
  }, 0);

  // Total Shipping Cost = Shipping + RTO
  const totalShippingCost = shippingCharges + rtoCharges;

  // ========== REVENUE CALCULATION ==========

  // Revenue = SUM of delivered order totals
  let revenue = 0;
  let prepaidRevenue = 0;

  deliveredRecords.forEach(r => {
    const orderTotal = parseFloat(r.total || r.orderValue || r.totalAmount || r.amount || 0);
    revenue += orderTotal;
    if ((r.paymentMethod || '').toLowerCase() === 'prepaid') {
      prepaidRevenue += orderTotal;
    }
  });

  console.log(`   Revenue from ${deliveredCount} delivered orders: ₹${revenue}`);

  // ========== RATES ==========
  const totalShipped = deliveredCount + rtoCount + inTransitCount + ndrCount;
  const totalOrders = shiprocketData.length;

  // Delivery Rate = (Delivered / Total Shipped) × 100
  const deliveryRate = totalShipped > 0 ? (deliveredCount / totalShipped) * 100 : 0;

  // RTO Rate = (RTO / Total Shipped) × 100
  const rtoRate = totalShipped > 0 ? (rtoCount / totalShipped) * 100 : 0;

  // ========== META AD SPEND ==========
  const adSpend = metaInsights.reduce((sum, i) => sum + (i.adSpend || 0), 0);

  // ========== BUSINESS EXPENSES ==========
  const paymentGatewayFees = prepaidRevenue * ((businessExpenses.paymentGatewayFeePercent || 2.5) / 100);
  const totalBusinessExpenses =
    (businessExpenses.agencyFees || 0) +
    (businessExpenses.rtoHandlingFees || 0) +
    (businessExpenses.staffFees || 0) +
    (businessExpenses.officeRent || 0) +
    (businessExpenses.otherExpenses || 0) +
    paymentGatewayFees;

  // ========== PROFIT CALCULATIONS ==========

  // Net Profit = Revenue - Business Expenses - Ad Spend - Shipping Cost
  const netProfit = revenue - totalBusinessExpenses - adSpend - totalShippingCost;
  const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  // ROAS & POAS
  const roas = adSpend > 0 ? revenue / adSpend : 0;
  const poas = adSpend > 0 ? netProfit / adSpend : 0;

  // AOV & CPP
  const aov = deliveredCount > 0 ? revenue / deliveredCount : 0;
  const cpp = deliveredCount > 0 ? (adSpend + totalShippingCost) / deliveredCount : 0;

  // ========== LOG METRICS ==========
  console.log(`\n📊 METRICS CALCULATED:`);
  console.log(`   Total Orders: ${totalOrders}`);
  console.log(`   Delivered: ${deliveredCount}`);
  console.log(`   RTO: ${rtoCount}`);
  console.log(`   NDR: ${ndrCount}`);
  console.log(`   In Transit: ${inTransitCount}`);
  console.log(`   Awaiting Pickup: ${awaitingPickupCount}`);
  console.log(`   COD Orders: ${codCount}`);
  console.log(`   Prepaid Orders: ${prepaidCount}`);
  console.log(`   Shipping Charges: ₹${shippingCharges.toFixed(2)}`);
  console.log(`   RTO Charges: ₹${rtoCharges.toFixed(2)}`);
  console.log(`   Revenue: ₹${revenue.toFixed(2)}`);
  console.log(`   Delivery Rate: ${deliveryRate.toFixed(2)}%`);
  console.log(`   RTO Rate: ${rtoRate.toFixed(2)}%`);
  console.log(`   Net Profit: ₹${netProfit.toFixed(2)}\n`);

  // ========== BUILD SUMMARY ARRAY ==========
  const summary = [
    // Revenue & Profit
    { title: 'Revenue', value: `₹${revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total revenue from delivered orders' },
    { title: 'Net Profit', value: `₹${netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Revenue - Business Expenses - Ad Spend - Shipping Cost' },
    { title: 'Net Profit Margin', value: `${netProfitMargin.toFixed(2)}%`, formula: '(Net Profit / Revenue) × 100' },
    { title: 'Net Profit Per Order', value: `₹${deliveredCount > 0 ? (netProfit / deliveredCount).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}`, formula: 'Net Profit / Delivered Orders' },

    // Ad Spend & Business Expenses
    { title: 'Ad Spend', value: `₹${adSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total from Meta API' },
    { title: 'Business Expenses', value: `₹${totalBusinessExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Agency + RTO + Gateway + Staff + Rent + Other' },

    // Shipping Costs
    { title: 'Shipping Charges', value: `₹${shippingCharges.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'SUM(freight_charges) from Shiprocket' },
    { title: 'Shipping Per Order', value: `₹${deliveredCount > 0 ? (shippingCharges / deliveredCount).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}`, formula: 'Shipping Charges / Delivered Orders' },
    { title: 'RTO Charges', value: `₹${rtoCharges.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'SUM(freight_charges) from RTO orders' },

    // Order Counts
    { title: 'Delivered Orders', value: deliveredCount.toLocaleString('en-IN'), formula: 'COUNT(status = "DELIVERED")' },

    // Marketing Metrics
    { title: 'ROAS', value: roas.toFixed(2), formula: 'Revenue / Ad Spend' },
    { title: 'POAS', value: poas.toFixed(2), formula: 'Net Profit / Ad Spend' },
    { title: 'AOV', value: `₹${aov.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Revenue / Delivered Orders' },
    { title: 'CPP', value: `₹${cpp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: '(Ad Spend + Shipping) / Delivered Orders' },

    // COGS (not available)
    { title: 'COGS', value: '--', formula: 'Not available - requires product cost data' },
    { title: 'Gross Profit', value: '--', formula: 'Cannot calculate without COGS' }
  ];

  // ========== BUILD CHART DATA ==========
  const chartData = buildChartData(deliveredRecords);

  // ========== BUILD FINANCIALS ==========
  const financials = {
    revenue,
    pieData: [
      { name: 'Shipping Charges', value: shippingCharges, color: '#1a4037' },
      { name: 'RTO Charges', value: rtoCharges, color: '#8B0000' },
      { name: 'Ad Spend', value: adSpend, color: '#2d6a4f' },
      { name: 'Business Expenses', value: totalBusinessExpenses, color: '#0d2923' },
      { name: 'Net Profit', value: Math.max(0, netProfit), color: '#40916c' }
    ].filter(item => item.value > 0),
    list: [
      { name: 'Shipping Charges', value: shippingCharges },
      { name: 'RTO Charges', value: rtoCharges },
      { name: 'Ad Spend', value: adSpend },
      { name: 'Business Expenses', value: totalBusinessExpenses },
      { name: 'Net Profit', value: netProfit }
    ]
  };

  return { summary, chartData, financials };
}

/**
 * Build chart data from delivered records
 */
function buildChartData(deliveredRecords) {
  const dailyData = new Map();

  deliveredRecords.forEach(r => {
    const date = r.parsedOrderDate || r.orderDate?.split('T')[0] || r.createdAt?.split('T')[0];
    if (!date) return;

    const revenue = parseFloat(r.total || r.orderValue || r.totalAmount || 0);
    const shippingCost = parseFloat(r.freightCharges || r.shippingCharges || 0);

    const existing = dailyData.get(date);
    if (existing) {
      existing.revenue += revenue;
      existing.orders += 1;
      existing.shippingCosts += shippingCost;
    } else {
      dailyData.set(date, {
        date,
        revenue,
        orders: 1,
        shippingCosts: shippingCost
      });
    }
  });

  return Array.from(dailyData.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({
      name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: Math.round(item.revenue),
      orders: item.orders,
      shippingCosts: Math.round(item.shippingCosts)
    }));
}

/**
 * Create empty metrics for error cases
 */
function createEmptyMetrics() {
  return [
    { title: 'Total Orders', value: '0', formula: 'No data' },
    { title: 'Revenue', value: '₹0', formula: 'No data' },
    { title: 'Net Profit', value: '₹0', formula: 'No data' },
    { title: 'Forward Shipping', value: '₹0', formula: 'No data' },
    { title: 'RTO Cost', value: '₹0', formula: 'No data' },
    { title: 'Delivered Orders', value: '0', formula: 'No data' },
    { title: 'RTO Orders', value: '0', formula: 'No data' },
    { title: 'Delivery Rate', value: '0%', formula: 'No data' },
    { title: 'RTO Rate', value: '0%', formula: 'No data' }
  ];
}

module.exports = {
  getShiprocketDashboardData
};
