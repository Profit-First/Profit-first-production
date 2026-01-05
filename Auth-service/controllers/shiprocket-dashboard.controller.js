/**
 * Shiprocket Dashboard Controller - WITH META INTEGRATION
 * 
 * PURPOSE: Fetch data from Shiprocket + Meta APIs to show comprehensive metrics
 * APPROACH: Combine Shiprocket delivery data with actual Meta advertising data
 * 
 * FLOW:
 * 1. User opens dashboard
 * 2. Get Shiprocket token and Meta connection from database
 * 3. Fetch data directly from both Shiprocket and Meta APIs
 * 4. Calculate comprehensive metrics using real data
 * 5. Only COGS is not available (show as --)
 */

const { QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');
const axios = require('axios');

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';
const META_GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

/**
 * Main Shiprocket Dashboard Data Controller - WITH META DATA
 */
async function getShiprocketDashboardData(req, res) {
  const startTime = Date.now();
  
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;
    
    console.log(`\n📦 Shiprocket Dashboard + Meta - User: ${userId}`);
    console.log(`📅 Date range: ${startDate} to ${endDate}`);

    // Step 1: Get Shiprocket token and Meta insights from database
    const [shiprocketToken, metaConnection, metaInsights] = await Promise.all([
      getShiprocketToken(userId),
      getMetaConnection(userId),
      getMetaInsights(userId, startDate, endDate)
    ]);
    
    if (!shiprocketToken) {
      console.log(`❌ No Shiprocket token found for user: ${userId}`);
      return res.json({
        summary: createEmptyMetrics(),
        performanceChartData: [],
        financialsBreakdownData: { revenue: 0, pieData: [], list: [] },
        metadata: {
          totalShipments: 0,
          deliveredShipments: 0,
          dateRange: { startDate, endDate },
          lastUpdated: new Date().toISOString(),
          dataSource: 'No Shiprocket Connection',
          error: 'Please connect your Shiprocket account'
        }
      });
    }

    console.log(`✅ Shiprocket connected: ${!!shiprocketToken}`);
    console.log(`✅ Meta connected: ${!!metaConnection}`);
    console.log(`✅ Meta insights: ${metaInsights.length} records`);

    // Step 2: Fetch Shiprocket data
    const shiprocketData = await fetchShiprocketDataDirect(shiprocketToken, startDate, endDate);

    console.log(`📊 Data fetched:`);
    console.log(`   Shiprocket orders: ${shiprocketData.orders.length}`);
    console.log(`   Shiprocket shipments: ${shiprocketData.shipments.length}`);
    console.log(`   Meta insights: ${metaInsights.length}`);

    // Step 3: Process and merge data
    const processedData = mergeShiprocketMetaData(shiprocketData, metaInsights);
    
    // Step 4: Calculate comprehensive metrics with real data
    const summary = calculateComprehensiveMetrics(processedData);
    const performanceChartData = calculatePerformanceChart(processedData.orders);
    const financialsBreakdownData = calculateFinancialBreakdown(processedData);

    const dashboardData = {
      summary,
      performanceChartData,
      financialsBreakdownData,
      metadata: {
        totalShipments: processedData.orders.length,
        deliveredShipments: processedData.orders.filter(isDelivered).length,
        dateRange: { startDate, endDate },
        lastUpdated: new Date().toISOString(),
        dataSource: 'Shiprocket + Meta APIs',
        fetchTime: Date.now() - startTime,
        hasMetaData: metaInsights.length > 0
      }
    };

    const duration = Date.now() - startTime;
    console.log(`✅ Shiprocket + Meta dashboard completed in ${duration}ms`);

    res.json(dashboardData);
    
  } catch (error) {
    console.error('❌ Shiprocket + Meta dashboard error:', error);
    
    // Ensure we always return a valid response
    const errorResponse = {
      error: 'Failed to fetch dashboard data',
      message: error.message || 'Unknown error occurred',
      summary: createEmptyMetrics(),
      performanceChartData: [],
      financialsBreakdownData: { revenue: 0, pieData: [], list: [] },
      metadata: {
        totalShipments: 0,
        deliveredShipments: 0,
        dateRange: { startDate: req.query.startDate, endDate: req.query.endDate },
        lastUpdated: new Date().toISOString(),
        dataSource: 'Error',
        error: error.message || 'Unknown error'
      }
    };
    
    // Don't throw error, return error response instead
    res.status(500).json(errorResponse);
  }
}

/**
 * Get Shiprocket token from database
 */
async function getShiprocketToken(userId) {
  try {
    const command = new QueryCommand({
      TableName: 'shipping_connections',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await dynamoDB.send(command);
    const connection = result.Items?.[0];
    
    return connection?.token || null;
  } catch (error) {
    console.error('❌ Error fetching Shiprocket token:', error.message);
    return null;
  }
}

/**
 * Get Meta connection from database
 */
async function getMetaConnection(userId) {
  try {
    const command = new QueryCommand({
      TableName: 'meta_connections',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    });

    const result = await dynamoDB.send(command);
    const connection = result.Items?.[0];
    
    if (connection && connection.accessToken && connection.selectedAdAccount) {
      return {
        accessToken: connection.accessToken,
        adAccountId: connection.selectedAdAccount,
        adAccountName: connection.adAccountName
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error fetching Meta connection:', error.message);
    return null;
  }
}

/**
 * Get Meta connection from database
 */
async function getMetaConnection(userId) {
  try {
    const command = new QueryCommand({
      TableName: 'meta_connections',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    });

    const result = await dynamoDB.send(command);
    const connection = result.Items?.[0];
    
    if (connection && connection.accessToken && connection.selectedAdAccount) {
      return {
        accessToken: connection.accessToken,
        adAccountId: connection.selectedAdAccount,
        adAccountName: connection.adAccountName
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error fetching Meta connection:', error.message);
    return null;
  }
}

/**
 * Get Meta insights from database (pre-synced data)
 */
async function getMetaInsights(userId, startDate, endDate) {
  try {
    const command = new ScanCommand({
      TableName: process.env.META_INSIGHTS_TABLE || 'meta_insights',
      FilterExpression: 'userId = :userId AND #date BETWEEN :startDate AND :endDate',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':startDate': startDate,
        ':endDate': endDate
      },
      ExpressionAttributeNames: {
        '#date': 'date'
      },
      ProjectionExpression: 'userId, #date, adSpend, reach, linkClicks, impressions, metaRevenue, adAccountId'
    });
    
    const result = await dynamoDB.send(command);
    const insights = result.Items || [];
    
    console.log(`📊 Meta Insights: Found ${insights.length} insights for user ${userId} (${startDate} to ${endDate})`);
    
    if (insights.length > 0) {
      const totalAdSpend = insights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
      console.log(`   💰 Total Ad Spend from insights: ₹${totalAdSpend.toFixed(2)}`);
    }
    
    return insights.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error fetching Meta insights:', error.message);
    return [];
  }
}

/**
 * Fetch Shiprocket data (orders + shipments)
 */
async function fetchShiprocketDataDirect(token, startDate, endDate) {
  console.log(`📦 Fetching Shiprocket data...`);
  
  const [orders, shipments] = await Promise.all([
    fetchShiprocketOrdersDirect(token, startDate, endDate),
    fetchShiprocketShipmentsDirect(token, startDate, endDate)
  ]);
  
  return { orders, shipments };
}

/**
 * Fetch orders directly from Shiprocket API
 */
async function fetchShiprocketOrdersDirect(token, startDate, endDate) {
  console.log(`📦 Fetching orders directly from Shiprocket...`);
  console.log(`📅 Date range: ${startDate} to ${endDate}`);
  
  let allOrders = [];
  let page = 1;
  const maxPages = 20;
  const perPage = 250;
  
  while (page <= maxPages) {
    console.log(`   📄 Orders page ${page}...`);
    
    const params = {
      per_page: perPage,
      page: page
    };
    
    // Add date filters - try multiple approaches
    if (startDate && endDate) {
      // Method 1: DD-MM-YYYY format (Shiprocket's preferred format)
      const [startYear, startMonth, startDay] = startDate.split('-');
      const [endYear, endMonth, endDay] = endDate.split('-');
      
      params.created_after = `${startDay}-${startMonth}-${startYear}`;
      params.created_before = `${endDay}-${endMonth}-${endYear}`;
      
      console.log(`      📅 Using DD-MM-YYYY format: ${params.created_after} to ${params.created_before}`);
    } else {
      console.log(`      📅 No date filter - fetching all orders`);
    }
    
    try {
      const response = await axios.get(`${SHIPROCKET_API_BASE}/orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params
      });
      
      const orders = response.data?.data || [];
      console.log(`      📦 Found ${orders.length} orders on page ${page}`);
      
      if (orders.length === 0) {
        console.log(`      ⚠️  No orders found on page ${page}`);
        break;
      }
      
      // Process orders
      orders.forEach(order => {
        allOrders.push({
          type: 'order',
          id: order.id,
          orderId: order.channel_order_id || order.id,
          total: parseFloat(order.total || 0),
          status: order.status,
          statusCode: order.status_code,
          paymentMethod: order.payment_method,
          customerName: order.customer_name,
          orderDate: order.channel_created_at || order.created_at,
          shipments: order.shipments || []
        });
      });
      
      if (orders.length < perPage) {
        console.log(`      ✅ Last page reached (${orders.length} < ${perPage})`);
        break;
      }
      page++;
      
    } catch (error) {
      console.error(`❌ Error fetching orders page ${page}:`, error.message);
      break;
    }
  }
  
  console.log(`✅ Orders: ${allOrders.length} total records`);
  return allOrders;
}

/**
 * Fetch shipments directly from Shiprocket API
 */
async function fetchShiprocketShipmentsDirect(token, startDate, endDate) {
  console.log(`🚚 Fetching shipments directly from Shiprocket...`);
  console.log(`📅 Date range: ${startDate} to ${endDate}`);
  
  let allShipments = [];
  let page = 1;
  const maxPages = 20;
  const perPage = 250;
  
  while (page <= maxPages) {
    console.log(`   📄 Shipments page ${page}...`);
    
    const params = {
      per_page: perPage,
      page: page
    };
    
    // Add date filters - shipments API uses YYYY-MM-DD format
    if (startDate && endDate) {
      params.start_date = startDate;
      params.end_date = endDate;
      console.log(`      📅 Using YYYY-MM-DD format: ${params.start_date} to ${params.end_date}`);
    } else {
      console.log(`      📅 No date filter - fetching all shipments`);
    }
    
    try {
      const response = await axios.get(`${SHIPROCKET_API_BASE}/shipments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params
      });
      
      const shipments = response.data?.data || [];
      console.log(`      🚚 Found ${shipments.length} shipments on page ${page}`);
      
      if (shipments.length === 0) {
        console.log(`      ⚠️  No shipments found on page ${page}`);
        break;
      }
      
      // Process shipments
      shipments.forEach(shipment => {
        allShipments.push({
          type: 'shipment',
          id: shipment.id,
          orderId: shipment.order_id,
          awb: shipment.awb,
          status: shipment.status,
          shippingCost: parseFloat(shipment.charges?.freight_charges || 0),
          paymentMethod: shipment.payment_method,
          createdAt: shipment.created_at
        });
      });
      
      if (shipments.length < perPage) {
        console.log(`      ✅ Last page reached (${shipments.length} < ${perPage})`);
        break;
      }
      page++;
      
    } catch (error) {
      console.error(`❌ Error fetching shipments page ${page}:`, error.message);
      break;
    }
  }
  
  console.log(`✅ Shipments: ${allShipments.length} total records`);
  return allShipments;
}

/**
 * Merge Shiprocket and Meta data
 */
function mergeShiprocketMetaData(shiprocketData, metaInsights) {
  console.log(`🔗 Merging Shiprocket + Meta data...`);
  
  const { orders, shipments } = shiprocketData;
  
  // Create shipments map for quick lookup
  const shipmentsMap = new Map();
  shipments.forEach(shipment => {
    if (shipment.orderId) {
      shipmentsMap.set(shipment.orderId.toString(), shipment);
    }
  });
  
  // Merge orders with shipments
  const mergedOrders = orders.map(order => {
    const matchingShipment = shipmentsMap.get(order.id.toString());
    
    return {
      ...order,
      shippingCost: matchingShipment?.shippingCost || 80, // Default estimate if not available
      codCharges: matchingShipment?.codCharges || 0,
      totalCharges: matchingShipment?.totalCharges || 80,
      awb: matchingShipment?.awb || '',
      shipmentStatus: matchingShipment?.status || order.status,
      shipmentStatusCode: matchingShipment?.statusCode || order.statusCode,
      deliveredAt: matchingShipment?.deliveredAt,
      isDelivered: isDelivered(order, matchingShipment)
    };
  });
  
  // Calculate Meta totals from insights
  const metaTotals = {
    totalSpend: metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0),
    totalImpressions: metaInsights.reduce((sum, insight) => sum + (insight.impressions || 0), 0),
    totalClicks: metaInsights.reduce((sum, insight) => sum + (insight.linkClicks || 0), 0),
    totalReach: metaInsights.reduce((sum, insight) => sum + (insight.reach || 0), 0),
    totalRevenue: metaInsights.reduce((sum, insight) => sum + (insight.metaRevenue || 0), 0),
    insights: metaInsights
  };
  
  console.log(`✅ Merged: ${mergedOrders.length} orders, Meta spend: ₹${metaTotals.totalSpend.toFixed(2)}`);
  
  return {
    orders: mergedOrders,
    meta: metaTotals
  };
}

/**
 * Fetch orders directly from Shiprocket API
 */
async function fetchShiprocketOrdersDirect(token, startDate, endDate) {
  console.log(`📦 Fetching orders directly from Shiprocket...`);
  console.log(`📅 Date range: ${startDate} to ${endDate}`);
  
  let allOrders = [];
  let page = 1;
  const maxPages = 20;
  const perPage = 250;
  
  while (page <= maxPages) {
    console.log(`   📄 Orders page ${page}...`);
    
    const params = {
      per_page: perPage,
      page: page
    };
    
    // Add date filters - try multiple approaches
    if (startDate && endDate) {
      // Method 1: DD-MM-YYYY format (Shiprocket's preferred format)
      const [startYear, startMonth, startDay] = startDate.split('-');
      const [endYear, endMonth, endDay] = endDate.split('-');
      
      params.created_after = `${startDay}-${startMonth}-${startYear}`;
      params.created_before = `${endDay}-${endMonth}-${endYear}`;
      
      console.log(`      📅 Using DD-MM-YYYY format: ${params.created_after} to ${params.created_before}`);
    } else {
      console.log(`      📅 No date filter - fetching all orders`);
    }
    
    try {
      const response = await axios.get(`${SHIPROCKET_API_BASE}/orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params
      });
      
      const orders = response.data?.data || [];
      console.log(`      📦 Found ${orders.length} orders on page ${page}`);
      
      // Debug: Show API response structure on first page
      if (page === 1) {
        console.log(`🔍 Orders API response:`, {
          status: response.status,
          hasData: !!response.data?.data,
          totalOrders: orders.length,
          sampleOrder: orders[0] ? {
            id: orders[0].id,
            orderId: orders[0].channel_order_id,
            total: orders[0].total,
            status: orders[0].status,
            statusCode: orders[0].status_code,
            date: orders[0].channel_created_at || orders[0].created_at
          } : null
        });
      }
      
      if (orders.length === 0) {
        console.log(`      ⚠️  No orders found on page ${page}`);
        break;
      }
      
      // Process orders
      orders.forEach(order => {
        allOrders.push({
          type: 'order',
          id: order.id,
          orderId: order.channel_order_id || order.id,
          total: parseFloat(order.total || 0),
          status: order.status,
          statusCode: order.status_code,
          paymentMethod: order.payment_method,
          customerName: order.customer_name,
          orderDate: order.channel_created_at || order.created_at,
          shipments: order.shipments || []
        });
      });
      
      if (orders.length < perPage) {
        console.log(`      ✅ Last page reached (${orders.length} < ${perPage})`);
        break;
      }
      page++;
      
    } catch (error) {
      console.error(`❌ Error fetching orders page ${page}:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
      }
      
      // If first page fails, try without date filters
      if (page === 1 && startDate && endDate) {
        console.log(`🔄 Retrying without date filters...`);
        delete params.created_after;
        delete params.created_before;
        
        try {
          const retryResponse = await axios.get(`${SHIPROCKET_API_BASE}/orders`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            params
          });
          
          const retryOrders = retryResponse.data?.data || [];
          console.log(`      🔄 Retry found ${retryOrders.length} orders (no date filter)`);
          
          if (retryOrders.length > 0) {
            // Process retry orders
            retryOrders.forEach(order => {
              allOrders.push({
                type: 'order',
                id: order.id,
                orderId: order.channel_order_id || order.id,
                total: parseFloat(order.total || 0),
                status: order.status,
                statusCode: order.status_code,
                paymentMethod: order.payment_method,
                customerName: order.customer_name,
                orderDate: order.channel_created_at || order.created_at,
                shipments: order.shipments || []
              });
            });
            
            if (retryOrders.length < perPage) break;
            page++;
          }
        } catch (retryError) {
          console.error(`❌ Retry also failed:`, retryError.message);
          break;
        }
      } else {
        break;
      }
    }
  }
  
  console.log(`✅ Orders: ${allOrders.length} total records`);
  
  // Debug: Show status breakdown
  if (allOrders.length > 0) {
    const statusCounts = {};
    allOrders.forEach(order => {
      const status = order.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log(`📊 Orders status breakdown:`, statusCounts);
  }
  
  return allOrders;
}

/**
 * Fetch shipments directly from Shiprocket API
 */
async function fetchShiprocketShipmentsDirect(token, startDate, endDate) {
  console.log(`🚚 Fetching shipments directly from Shiprocket...`);
  console.log(`📅 Date range: ${startDate} to ${endDate}`);
  
  let allShipments = [];
  let page = 1;
  const maxPages = 20;
  const perPage = 250;
  
  while (page <= maxPages) {
    console.log(`   📄 Shipments page ${page}...`);
    
    const params = {
      per_page: perPage,
      page: page
    };
    
    // Add date filters - shipments API uses YYYY-MM-DD format
    if (startDate && endDate) {
      params.start_date = startDate;
      params.end_date = endDate;
      console.log(`      📅 Using YYYY-MM-DD format: ${params.start_date} to ${params.end_date}`);
    } else {
      console.log(`      📅 No date filter - fetching all shipments`);
    }
    
    try {
      const response = await axios.get(`${SHIPROCKET_API_BASE}/shipments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params
      });
      
      const shipments = response.data?.data || [];
      console.log(`      🚚 Found ${shipments.length} shipments on page ${page}`);
      
      // Debug: Show API response structure on first page
      if (page === 1) {
        console.log(`🔍 Shipments API response:`, {
          status: response.status,
          hasData: !!response.data?.data,
          totalShipments: shipments.length,
          sampleShipment: shipments[0] ? {
            id: shipments[0].id,
            orderId: shipments[0].order_id,
            awb: shipments[0].awb,
            status: shipments[0].status,
            charges: shipments[0].charges,
            date: shipments[0].created_at
          } : null
        });
      }
      
      if (shipments.length === 0) {
        console.log(`      ⚠️  No shipments found on page ${page}`);
        
        // If first page and no shipments with date filter, try without date filter
        if (page === 1 && startDate && endDate) {
          console.log(`🔄 Retrying without date filters...`);
          delete params.start_date;
          delete params.end_date;
          
          try {
            const retryResponse = await axios.get(`${SHIPROCKET_API_BASE}/shipments`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              params
            });
            
            const retryShipments = retryResponse.data?.data || [];
            console.log(`      🔄 Retry found ${retryShipments.length} shipments (no date filter)`);
            
            if (retryShipments.length > 0) {
              // Process retry shipments
              retryShipments.forEach(shipment => {
                allShipments.push({
                  type: 'shipment',
                  id: shipment.id,
                  orderId: shipment.order_id,
                  awb: shipment.awb,
                  status: shipment.status,
                  shippingCost: parseFloat(shipment.charges?.freight_charges || 0),
                  paymentMethod: shipment.payment_method,
                  createdAt: shipment.created_at
                });
              });
              
              if (retryShipments.length < perPage) break;
              page++;
            }
          } catch (retryError) {
            console.error(`❌ Retry also failed:`, retryError.message);
            break;
          }
        } else {
          break;
        }
      } else {
        // Process shipments
        shipments.forEach(shipment => {
          allShipments.push({
            type: 'shipment',
            id: shipment.id,
            orderId: shipment.order_id,
            awb: shipment.awb,
            status: shipment.status,
            shippingCost: parseFloat(shipment.charges?.freight_charges || 0),
            paymentMethod: shipment.payment_method,
            createdAt: shipment.created_at
          });
        });
        
        if (shipments.length < perPage) {
          console.log(`      ✅ Last page reached (${shipments.length} < ${perPage})`);
          break;
        }
        page++;
      }
      
    } catch (error) {
      console.error(`❌ Error fetching shipments page ${page}:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
      }
      break;
    }
  }
  
  console.log(`✅ Shipments: ${allShipments.length} total records`);
  
  // Debug: Show status breakdown
  if (allShipments.length > 0) {
    const statusCounts = {};
    allShipments.forEach(shipment => {
      const status = shipment.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log(`📊 Shipments status breakdown:`, statusCounts);
  }
  
  return allShipments;
}

/**
 * Merge orders and shipments data
 */
function mergeAndProcessShiprocketData(orders, shipments) {
  console.log(`🔗 Merging ${orders.length} orders with ${shipments.length} shipments...`);
  
  // Create shipments map for quick lookup
  const shipmentsMap = new Map();
  shipments.forEach(shipment => {
    if (shipment.orderId) {
      shipmentsMap.set(shipment.orderId.toString(), shipment);
    }
  });
  
  // Merge data
  const mergedData = orders.map(order => {
    const matchingShipment = shipmentsMap.get(order.id.toString());
    
    return {
      orderId: order.orderId,
      total: order.total,
      status: order.status,
      statusCode: order.statusCode,
      paymentMethod: order.paymentMethod,
      customerName: order.customerName,
      orderDate: order.orderDate,
      shippingCost: matchingShipment?.shippingCost || 80, // Default estimate
      awb: matchingShipment?.awb || '',
      isDelivered: isDelivered({ statusCode: order.statusCode, status: order.status })
    };
  });
  
  console.log(`✅ Merged: ${mergedData.length} records`);
  return mergedData;
}

/**
 * Check if order is delivered - Updated to match real Shiprocket statuses
 */
function isDelivered(record) {
  const statusCode = record.statusCode;
  const status = (record.status || '').toLowerCase();
  
  // Check for delivered statuses - be more inclusive
  return statusCode === 6 || statusCode === 7 || statusCode === 8 || 
         status === 'delivered' ||
         status === 'delivered successfully' ||
         status.includes('delivered');
}

/**
 * Get Shiprocket token from database
 */
async function getShiprocketToken(userId) {
  try {
    const command = new QueryCommand({
      TableName: 'shipping_connections',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await dynamoDB.send(command);
    const connection = result.Items?.[0];
    
    return connection?.token || null;
  } catch (error) {
    console.error('Error fetching Shiprocket token:', error);
    return null;
  }
}

/**
 * Calculate comprehensive metrics using real data
 */
function calculateComprehensiveMetrics(processedData) {
  const { orders, meta } = processedData;
  
  // Filter delivered orders for revenue calculations
  const deliveredOrders = orders.filter(order => order.isDelivered);
  
  // Revenue calculations from Shiprocket
  const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.total, 0);
  const totalShippingCost = deliveredOrders.reduce((sum, order) => sum + order.shippingCost, 0);
  const totalCodCharges = deliveredOrders.reduce((sum, order) => sum + order.codCharges, 0);
  
  // Meta advertising data (real data from API)
  const adSpend = meta.totalSpend;
  
  // Business expenses - for now we'll estimate as 2.5% of revenue
  // TODO: This could be fetched from a business_expenses table in the future
  const businessExpenses = totalRevenue * 0.025;
  
  // COGS - Cannot calculate without product cost data (show as --)
  // This would need to be stored separately per product
  
  // Profit calculations using your exact formula
  // Net Profit = Revenue - Business Expenses - Ad Spend - Shipping Cost
  const netProfit = totalRevenue - businessExpenses - adSpend - totalShippingCost;
  
  // Gross Profit = Revenue - COGS (cannot calculate without COGS)
  // Gross Profit Margin = (Gross Profit / Revenue) * 100 (cannot calculate without COGS)
  
  // Net Profit Margin
  const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  
  // Marketing metrics
  const roas = adSpend > 0 ? totalRevenue / adSpend : 0;
  const poas = adSpend > 0 ? netProfit / adSpend : 0;
  
  // Order metrics
  const totalOrders = orders.length;
  const deliveredCount = deliveredOrders.length;
  const deliveryRate = totalOrders > 0 ? (deliveredCount / totalOrders) * 100 : 0;
  const avgOrderValue = deliveredCount > 0 ? totalRevenue / deliveredCount : 0;
  
  // Cost per purchase
  const cpp = deliveredCount > 0 ? (adSpend + totalShippingCost) / deliveredCount : 0;
  
  // Status breakdown
  const statusBreakdown = calculateStatusBreakdown(orders);
  
  console.log(`📊 Comprehensive metrics calculated:`);
  console.log(`   Total Orders: ${totalOrders}`);
  console.log(`   Revenue: ₹${totalRevenue}`);
  console.log(`   Ad Spend: ₹${adSpend}`);
  console.log(`   Business Expenses: ₹${businessExpenses}`);
  console.log(`   Shipping Cost: ₹${totalShippingCost}`);
  console.log(`   Net Profit: ₹${netProfit}`);
  console.log(`   ROAS: ${roas.toFixed(2)}`);
  console.log(`   POAS: ${poas.toFixed(2)}`);
  
  return [
    // Available metrics with real data
    { title: 'Revenue', value: `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total revenue from delivered orders' },
    { title: 'Ad Spend', value: `₹${adSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total advertising spend from Meta API' },
    { title: 'Shipping Cost', value: `₹${totalShippingCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total shipping charges from Shiprocket' },
    { title: 'Business Expenses', value: `₹${businessExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Estimated business expenses (2.5% of revenue)' },
    { title: 'Net Profit', value: `₹${netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Revenue - Business Expenses - Ad Spend - Shipping Cost' },
    { title: 'Net Profit Margin', value: `${netProfitMargin.toFixed(2)}%`, formula: 'Net Profit / Revenue * 100' },
    { title: 'ROAS', value: `${roas.toFixed(2)}`, formula: 'Return on Ad Spend (Revenue / Ad Spend)' },
    { title: 'POAS', value: `${poas.toFixed(2)}`, formula: 'Profit on Ad Spend (Net Profit / Ad Spend)' },
    { title: 'AOV', value: `₹${avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Average Order Value (Revenue / Orders)' },
    { title: 'CPP', value: `₹${cpp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Cost Per Purchase (Ad Spend + Shipping) / Orders' },
    
    // COGS-related metrics - not available
    { title: 'COGS', value: '--', formula: 'Not available - requires product cost data' },
    { title: 'Gross Profit', value: '--', formula: 'Cannot calculate without COGS data' },
    { title: 'Gross Profit Margin', value: '--', formula: 'Cannot calculate without COGS data' },
    
    // Order metrics
    { title: 'Delivered Orders', value: deliveredCount.toLocaleString('en-IN'), formula: 'Successfully delivered orders' },
    { title: 'Delivery Rate', value: `${deliveryRate.toFixed(2)}%`, formula: 'Delivered / Total orders' },
    { title: 'Total Shipments', value: totalOrders.toLocaleString('en-IN'), formula: 'All orders in date range' },
    
    // Status breakdown
    ...statusBreakdown.map(status => ({ ...status, category: 'shipping' }))
  ];
}

/**
 * Calculate status breakdown
 */
function calculateStatusBreakdown(orders) {
  const statusCounts = {
    delivered: 0,
    inTransit: 0,
    ndrPending: 0,
    rto: 0,
    cancelled: 0,
    pending: 0,
    other: 0
  };
  
  orders.forEach(order => {
    const status = (order.status || '').toLowerCase();
    const statusCode = order.statusCode;
    
    if (order.isDelivered) {
      statusCounts.delivered++;
    } else if (status.includes('transit') || status.includes('route') || statusCode === 20 || statusCode === 3 || statusCode === 4) {
      statusCounts.inTransit++;
    } else if (status.includes('ndr') || statusCode === 17 || statusCode === 18) {
      statusCounts.ndrPending++;
    } else if (status.includes('rto') || status.includes('return') || statusCode === 9 || statusCode === 10) {
      statusCounts.rto++;
    } else if (status.includes('cancel') || statusCode === 12 || statusCode === 5) {
      statusCounts.cancelled++;
    } else if (status.includes('pending') || status.includes('pickup') || statusCode === 1 || statusCode === 2) {
      statusCounts.pending++;
    } else {
      statusCounts.other++;
    }
  });
  
  return [
    { title: 'Delivered', value: statusCounts.delivered.toLocaleString('en-IN'), rawValue: statusCounts.delivered, formula: 'Successfully delivered orders' },
    { title: 'In Transit', value: statusCounts.inTransit.toLocaleString('en-IN'), rawValue: statusCounts.inTransit, formula: 'Orders in transit' },
    { title: 'NDR Pending', value: statusCounts.ndrPending.toLocaleString('en-IN'), rawValue: statusCounts.ndrPending, formula: 'NDR pending orders' },
    { title: 'RTO', value: statusCounts.rto.toLocaleString('en-IN'), rawValue: statusCounts.rto, formula: 'Return to origin orders' },
    { title: 'Cancelled', value: statusCounts.cancelled.toLocaleString('en-IN'), rawValue: statusCounts.cancelled, formula: 'Cancelled orders' },
    { title: 'Pending', value: statusCounts.pending.toLocaleString('en-IN'), rawValue: statusCounts.pending, formula: 'Pending pickup orders' },
    { title: 'Other', value: statusCounts.other.toLocaleString('en-IN'), rawValue: statusCounts.other, formula: 'Other status orders' }
  ];
}

/**
 * Calculate performance chart data
 */
function calculatePerformanceChart(orders) {
  if (orders.length === 0) return [];
  
  // Group by date
  const dailyData = new Map();
  
  // Process delivered orders
  orders.forEach(order => {
    if (!order.isDelivered) return;
    
    const date = order.orderDate?.split('T')[0] || order.orderDate?.split(' ')[0];
    if (!date) return;
    
    const existing = dailyData.get(date);
    if (existing) {
      existing.revenue += order.total;
      existing.orders += 1;
      existing.shippingCosts += order.shippingCost;
    } else {
      dailyData.set(date, {
        date,
        revenue: order.total,
        orders: 1,
        shippingCosts: order.shippingCost
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
 * Calculate financial breakdown
 */
function calculateFinancialBreakdown(processedData) {
  const { orders, meta } = processedData;
  
  const deliveredOrders = orders.filter(order => order.isDelivered);
  const revenue = deliveredOrders.reduce((sum, order) => sum + order.total, 0);
  const shippingCost = deliveredOrders.reduce((sum, order) => sum + order.shippingCost, 0);
  const adSpend = meta.totalSpend;
  const businessExpenses = revenue * 0.025;
  const netProfit = revenue - businessExpenses - adSpend - shippingCost;
  
  const pieData = [
    { name: 'Shipping Cost', value: shippingCost, color: '#1a4037' },
    { name: 'Ad Spend', value: adSpend, color: '#2d6a4f' },
    { name: 'Business Expenses', value: businessExpenses, color: '#0d2923' },
    { name: 'Net Profit', value: Math.max(0, netProfit), color: '#40916c' }
  ].filter(item => item.value > 0);
  
  return {
    revenue,
    pieData,
    list: pieData
  };
}

/**
 * Create empty metrics structure
 */
function createEmptyMetrics() {
  return [
    { title: 'Revenue', value: '₹0', formula: 'No data available' },
    { title: 'COGS', value: '--', formula: 'Cost of Goods Sold (not calculable)' },
    { title: 'Ad Spend', value: '₹0', formula: 'No data available' },
    { title: 'Shipping Cost', value: '₹0', formula: 'No data available' },
    { title: 'Business Expenses', value: '₹0', formula: 'No data available' },
    { title: 'Net Profit', value: '₹0', formula: 'No data available' },
    { title: 'Gross Profit', value: '--', formula: 'Cannot calculate without COGS' },
    { title: 'Gross Profit Margin', value: '--', formula: 'Cannot calculate without COGS' },
    { title: 'Net Profit Margin', value: '0.00%', formula: 'No data available' },
    { title: 'ROAS', value: '0.00', formula: 'No data available' },
    { title: 'POAS', value: '0.00', formula: 'No data available' },
    { title: 'AOV', value: '₹0', formula: 'No data available' },
    { title: 'CPP', value: '₹0', formula: 'No data available' },
    { title: 'Total Shipments', value: '0', formula: 'No data available' },
    { title: 'Delivered Orders', value: '0', formula: 'No data available' }
  ];
}

module.exports = {
  getShiprocketDashboardData
};