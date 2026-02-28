/**
 * Shiprocket Dashboard Controller V2
 * Reads directly from shiprocket_revenue_stats table
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1'
});

const dynamoDB = DynamoDBDocumentClient.from(client);

/**
 * Get Shiprocket Dashboard Data from revenue_stats table
 */
async function getShiprocketDashboardData(req, res) {
  const startTime = Date.now();

  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    console.log(`\n📦 ========================================`);
    console.log(`📦 Shiprocket Dashboard Request (V2)`);
    console.log(`📦 ========================================`);
    console.log(`👤 User: ${userId}`);
    console.log(`📅 Date Range: ${startDate} to ${endDate}`);
    console.log(`📦 ========================================\n`);

    // Fetch revenue stats from database
    console.log(`📊 Fetching revenue stats from shiprocket_revenue_stats table...`);
    
    const scanCommand = new ScanCommand({
      TableName: 'shiprocket_revenue_stats',
      FilterExpression: '#date BETWEEN :startDate AND :endDate',
      ExpressionAttributeNames: {
        '#date': 'date'
      },
      ExpressionAttributeValues: {
        ':startDate': startDate,
        ':endDate': endDate + 'T23:59:59.999Z'
      }
    });

    const statsResult = await dynamoDB.send(scanCommand);
    const revenueStats = statsResult.Items || [];

    console.log(`   ✅ Found ${revenueStats.length} revenue stat record(s)`);

    if (revenueStats.length === 0) {
      console.log(`⚠️  No revenue stats found for date range`);
      
      return res.json({
        summary: {
          totalRevenue: 0,
          deliveredOrders: 0,
          rtoOrders: 0,
          canceledOrders: 0,
          shippingCost: 0,
          netProfit: 0
        },
        metadata: {
          message: 'No revenue data available for this date range',
          dateRange: { startDate, endDate }
        }
      });
    }

    // Aggregate stats from all records in date range
    const aggregated = revenueStats.reduce((acc, stat) => {
      return {
        delivered_orders: (acc.delivered_orders || 0) + (stat.delivered_orders || 0),
        delivered_revenue: (acc.delivered_revenue || 0) + (stat.delivered_revenue || 0),
        delivered_freight_charges: (acc.delivered_freight_charges || 0) + (stat.delivered_freight_charges || 0),
        rto_delivered: (acc.rto_delivered || 0) + (stat.rto_delivered || 0),
        rto_freight_charges: (acc.rto_freight_charges || 0) + (stat.rto_freight_charges || 0),
        canceled_orders: (acc.canceled_orders || 0) + (stat.canceled_orders || 0),
        total_revenue: (acc.total_revenue || 0) + (stat.total_revenue || 0),
        total_shipping_spend: (acc.total_shipping_spend || 0) + (stat.total_shipping_spend || 0)
      };
    }, {});

    console.log(`📊 Aggregated Stats:`, aggregated);

    // Build response
    const summary = {
      totalRevenue: aggregated.total_revenue || 0,
      deliveredOrders: aggregated.delivered_orders || 0,
      deliveredRevenue: aggregated.delivered_revenue || 0,
      rtoOrders: aggregated.rto_delivered || 0,
      canceledOrders: aggregated.canceled_orders || 0,
      shippingCost: aggregated.total_shipping_spend || 0,
      deliveredFreight: aggregated.delivered_freight_charges || 0,
      rtoFreight: aggregated.rto_freight_charges || 0,
      netProfit: (aggregated.total_revenue || 0) - (aggregated.total_shipping_spend || 0),
      
      // Additional metrics
      totalOrders: (aggregated.delivered_orders || 0) + (aggregated.rto_delivered || 0) + (aggregated.canceled_orders || 0),
      deliveryRate: aggregated.delivered_orders > 0 
        ? ((aggregated.delivered_orders / ((aggregated.delivered_orders || 0) + (aggregated.rto_delivered || 0))) * 100).toFixed(2)
        : 0,
      rtoRate: aggregated.rto_delivered > 0
        ? ((aggregated.rto_delivered / ((aggregated.delivered_orders || 0) + (aggregated.rto_delivered || 0))) * 100).toFixed(2)
        : 0
    };

    const duration = Date.now() - startTime;
    console.log(`✅ Dashboard completed in ${duration}ms`);
    console.log(`📊 Summary:`, summary);

    res.json({
      summary,
      metadata: {
        totalRecords: revenueStats.length,
        dataSource: 'shiprocket_revenue_stats',
        dateRange: { startDate, endDate },
        lastUpdated: revenueStats[0]?.date || new Date().toISOString(),
        fetchTime: duration
      }
    });

  } catch (error) {
    console.error('❌ Shiprocket dashboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: error.message,
      summary: {
        totalRevenue: 0,
        deliveredOrders: 0,
        rtoOrders: 0,
        canceledOrders: 0,
        shippingCost: 0,
        netProfit: 0
      }
    });
  }
}

/**
 * Get Shiprocket summary for chatbot (non-HTTP version)
 */
async function getShiprocketSummaryForChatbot(userId, startDate, endDate) {
  try {
    console.log(`📊 Chatbot: Fetching Shiprocket data from revenue_stats table...`);
    
    const scanCommand = new ScanCommand({
      TableName: 'shiprocket_revenue_stats',
      FilterExpression: '#date BETWEEN :startDate AND :endDate',
      ExpressionAttributeNames: {
        '#date': 'date'
      },
      ExpressionAttributeValues: {
        ':startDate': startDate,
        ':endDate': endDate + 'T23:59:59.999Z'
      }
    });

    const statsResult = await dynamoDB.send(scanCommand);
    const revenueStats = statsResult.Items || [];

    console.log(`   ✅ Chatbot: Found ${revenueStats.length} revenue stat record(s)`);

    if (revenueStats.length === 0) {
      return {
        totalRevenue: 0,
        deliveredOrders: 0,
        rtoOrders: 0,
        canceledOrders: 0,
        shippingCost: 0,
        netProfit: 0,
        moneyKept: 0
      };
    }

    // Aggregate stats
    const aggregated = revenueStats.reduce((acc, stat) => {
      return {
        delivered_orders: (acc.delivered_orders || 0) + (stat.delivered_orders || 0),
        delivered_revenue: (acc.delivered_revenue || 0) + (stat.delivered_revenue || 0),
        delivered_freight_charges: (acc.delivered_freight_charges || 0) + (stat.delivered_freight_charges || 0),
        rto_delivered: (acc.rto_delivered || 0) + (stat.rto_delivered || 0),
        rto_freight_charges: (acc.rto_freight_charges || 0) + (stat.rto_freight_charges || 0),
        canceled_orders: (acc.canceled_orders || 0) + (stat.canceled_orders || 0),
        total_revenue: (acc.total_revenue || 0) + (stat.total_revenue || 0),
        total_shipping_spend: (acc.total_shipping_spend || 0) + (stat.total_shipping_spend || 0)
      };
    }, {});

    const netProfit = (aggregated.total_revenue || 0) - (aggregated.total_shipping_spend || 0);

    return {
      totalRevenue: aggregated.total_revenue || 0,
      deliveredOrders: aggregated.delivered_orders || 0,
      deliveredRevenue: aggregated.delivered_revenue || 0,
      rtoOrders: aggregated.rto_delivered || 0,
      canceledOrders: aggregated.canceled_orders || 0,
      shippingCost: aggregated.total_shipping_spend || 0,
      deliveredFreight: aggregated.delivered_freight_charges || 0,
      rtoFreight: aggregated.rto_freight_charges || 0,
      netProfit: netProfit,
      moneyKept: netProfit, // Same as net profit
      totalOrders: (aggregated.delivered_orders || 0) + (aggregated.rto_delivered || 0) + (aggregated.canceled_orders || 0),
      deliveryRate: aggregated.delivered_orders > 0 
        ? ((aggregated.delivered_orders / ((aggregated.delivered_orders || 0) + (aggregated.rto_delivered || 0))) * 100).toFixed(2)
        : '0',
      rtoRate: aggregated.rto_delivered > 0
        ? ((aggregated.rto_delivered / ((aggregated.delivered_orders || 0) + (aggregated.rto_delivered || 0))) * 100).toFixed(2)
        : '0'
    };
  } catch (error) {
    console.error('❌ Chatbot: Error fetching Shiprocket data:', error);
    return {
      totalRevenue: 0,
      deliveredOrders: 0,
      rtoOrders: 0,
      canceledOrders: 0,
      shippingCost: 0,
      netProfit: 0,
      moneyKept: 0
    };
  }
}

module.exports = {
  getShiprocketDashboardData,
  getShiprocketSummaryForChatbot
};
