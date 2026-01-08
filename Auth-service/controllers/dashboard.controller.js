/**
 * Dashboard Controller
 * Fetches and aggregates data from all sources for dashboard display
 */

const { QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');
const { getCache, setCache, isRedisConnected } = require('../config/redis.config');

// Fallback in-memory cache (used when Redis is unavailable)
const dashboardCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 200;

/**
 * Get cached dashboard data (Redis or in-memory fallback)
 */
async function getCachedDashboard(cacheKey) {
  // Try Redis first
  if (isRedisConnected()) {
    try {
      const cached = await getCache(cacheKey);
      if (cached) {
        console.log(`⚡ Redis cache HIT: ${cacheKey}`);
        return cached;
      }
    } catch (error) {
      console.error('Redis cache error:', error.message);
    }
  }
  
  // Fallback to in-memory cache
  const cached = dashboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`⚡ Memory cache HIT: ${cacheKey}`);
    dashboardCache.delete(cacheKey);
    dashboardCache.set(cacheKey, cached);
    return cached.data;
  }
  
  if (cached) {
    dashboardCache.delete(cacheKey);
  }
  
  return null;
}

/**
 * Set dashboard data in cache (Redis + in-memory fallback)
 */
async function setCachedDashboard(cacheKey, data) {
  // Try Redis first
  if (isRedisConnected()) {
    try {
      await setCache(cacheKey, data, 300); // 5 minutes TTL
      console.log(`💾 Redis cache SET: ${cacheKey}`);
    } catch (error) {
      console.error('Redis cache set error:', error.message);
    }
  }
  
  // Always set in-memory cache as fallback
  if (dashboardCache.size >= MAX_CACHE_SIZE) {
    const firstKey = dashboardCache.keys().next().value;
    dashboardCache.delete(firstKey);
  }
  
  dashboardCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Clear expired in-memory cache entries
 */
function clearExpiredCache() {
  const now = Date.now();
  for (const [key, value] of dashboardCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      dashboardCache.delete(key);
    }
  }
}

// Clear expired cache every 10 minutes
setInterval(clearExpiredCache, 10 * 60 * 1000);

/**
 * Get Dashboard Data
 * @route GET /api/data/dashboard
 * @access Protected
 */
async function getDashboardData(req, res) {
  const startTime = Date.now();
  
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;
    
    // Create cache key
    const cacheKey = `dashboard:${userId}:${startDate}:${endDate}`;
    
    // Check cache first
    const cachedData = await getCachedDashboard(cacheKey);
    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ Returning cached dashboard data (${duration}ms)`);
      return res.json(cachedData);
    }

    console.log(`\n📊 Fetching fresh dashboard data for user: ${userId}`);
    console.log(`   Date range: ${startDate} to ${endDate}`);

    // Check Shopify sync status first
    const shopifyBackgroundSync = require('../services/shopify-background-sync.service');
    const syncStatus = await shopifyBackgroundSync.getSyncStatus(userId);
    
    // If sync is actively in progress, return sync status
    if (syncStatus && syncStatus.status === 'in_progress') {
      console.log(`🔄 Sync in progress for user: ${userId}`);
      return res.json({
        syncInProgress: true,
        syncStatus: syncStatus,
        message: 'We are syncing your Shopify data. Please wait...'
      });
    }
    
    // Check if we have any orders for this user
    const existingOrders = await getShopifyOrders(userId, '2020-01-01', '2030-12-31'); // Wide date range
    
    if (existingOrders.length === 0) {
      // No orders found - user needs to sync
      console.log(`⚠️  No orders found for user: ${userId} - needs manual sync`);
      
      // Check if Shopify is connected
      const shopifyConnection = await getShopifyConnection(userId);
      
      if (!shopifyConnection || !shopifyConnection.accessToken) {
        // No Shopify connection - show empty dashboard
        console.log(`⚠️  No Shopify connection for user: ${userId}`);
        return res.json({
          noConnection: true,
          message: 'Please connect your Shopify store first'
        });
      }
      
      // Shopify connected but no orders - show "Sync Now" message
      return res.json({
        needsSync: true,
        message: 'No orders found. Click "Sync Shopify Orders" to fetch your data.',
        syncStatus: syncStatus || { status: 'idle', message: 'Ready to sync' }
      });
    }
    
    console.log(`✅ Found ${existingOrders.length} orders for user: ${userId}`);

    // Fetch data from all tables in parallel
    let [
      shopifyProducts,
      shopifyOrders,
      shopifyCustomers,
      shopifyConnection,
      metaConnection,
      metaInsights,
      shippingConnection,
      shiprocketShipments,
      onboardingData,
      businessExpenses
    ] = await Promise.all([
      getShopifyProducts(userId),
      getShopifyOrders(userId, startDate, endDate),
      getShopifyCustomers(userId),
      getShopifyConnection(userId),
      getMetaConnection(userId),
      getMetaInsights(userId, startDate, endDate),
      getShippingConnection(userId),
      getShiprocketShipments(userId, startDate, endDate),
      getOnboardingData(userId),
      getBusinessExpenses(userId)
    ]);

    // Skip auto-sync since we're fetching directly from Shiprocket API
    console.log(`🔍 Shiprocket Debug:`);
    console.log(`   Connection exists: ${!!shippingConnection}`);
    console.log(`   Has token: ${!!(shippingConnection && shippingConnection.token)}`);
    console.log(`   Using direct API calls (no database dependency)`);
    console.log(`   Platform: ${shippingConnection?.platform}`);

    // Calculate all metrics in parallel for better performance
    const [
      summary,
      performanceChartData,
      financialsBreakdownData,
      marketing,
      marketingChart,
      customerTypeByDay,
      website,
      products,
      shipping,
      orderTypeData
    ] = await Promise.all([
      Promise.resolve(calculateSummary(shopifyOrders, shopifyProducts, metaInsights, shiprocketShipments, onboardingData, businessExpenses)),
      Promise.resolve(calculatePerformanceData(shopifyOrders, startDate, endDate, businessExpenses)),
      Promise.resolve(calculateFinancialBreakdown(shopifyOrders, shopifyProducts, metaInsights, shiprocketShipments, onboardingData, businessExpenses)),
      Promise.resolve(calculateMarketingMetrics(metaInsights, shopifyOrders)),
      Promise.resolve(calculateMarketingChart(metaInsights, startDate, endDate)),
      Promise.resolve(calculateCustomerTypeData(shopifyOrders, startDate, endDate)),
      Promise.resolve(calculateWebsiteMetrics(shopifyOrders, shopifyCustomers, metaInsights, shiprocketShipments, onboardingData, businessExpenses)),
      Promise.resolve(calculateProductRankings(shopifyOrders, shopifyProducts)),
      Promise.resolve(calculateShippingMetrics(shiprocketShipments, shopifyOrders)),
      Promise.resolve(calculateOrderTypeData(shopifyOrders))
    ]);

    const dashboardData = {
      summary,
      performanceChartData,
      financialsBreakdownData,
      marketing,
      charts: {
        marketing: marketingChart,
        customerTypeByDay
      },
      website,
      products,
      shipping,
      orderTypeData,
      connections: {
        shopify: !!shopifyConnection,
        meta: !!metaConnection,
        shipping: !!shippingConnection
      },
      syncStatus: {
        shopifyInitialSyncCompleted: shopifyConnection?.initialSyncCompleted || false,
        lastSyncAt: shopifyConnection?.syncCompletedAt || null
      },
      onboarding: onboardingData,
      shopifyOrders // Add raw orders for OrderConfirmation page
    };

    // Cache the data (reuse cacheKey from above) - await since it's async
    await setCachedDashboard(cacheKey, dashboardData);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Dashboard data compiled successfully in ${duration}ms\n`);
    
    if (duration > 2000) {
      console.warn(`⚠️  Slow response: ${duration}ms - Consider optimization`);
    }

    res.json(dashboardData);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Dashboard data error after ${duration}ms:`, error);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: error.message
    });
  }
}

// Helper functions to fetch data from DynamoDB

async function getShopifyProducts(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.SHOPIFY_PRODUCTS_TABLE || 'shopify_products',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      // Optimize: Only fetch required attributes
      ProjectionExpression: 'userId, productId, manufacturingCost, title'
    });
    const result = await dynamoDB.send(command);
    return result.Items || [];
  } catch (error) {
    console.error('Error fetching Shopify products:', error.message);
    return [];
  }
}

async function getShopifyOrders(userId, startDate, endDate) {
  try {
    // Fetch all orders with pagination (DynamoDB has 1MB limit per query)
    let allOrders = [];
    let lastEvaluatedKey = null;
    
    do {
      const command = new QueryCommand({
        TableName: process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
      });
      
      const result = await dynamoDB.send(command);
      allOrders = allOrders.concat(result.Items || []);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    // Filter by date range in JavaScript
    const filteredOrders = allOrders.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = order.createdAt.split('T')[0];
      return orderDate >= startDate && orderDate <= endDate;
    });
    
    console.log(`📦 Shopify Orders: ${filteredOrders.length} (from ${allOrders.length} total) for ${startDate} to ${endDate}`);
    return filteredOrders;
  } catch (error) {
    console.error('Error fetching Shopify orders:', error.message);
    return [];
  }
}

async function getShopifyCustomers(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.SHOPIFY_CUSTOMERS_TABLE || 'shopify_customers',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    const result = await dynamoDB.send(command);
    return result.Items || [];
  } catch (error) {
    console.error('Error fetching Shopify customers:', error.message);
    return [];
  }
}

async function getShopifyConnection(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.SHOPIFY_CONNECTIONS_TABLE || 'shopify_connections',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    const result = await dynamoDB.send(command);
    return result.Items?.[0] || null;
  } catch (error) {
    console.error('Error fetching Shopify connection:', error.message);
    return null;
  }
}

async function getMetaConnection(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.META_CONNECTIONS_TABLE || 'meta_connections',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    const result = await dynamoDB.send(command);
    return result.Items?.[0] || null;
  } catch (error) {
    console.error('Error fetching Meta connection:', error.message);
    return null;
  }
}

async function getMetaInsights(userId, startDate, endDate) {
  try {
    // Get ALL Meta insights for the user (don't filter by specific ad account)
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
    
    if (insights.length === 0) {
      console.log(`⚠️  No Meta insights found for user ${userId}`);
      
      // Debug: Check if there are ANY insights for this user (without date filter)
      const debugCommand = new ScanCommand({
        TableName: process.env.META_INSIGHTS_TABLE || 'meta_insights',
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ProjectionExpression: 'userId, #date, adSpend, adAccountId',
        ExpressionAttributeNames: {
          '#date': 'date'
        }
      });
      
      const debugResult = await dynamoDB.send(debugCommand);
      const allInsights = debugResult.Items || [];
      
      if (allInsights.length > 0) {
        console.log(`🔍 Found ${allInsights.length} total insights for user (all dates):`);
        allInsights.forEach(insight => {
          console.log(`   ${insight.date} (${insight.adAccountId}): ₹${insight.adSpend || 0}`);
        });
      } else {
        console.log(`🔍 No Meta insights found for user ${userId} at all`);
      }
      
      return [];
    }
    
    // Group by ad account to see what accounts have data
    const accountGroups = {};
    insights.forEach(insight => {
      const accountId = insight.adAccountId || 'unknown';
      if (!accountGroups[accountId]) {
        accountGroups[accountId] = [];
      }
      accountGroups[accountId].push(insight);
    });
    
    console.log(`📊 Meta insights by ad account:`);
    Object.keys(accountGroups).forEach(accountId => {
      const accountInsights = accountGroups[accountId];
      const totalSpend = accountInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
      console.log(`   Account ${accountId}: ${accountInsights.length} insights, ₹${totalSpend} total spend`);
    });
    
    // Sort by date
    const sortedInsights = insights.sort((a, b) => a.date.localeCompare(b.date));
    
    // Debug: Log ad spend details
    console.log(`📊 Meta Ad Spend (All accounts):`);
    sortedInsights.forEach(insight => {
      console.log(`   ${insight.date} (${insight.adAccountId}): ₹${insight.adSpend || 0}`);
    });
    const totalAdSpend = sortedInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
    console.log(`   Total Ad Spend: ₹${totalAdSpend}`);
    
    return sortedInsights;
  } catch (error) {
    console.error('Error fetching Meta insights:', error.message);
    return [];
  }
}

async function getShippingConnection(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.SHIPPING_CONNECTIONS_TABLE || 'shipping_connections',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    const result = await dynamoDB.send(command);
    return result.Items?.[0] || null;
  } catch (error) {
    console.error('Error fetching shipping connection:', error.message);
    return null;
  }
}

async function getShiprocketShipments(userId, startDate, endDate) {
  try {
    console.log(`\n📦 === FETCHING SHIPROCKET DATA FROM API ===`);
    console.log(`📅 Date Range: ${startDate} to ${endDate}`);
    console.log(`👤 User ID: ${userId}`);
    
    // Get shipping connection
    const shippingConnection = await getShippingConnection(userId);
    
    if (!shippingConnection || !shippingConnection.token) {
      console.log(`❌ No Shiprocket token found for user ${userId}`);
      return [];
    }
    
    console.log(`✅ Found Shiprocket token, fetching orders directly from Shiprocket API...`);
    
    // Use the Shiprocket service to fetch orders directly from API
    const shiprocketService = require('../services/shiprocket.service');
    const result = await shiprocketService.fetchOrdersDirectly(shippingConnection.token, {
      startDate,
      endDate,
      maxPages: 20, // Increased to get more data
      perPage: 250   // Increased page size
    });
    
    if (!result.success) {
      console.log(`❌ Failed to fetch orders from Shiprocket API: ${result.error}`);
      return [];
    }
    
    const shipments = result.shipments || [];
    console.log(`📦 Got ${shipments.length} shipments from Shiprocket API`);
    
    // Show date range of fetched orders
    if (shipments.length > 0) {
      const orderDates = shipments
        .map(s => s.parsedOrderDate || s.orderDate || s.createdAt)
        .filter(date => date)
        .sort();
      
      if (orderDates.length > 0) {
        console.log(`� Ordaer date range in results: ${orderDates[0]} to ${orderDates[orderDates.length - 1]}`);
      }
      
      // Show revenue analysis
      let totalRevenue = 0;
      let shipmentsWithRevenue = 0;
      const statusCounts = {};
      
      shipments.forEach(shipment => {
        // Count statuses
        const status = shipment.status || 'NO_STATUS';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        
        // Check revenue
        const revenue = parseFloat(
          shipment.total || 
          shipment.orderValue || 
          shipment.codCharges || 
          shipment.totalAmount || 
          shipment.amount || 
          0
        );
        
        if (revenue > 0) {
          totalRevenue += revenue;
          shipmentsWithRevenue++;
        }
      });
      
      console.log(`📊 Shiprocket API Data Analysis:`);
      console.log(`   Status breakdown:`, statusCounts);
      console.log(`   Revenue: ${shipmentsWithRevenue}/${shipments.length} shipments have revenue, Total: ₹${totalRevenue}`);
      
      // Show first few shipments for debugging
      console.log(`📋 First 3 shipments from API:`);
      shipments.slice(0, 3).forEach((shipment, index) => {
        const revenue = parseFloat(
          shipment.total || 
          shipment.orderValue || 
          shipment.codCharges || 
          shipment.totalAmount || 
          shipment.amount || 
          0
        );
        console.log(`   ${index + 1}. ID: ${shipment.shipmentId}, Status: ${shipment.status}, Revenue: ₹${revenue}, Order: ${shipment.orderId}, Date: ${shipment.parsedOrderDate}`);
      });
      
      // Show available fields
      console.log(`📋 Available fields in API response:`, Object.keys(shipments[0]));
    }
    
    console.log(`📦 === SHIPROCKET API FETCH COMPLETE ===\n`);
    
    return shipments;
  } catch (error) {
    console.error('❌ Shiprocket API fetch error:', error.message);
    console.error('Stack trace:', error.stack);
    return [];
  }
}

async function getOnboardingData(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.ONBOARDING_TABLE_NAME || 'Onboarding',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    const result = await dynamoDB.send(command);
    return result.Items?.[0] || null;
  } catch (error) {
    console.error('Error fetching onboarding data:', error.message);
    return null;
  }
}

async function getBusinessExpenses(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'Users',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ProjectionExpression: 'businessExpenses'
    });
    const result = await dynamoDB.send(command);
    const user = result.Items?.[0];
    
    return user?.businessExpenses || {
      agencyFees: 0,
      rtoHandlingFees: 0,
      paymentGatewayFeePercent: 2.5,
      staffFees: 0,
      officeRent: 0,
      otherExpenses: 0
    };
  } catch (error) {
    console.error('Error fetching business expenses:', error.message);
    return {
      agencyFees: 0,
      rtoHandlingFees: 0,
      paymentGatewayFeePercent: 2.5,
      staffFees: 0,
      officeRent: 0,
      otherExpenses: 0
    };
  }
}

// Shiprocket-specific calculation functions

function calculateShiprocketSummary(orders, products, metaInsights, shiprocketShipments, onboardingData, businessExpenses) {
  console.log(`📦 Shiprocket Summary - Using ONLY Shiprocket API data...`);
  
  // Filter for delivered Shiprocket orders only - NO SHOPIFY DATA
  const deliveredShipments = shiprocketShipments.filter(shipment => {
    const status = (shipment.status || '').toLowerCase();
    const statusCode = shipment.statusCode;
    
    // Check ONLY Shiprocket delivery statuses
    const isShiprocketDelivered = status === 'delivered' || 
           status === 'delivered successfully' ||
           status === 'delivery completed' ||
           status === 'delivered to buyer' ||
           status === 'shipment delivered' ||
           status === 'delivered to customer' ||
           status.includes('delivered') ||
           statusCode === 6 || statusCode === '6' ||
           statusCode === 7 || statusCode === '7' ||
           statusCode === 8 || statusCode === '8';
    
    return isShiprocketDelivered;
  });

  console.log(`📦 Shiprocket Summary: ${deliveredShipments.length} delivered out of ${shiprocketShipments.length} total shipments`);
  
  // Debug: Show all statuses in the shipments
  if (shiprocketShipments.length > 0) {
    const statusCounts = {};
    shiprocketShipments.forEach(shipment => {
      const status = shipment.status || 'NO_STATUS';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log(`📊 All shipment statuses:`, statusCounts);
    
    // Show what we consider "delivered"
    const deliveredStatuses = deliveredShipments.map(s => s.status).filter((v, i, a) => a.indexOf(v) === i);
    console.log(`✅ Delivered statuses found:`, deliveredStatuses);
  }
  
  // If no delivered shipments, let's be more liberal with status matching
  if (deliveredShipments.length === 0 && shiprocketShipments.length > 0) {
    console.log(`⚠️  No delivered shipments found with strict matching, trying liberal matching...`);
    
    // Try more liberal status matching
    const liberalDelivered = shiprocketShipments.filter(shipment => {
      const status = (shipment.status || '').toLowerCase();
      const statusCode = shipment.statusCode;
      
      // More liberal matching - exclude only clearly failed statuses
      const isNotFailed = !status.includes('rto') &&
                         !status.includes('return') &&
                         !status.includes('cancel') &&
                         !status.includes('failed') &&
                         !status.includes('exception') &&
                         !status.includes('lost') &&
                         statusCode !== 9 && // RTO
                         statusCode !== 10 && // Cancelled
                         statusCode !== 11; // Lost
      
      return isNotFailed && status !== 'no_status' && status !== '';
    });
    
    if (liberalDelivered.length > 0) {
      console.log(`📦 Liberal matching found ${liberalDelivered.length} non-failed shipments`);
      deliveredShipments.length = 0; // Clear array
      deliveredShipments.push(...liberalDelivered); // Add liberal matches
      deliveredOrderCount = deliveredShipments.length;
    } else {
      // If still no matches, use ALL shipments for revenue calculation
      console.log(`⚠️  No shipments match any delivery criteria, using ALL shipments for revenue calculation`);
      deliveredShipments.length = 0;
      deliveredShipments.push(...shiprocketShipments);
      deliveredOrderCount = shiprocketShipments.length;
    }
  }

  // Calculate revenue and COGS from delivered shipments
  let shiprocketRevenue = 0;
  let shiprocketCogs = 0;
  let deliveredOrderCount = deliveredShipments.length;
  let revenueSourceCounts = {
    total: 0,
    orderValue: 0,
    order_value: 0,
    codCharges: 0,
    cod_charges: 0,
    totalAmount: 0,
    total_amount: 0,
    amount: 0,
    price: 0,
    estimated: 0
  };

  // Create a map of Shopify orders for COGS calculation only
  const shopifyOrderMap = new Map();
  orders.forEach(order => {
    if (order.orderId) {
      shopifyOrderMap.set(order.orderId.toString(), order);
    }
    if (order.orderNumber) {
      shopifyOrderMap.set(order.orderNumber.toString(), order);
    }
  });

  console.log(`💰 Starting revenue calculation for ${deliveredShipments.length} shipments...`);

  deliveredShipments.forEach((shipment, index) => {
    // Get revenue from Shiprocket API data - try multiple field names
    let shipmentRevenue = 0;
    let revenueSource = 'none';
    
    // Try Shiprocket API revenue fields (these are the most common from API)
    if (shipment.total && shipment.total > 0) {
      shipmentRevenue = parseFloat(shipment.total);
      revenueSource = 'total';
      revenueSourceCounts.total++;
    } else if (shipment.orderValue && shipment.orderValue > 0) {
      shipmentRevenue = parseFloat(shipment.orderValue);
      revenueSource = 'orderValue';
      revenueSourceCounts.orderValue++;
    } else if (shipment.codCharges && shipment.codCharges > 0) {
      shipmentRevenue = parseFloat(shipment.codCharges);
      revenueSource = 'codCharges';
      revenueSourceCounts.codCharges++;
    } else if (shipment.totalAmount && shipment.totalAmount > 0) {
      shipmentRevenue = parseFloat(shipment.totalAmount);
      revenueSource = 'totalAmount';
      revenueSourceCounts.totalAmount++;
    } else if (shipment.amount && shipment.amount > 0) {
      shipmentRevenue = parseFloat(shipment.amount);
      revenueSource = 'amount';
      revenueSourceCounts.amount++;
    } else if (shipment.price && shipment.price > 0) {
      shipmentRevenue = parseFloat(shipment.price);
      revenueSource = 'price';
      revenueSourceCounts.price++;
    } else if (shipment.order_value && shipment.order_value > 0) {
      shipmentRevenue = parseFloat(shipment.order_value);
      revenueSource = 'order_value';
      revenueSourceCounts.order_value++;
    } else if (shipment.cod_charges && shipment.cod_charges > 0) {
      shipmentRevenue = parseFloat(shipment.cod_charges);
      revenueSource = 'cod_charges';
      revenueSourceCounts.cod_charges++;
    } else if (shipment.total_amount && shipment.total_amount > 0) {
      shipmentRevenue = parseFloat(shipment.total_amount);
      revenueSource = 'total_amount';
      revenueSourceCounts.total_amount++;
    } else {
      // No revenue data available - skip this shipment (no estimates)
      shipmentRevenue = 0;
      revenueSource = 'no_data';
      
      if (index < 5) { // Log first few cases with no revenue
        console.log(`⚠️  No revenue field found for shipment ${shipment.shipmentId || shipment.id}`);
      }
    }
    
    shiprocketRevenue += shipmentRevenue;
    
    // Log first few shipments for debugging
    if (index < 5) {
      console.log(`   📦 Shipment ${index + 1}: ID=${shipment.shipmentId || shipment.id}, Revenue=₹${shipmentRevenue} (${revenueSource}), Status=${shipment.status}`);
    }
  });

  // COGS - Not available from Shiprocket (requires product cost data)
  shiprocketCogs = 0; // No estimates

  console.log(`💰 Revenue calculation complete (SHIPROCKET ONLY):`);
  console.log(`   Total Revenue: ₹${shiprocketRevenue}`);
  console.log(`   Revenue Sources:`, revenueSourceCounts);
  console.log(`   Average per shipment: ₹${deliveredOrderCount > 0 ? (shiprocketRevenue / deliveredOrderCount).toFixed(0) : 0}`);
  console.log(`   Total COGS: ₹${shiprocketCogs} (actual data only)`);
  
  // If still no revenue, there might be a data structure issue
  if (shiprocketRevenue === 0 && deliveredShipments.length > 0) {
    console.log(`❌ CRITICAL: No revenue calculated despite having ${deliveredShipments.length} shipments!`);
    console.log(`📋 Sample shipment for debugging:`, JSON.stringify(deliveredShipments[0], null, 2));
  }

  // Ad Spend
  const adSpend = metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);

  // Shipping Cost from delivered orders only - try multiple field names
  let shippingCost = deliveredShipments.reduce((sum, shipment) => {
    let cost = 0;
    
    // Try different shipping cost field names
    if (shipment.totalCharges && shipment.totalCharges > 0) {
      cost = parseFloat(shipment.totalCharges);
    } else if (shipment.total_charges && shipment.total_charges > 0) {
      cost = parseFloat(shipment.total_charges);
    } else if (shipment.shippingCharges && shipment.shippingCharges > 0) {
      cost = parseFloat(shipment.shippingCharges);
    } else if (shipment.shipping_charges && shipment.shipping_charges > 0) {
      cost = parseFloat(shipment.shipping_charges);
    } else if (shipment.charges && shipment.charges > 0) {
      cost = parseFloat(shipment.charges);
    }
    
    return sum + cost;
  }, 0);
  
  // No estimates - use actual shipping cost only
  if (shippingCost === 0) {
    console.log(`⚠️  No shipping cost data found from Shiprocket API`);
  }

  // Business Expenses (based on Shiprocket revenue)
  const daysInPeriod = Math.ceil((new Date() - new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) / (1000 * 60 * 60 * 24));
  const monthlyMultiplier = daysInPeriod / 30;
  
  const agencyFees = (businessExpenses.agencyFees || 0) * monthlyMultiplier;
  const rtoHandlingFees = (businessExpenses.rtoHandlingFees || 0) * monthlyMultiplier;
  const staffFees = (businessExpenses.staffFees || 0) * monthlyMultiplier;
  const officeRent = (businessExpenses.officeRent || 0) * monthlyMultiplier;
  const otherBusinessExpenses = (businessExpenses.otherExpenses || 0) * monthlyMultiplier;
  const paymentGatewayFees = shiprocketRevenue * ((businessExpenses.paymentGatewayFeePercent || 2.5) / 100);
  
  const totalBusinessExpenses = agencyFees + rtoHandlingFees + staffFees + officeRent + otherBusinessExpenses + paymentGatewayFees;

  // Profit calculations
  const grossProfit = shiprocketRevenue - shiprocketCogs;
  const netProfit = shiprocketRevenue - (shiprocketCogs + adSpend + shippingCost + totalBusinessExpenses);
  
  // Metrics
  const grossProfitMargin = shiprocketRevenue > 0 ? (grossProfit / shiprocketRevenue) * 100 : 0;
  const netProfitMargin = shiprocketRevenue > 0 ? (netProfit / shiprocketRevenue) * 100 : 0;
  const aov = deliveredOrderCount > 0 ? shiprocketRevenue / deliveredOrderCount : 0;
  const roas = adSpend > 0 ? shiprocketRevenue / adSpend : 0;
  const deliveryRate = shiprocketShipments.length > 0 ? (deliveredOrderCount / shiprocketShipments.length) * 100 : 0;
  const cpp = deliveredOrderCount > 0 ? adSpend / deliveredOrderCount : 0;
  const poas = adSpend > 0 ? netProfit / adSpend : 0;

  console.log(`📦 Shiprocket Summary Calculations:`, {
    shiprocketRevenue,
    deliveredOrderCount,
    grossProfit,
    netProfit,
    deliveryRate: `${deliveryRate.toFixed(2)}%`
  });

  return [
    // Core Shiprocket Metrics
    { title: 'Delivered Orders', value: deliveredOrderCount.toLocaleString('en-IN'), formula: 'Successfully delivered Shiprocket orders' },
    { title: 'Total Revenue', value: `₹${shiprocketRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Revenue from delivered orders only' },
    { title: 'Delivery Rate', value: `${deliveryRate.toFixed(2)}%`, formula: '(Delivered Orders / Total Shipments) × 100' },
    { title: 'Average Order Value', value: `₹${aov.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Revenue ÷ Delivered Orders' },
    
    // Cost Breakdown
    { title: 'COGS', value: `₹${shiprocketCogs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Cost of Goods Sold for delivered orders' },
    { title: 'Shipping Cost', value: `₹${shippingCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total logistics expense' },
    { title: 'Ad Spend', value: `₹${adSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total marketing spend' },
    { title: 'Business Expenses', value: `₹${totalBusinessExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Agency + Gateway + Staff + Rent + Other' },
    
    // Profit Metrics
    { title: 'Gross Profit', value: `₹${grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Revenue - COGS' },
    { title: 'Net Profit', value: `₹${netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Revenue - (COGS + Ad Spend + Shipping + Business Expenses)' },
    { title: 'Gross Profit Margin', value: `${grossProfitMargin.toFixed(2)}%`, formula: '(Gross Profit / Revenue) × 100' },
    { title: 'Net Profit Margin', value: `${netProfitMargin.toFixed(2)}%`, formula: '(Net Profit / Revenue) × 100' },
    
    // Marketing Metrics
    { title: 'ROAS', value: roas.toFixed(2), formula: 'Revenue ÷ Ad Spend' },
    { title: 'POAS', value: poas.toFixed(2), formula: 'Net Profit ÷ Ad Spend' },
    { title: 'Cost per Purchase', value: `₹${cpp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Ad Spend ÷ Delivered Orders' },
    
    // Shipping Performance
    { title: 'Total Shipments', value: shiprocketShipments.length.toLocaleString('en-IN'), formula: 'All Shiprocket shipments in date range' },
    { title: 'Pending Deliveries', value: (shiprocketShipments.length - deliveredOrderCount).toLocaleString('en-IN'), formula: 'Total Shipments - Delivered Orders' }
  ];
}

function calculateShiprocketPerformanceData(shiprocketShipments, startDate, endDate) {
  if (!shiprocketShipments || shiprocketShipments.length === 0) {
    return [];
  }

  // Group delivered shipments by date
  const deliveredByDate = new Map();
  
  const deliveredShipments = shiprocketShipments.filter(shipment => {
    const status = (shipment.status || '').toLowerCase();
    const statusCode = shipment.statusCode;
    
    return status === 'delivered' || 
           status === 'delivered successfully' ||
           status.includes('delivered') ||
           statusCode === 6 || statusCode === '6' ||
           statusCode === 7 || statusCode === '7' ||
           statusCode === 8 || statusCode === '8';
  });

  deliveredShipments.forEach(shipment => {
    const date = shipment.parsedOrderDate || shipment.orderDate?.split('T')[0] || shipment.createdAt?.split('T')[0] || shipment.created_at?.split('T')[0];
    if (!date) return;
    
    // Try different revenue field names
    let revenue = 0;
    if (shipment.total && shipment.total > 0) {
      revenue = parseFloat(shipment.total);
    } else if (shipment.orderValue && shipment.orderValue > 0) {
      revenue = parseFloat(shipment.orderValue);
    } else if (shipment.order_value && shipment.order_value > 0) {
      revenue = parseFloat(shipment.order_value);
    } else if (shipment.codCharges && shipment.codCharges > 0) {
      revenue = parseFloat(shipment.codCharges);
    } else if (shipment.cod_charges && shipment.cod_charges > 0) {
      revenue = parseFloat(shipment.cod_charges);
    } else if (shipment.totalAmount && shipment.totalAmount > 0) {
      revenue = parseFloat(shipment.totalAmount);
    } else if (shipment.total_amount && shipment.total_amount > 0) {
      revenue = parseFloat(shipment.total_amount);
    } else {
      revenue = 0; // No estimate - actual data only
    }
    
    // Try different shipping cost field names
    let shippingCost = 0;
    if (shipment.totalCharges && shipment.totalCharges > 0) {
      shippingCost = parseFloat(shipment.totalCharges);
    } else if (shipment.total_charges && shipment.total_charges > 0) {
      shippingCost = parseFloat(shipment.total_charges);
    } else if (shipment.shippingCharges && shipment.shippingCharges > 0) {
      shippingCost = parseFloat(shipment.shippingCharges);
    } else if (shipment.shipping_charges && shipment.shipping_charges > 0) {
      shippingCost = parseFloat(shipment.shipping_charges);
    } else {
      shippingCost = 0; // No estimate - actual data only
    }
    
    const existing = deliveredByDate.get(date);
    if (existing) {
      existing.revenue += revenue;
      existing.totalCosts += shippingCost;
      existing.orders += 1;
    } else {
      deliveredByDate.set(date, {
        date,
        revenue,
        totalCosts: shippingCost,
        orders: 1,
        netProfit: revenue - shippingCost,
        netProfitMargin: revenue > 0 ? ((revenue - shippingCost) / revenue) * 100 : 0
      });
    }
  });

  // If no delivered shipments, create sample data from all shipments
  if (deliveredByDate.size === 0 && shiprocketShipments.length > 0) {
    console.log(`⚠️  No delivered shipments found, showing all shipments data (actual values only)`);
    
    // Group all shipments by date for visualization
    const allShipmentsByDate = new Map();
    
    shiprocketShipments.forEach(shipment => {
      const date = shipment.parsedOrderDate || shipment.createdAt?.split('T')[0];
      if (!date) return;
      
      // Use actual revenue only (no estimates)
      const revenue = parseFloat(shipment.total || shipment.orderValue || shipment.codCharges || 0);
      const shippingCost = parseFloat(shipment.totalCharges || shipment.shippingCharges || 0);
      
      const existing = allShipmentsByDate.get(date);
      if (existing) {
        existing.revenue += revenue;
        existing.totalCosts += shippingCost;
        existing.orders += 1;
      } else {
        allShipmentsByDate.set(date, {
          date,
          revenue,
          totalCosts: shippingCost,
          orders: 1,
          netProfit: revenue - shippingCost,
          netProfitMargin: revenue > 0 ? ((revenue - shippingCost) / revenue) * 100 : 0
        });
      }
    });
    
    // Convert to array and sort
    const data = Array.from(allShipmentsByDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: Math.round(item.revenue),
        totalCosts: Math.round(item.totalCosts),
        netProfit: Math.round(item.netProfit),
        netProfitMargin: Math.round(item.netProfitMargin),
        orders: item.orders
      }));

    console.log(`📦 Shiprocket Performance data: ${data.length} data points from all shipments`);
    return data;
  }

  // Convert to array and sort
  const data = Array.from(deliveredByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({
      name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: Math.round(item.revenue),
      totalCosts: Math.round(item.totalCosts),
      netProfit: Math.round(item.netProfit),
      netProfitMargin: Math.round(item.netProfitMargin),
      orders: item.orders
    }));

  console.log(`📦 Shiprocket Performance data: ${data.length} data points from delivered orders`);
  return data;
}

function calculateShiprocketFinancialBreakdown(orders, products, metaInsights, shiprocketShipments, onboardingData, businessExpenses) {
  // Create product lookup map
  const productMap = new Map();
  
  if (onboardingData?.step3?.productCosts) {
    onboardingData.step3.productCosts.forEach(p => {
      if (p.productId) {
        productMap.set(p.productId.toString(), parseFloat(p.cost) || 0);
      }
    });
  }
  
  products.forEach(p => {
    if (p.productId && !productMap.has(p.productId.toString())) {
      productMap.set(p.productId.toString(), p.manufacturingCost || 0);
    }
  });

  // Filter for delivered orders only
  const deliveredShipments = shiprocketShipments.filter(shipment => {
    const status = (shipment.status || '').toLowerCase();
    const statusCode = shipment.statusCode;
    
    return status === 'delivered' || 
           status === 'delivered successfully' ||
           status.includes('delivered') ||
           statusCode === 6 || statusCode === '6' ||
           statusCode === 7 || statusCode === '7' ||
           statusCode === 8 || statusCode === '8';
  });

  // Calculate revenue and costs from delivered shipments only - SHIPROCKET DATA ONLY
  let shiprocketRevenue = 0;
  let shiprocketCogs = 0;

  console.log(`📦 Financial Breakdown - Using ONLY Shiprocket data for ${deliveredShipments.length} delivered shipments...`);

  deliveredShipments.forEach(shipment => {
    // Try different revenue field names
    let shipmentRevenue = 0;
    if (shipment.total && shipment.total > 0) {
      shipmentRevenue = parseFloat(shipment.total);
    } else if (shipment.orderValue && shipment.orderValue > 0) {
      shipmentRevenue = parseFloat(shipment.orderValue);
    } else if (shipment.order_value && shipment.order_value > 0) {
      shipmentRevenue = parseFloat(shipment.order_value);
    } else if (shipment.codCharges && shipment.codCharges > 0) {
      shipmentRevenue = parseFloat(shipment.codCharges);
    } else if (shipment.cod_charges && shipment.cod_charges > 0) {
      shipmentRevenue = parseFloat(shipment.cod_charges);
    } else if (shipment.totalAmount && shipment.totalAmount > 0) {
      shipmentRevenue = parseFloat(shipment.totalAmount);
    } else if (shipment.total_amount && shipment.total_amount > 0) {
      shipmentRevenue = parseFloat(shipment.total_amount);
    } else {
      shipmentRevenue = 0; // No estimate - actual data only
    }
    
    if (shipmentRevenue > 0) {
      shiprocketRevenue += shipmentRevenue;
    }
  });

  // COGS not available from Shiprocket - requires product cost data
  shiprocketCogs = 0;

  // If no delivered shipments, use all shipments (actual data only)
  if (deliveredShipments.length === 0 && shiprocketShipments.length > 0) {
    console.log(`⚠️  No delivered shipments, using all shipments for financial breakdown (actual data only)`);
    
    shiprocketShipments.forEach(shipment => {
      const shipmentRevenue = parseFloat(shipment.total || shipment.orderValue || shipment.codCharges || 0);
      shiprocketRevenue += shipmentRevenue;
    });
  }

  // Other costs
  const adSpend = metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
  
  // Shipping cost calculation with multiple field names
  let shippingCost = deliveredShipments.reduce((sum, shipment) => {
    let cost = 0;
    
    // Try different shipping cost field names
    if (shipment.totalCharges && shipment.totalCharges > 0) {
      cost = parseFloat(shipment.totalCharges);
    } else if (shipment.total_charges && shipment.total_charges > 0) {
      cost = parseFloat(shipment.total_charges);
    } else if (shipment.shippingCharges && shipment.shippingCharges > 0) {
      cost = parseFloat(shipment.shippingCharges);
    } else if (shipment.shipping_charges && shipment.shipping_charges > 0) {
      cost = parseFloat(shipment.shipping_charges);
    } else if (shipment.charges && shipment.charges > 0) {
      cost = parseFloat(shipment.charges);
    }
    
    return sum + cost;
  }, 0);
  
  // No estimates - use actual shipping cost only
  if (shippingCost === 0) {
    console.log(`⚠️  No shipping cost data found from Shiprocket`);
  }

  // Business expenses
  const daysInPeriod = Math.ceil((new Date() - new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) / (1000 * 60 * 60 * 24));
  const monthlyMultiplier = daysInPeriod / 30;
  
  const agencyFees = (businessExpenses.agencyFees || 0) * monthlyMultiplier;
  const rtoHandlingFees = (businessExpenses.rtoHandlingFees || 0) * monthlyMultiplier;
  const staffFees = (businessExpenses.staffFees || 0) * monthlyMultiplier;
  const officeRent = (businessExpenses.officeRent || 0) * monthlyMultiplier;
  const otherBusinessExpenses = (businessExpenses.otherExpenses || 0) * monthlyMultiplier;
  const paymentGatewayFees = shiprocketRevenue * ((businessExpenses.paymentGatewayFeePercent || 2.5) / 100);

  console.log(`📦 Shiprocket Financial Breakdown - Revenue: ₹${shiprocketRevenue} from ${deliveredShipments.length || shiprocketShipments.length} shipments`);

  // If no revenue, create sample data for visualization
  if (shiprocketRevenue === 0) {
    console.log(`⚠️  No revenue data, creating sample financial breakdown`);
    
    // Create sample data for visualization
    const sampleRevenue = 100000; // ₹1 lakh sample
    const sampleData = [
      { name: 'Product Cost (COGS)', value: sampleRevenue * 0.4, color: '#0d2923' },
      { name: 'Marketing (Ad Spend)', value: sampleRevenue * 0.15, color: '#2d6a4f' },
      { name: 'Shipping Cost', value: sampleRevenue * 0.1, color: '#1a4037' },
      { name: 'Business Expenses', value: sampleRevenue * 0.1, color: '#40916c' },
    ];
    
    return {
      revenue: sampleRevenue,
      pieData: sampleData,
      list: sampleData
    };
  }

  const allItems = [
    { name: 'Product Cost (COGS)', value: shiprocketCogs, color: '#0d2923' },
    { name: 'Marketing (Ad Spend)', value: adSpend, color: '#2d6a4f' },
    { name: 'Shipping Cost', value: shippingCost, color: '#1a4037' },
    { name: 'Agency Fees', value: agencyFees, color: '#40916c' },
    { name: 'Payment Gateway', value: paymentGatewayFees, color: '#52b788' },
    { name: 'Staff & Operations', value: staffFees + officeRent, color: '#74c69d' },
    { name: 'Other Business Costs', value: rtoHandlingFees + otherBusinessExpenses, color: '#95d5b2' }
  ];
  
  const pieData = allItems.filter(item => item.value > 0);

  // If no cost data, return empty (no estimates)
  if (pieData.length === 0) {
    console.log(`⚠️  No cost data available - showing empty breakdown`);
    return {
      revenue: shiprocketRevenue,
      pieData: [],
      list: []
    };
  }

  return {
    revenue: shiprocketRevenue,
    pieData,
    list: pieData
  };
}

// Calculation functions

function calculateDailyBusinessExpenses(revenue, businessExpenses) {
  if (!businessExpenses) return 0;
  
  // Monthly expenses converted to daily
  const dailyAgencyFees = (businessExpenses.agencyFees || 0) / 30;
  const dailyRtoHandlingFees = (businessExpenses.rtoHandlingFees || 0) / 30;
  const dailyStaffFees = (businessExpenses.staffFees || 0) / 30;
  const dailyOfficeRent = (businessExpenses.officeRent || 0) / 30;
  const dailyOtherExpenses = (businessExpenses.otherExpenses || 0) / 30;
  
  // Payment gateway fees (percentage of revenue)
  const paymentGatewayFees = revenue * ((businessExpenses.paymentGatewayFeePercent || 2.5) / 100);
  
  return dailyAgencyFees + dailyRtoHandlingFees + dailyStaffFees + dailyOfficeRent + dailyOtherExpenses + paymentGatewayFees;
}

function calculateSummary(orders, products, metaInsights, shiprocketShipments, onboardingData, businessExpenses) {
  // Create product lookup map for O(1) access
  const productMap = new Map();
  
  // Get product costs from onboarding (primary source)
  if (onboardingData?.step3?.productCosts) {
    onboardingData.step3.productCosts.forEach(p => {
      if (p.productId) {
        productMap.set(p.productId.toString(), parseFloat(p.cost) || 0);
      }
    });
    console.log(`📦 Loaded ${productMap.size} product costs from onboarding`);
  }
  
  // Fallback: Also check products table for manufacturingCost
  products.forEach(p => {
    if (p.productId && !productMap.has(p.productId.toString())) {
      productMap.set(p.productId.toString(), p.manufacturingCost || 0);
    }
  });

  // Calculate Shopify metrics ONLY for main dashboard
  console.log(`📊 Main Dashboard - Calculating Shopify metrics only...`);
  
  // Filter valid Shopify orders (exclude refunded/cancelled)
  const validOrders = orders.filter(order => {
    const financialStatus = (order.financialStatus || '').toLowerCase();
    return !(financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled');
  });
  
  const totalOrders = validOrders.length;
  const revenue = validOrders.reduce((sum, order) => {
    return sum + parseFloat(order.totalPrice || order.subtotalPrice || 0);
  }, 0);

  // Calculate COGS from Shopify orders only
  let cogs = 0;
  validOrders.forEach(order => {
    (order.lineItems || []).forEach(item => {
      const productId = item.product_id?.toString();
      const unitCost = productMap.get(productId) || 0;
      const quantity = item.quantity || 0;
      cogs += unitCost * quantity;
    });
  });

  // Ad Spend (A) = Total amount spent on ads
  const adSpend = metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
  console.log(`📊 Ad Spend Calculation: ${metaInsights.length} insights, Total: ₹${adSpend}`);

  // Shipping Cost - Get actual from Shiprocket shipments (no estimates)
  let shippingCost = 0;
  if (shiprocketShipments && shiprocketShipments.length > 0) {
    shippingCost = shiprocketShipments.reduce((sum, s) => {
      return sum + parseFloat(s.totalCharges || s.shippingCharges || s.freight_charges || 0);
    }, 0);
  }

  // Calculate Business Expenses (monthly expenses converted to period-based)
  const daysInPeriod = Math.ceil((new Date() - new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) / (1000 * 60 * 60 * 24));
  const monthlyMultiplier = daysInPeriod / 30;
  
  const agencyFees = (businessExpenses.agencyFees || 0) * monthlyMultiplier;
  const rtoHandlingFees = (businessExpenses.rtoHandlingFees || 0) * monthlyMultiplier;
  const staffFees = (businessExpenses.staffFees || 0) * monthlyMultiplier;
  const officeRent = (businessExpenses.officeRent || 0) * monthlyMultiplier;
  const otherBusinessExpenses = (businessExpenses.otherExpenses || 0) * monthlyMultiplier;
  
  // Payment Gateway Fees (percentage of Shopify revenue)
  const paymentGatewayFees = revenue * ((businessExpenses.paymentGatewayFeePercent || 2.5) / 100);
  
  const totalBusinessExpenses = agencyFees + rtoHandlingFees + staffFees + officeRent + otherBusinessExpenses + paymentGatewayFees;

  // Profit Calculations (Based on Shopify Orders)
  const grossProfit = revenue - cogs;
  const netProfit = revenue - (cogs + adSpend + shippingCost + totalBusinessExpenses);
  
  // Derived Metrics (Based on Shopify Data)
  const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const aov = totalOrders > 0 ? revenue / totalOrders : 0;
  const cpp = totalOrders > 0 ? adSpend / totalOrders : 0;
  const roas = adSpend > 0 ? revenue / adSpend : 0;
  const poas = adSpend > 0 ? netProfit / adSpend : 0;
  const totalCosts = cogs + adSpend + shippingCost + totalBusinessExpenses;

  console.log(`📊 Shopify Summary Calculations:`, {
    revenue, 
    cogs, 
    adSpend, 
    shippingCost,
    grossProfit, 
    netProfit,
    grossProfitMargin: `${grossProfitMargin.toFixed(2)}%`,
    netProfitMargin: `${netProfitMargin.toFixed(2)}%`,
    aov, 
    roas: roas.toFixed(2)
  });

  return [
    // Shopify Metrics Only
    { title: 'Total Orders', value: totalOrders.toLocaleString('en-IN'), formula: 'Total valid Shopify orders in date range' },
    { title: 'Revenue', value: `₹${revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total revenue from all Shopify orders' },
    
    // Cost Breakdown
    { title: 'COGS', value: `₹${cogs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Cost of Goods Sold for Shopify orders' },
    { title: 'Ad Spend', value: `₹${adSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total marketing spend from Meta' },
    { title: 'Shipping Cost', value: shippingCost > 0 ? `₹${shippingCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '--', formula: 'Actual shipping cost from Shiprocket' },
    { title: 'Business Expenses', value: `₹${totalBusinessExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Agency fees + RTO + Gateway + Staff + Rent + Other' },
    
    // Profit Metrics
    { title: 'Net Profit', value: `₹${netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Revenue − (COGS + Ad Spend + Shipping + Business Expenses)' },
    { title: 'Gross Profit', value: `₹${grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Revenue − COGS' },
    
    // Margin Metrics
    { title: 'Gross Profit Margin', value: `${grossProfitMargin.toFixed(2)}%`, formula: '(Gross Profit / Revenue) × 100' },
    { title: 'Net Profit Margin', value: `${netProfitMargin.toFixed(2)}%`, formula: '(Net Profit / Revenue) × 100' },
    
    // Marketing Metrics
    { title: 'ROAS', value: roas.toFixed(2), formula: 'Revenue ÷ Ad Spend' },
    { title: 'POAS', value: poas.toFixed(2), formula: 'Net Profit ÷ Ad Spend' },
    
    // Order Metrics
    { title: 'AOV', value: `₹${aov.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Revenue ÷ Total Orders' },
    { title: 'CPP', value: `₹${cpp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Ad Spend ÷ Total Orders' }
  ];
}

function calculatePerformanceData(orders, startDate, endDate, businessExpenses) {
  if (!orders || orders.length === 0) {
    return [];
  }

  // Optimize: Use Map for O(1) lookups
  const ordersByDate = new Map();
  
  // Single pass through orders - but use Shopify data for chart since we need daily breakdown
  // Note: Shiprocket data doesn't have daily breakdown, so we use Shopify for chart visualization
  // but the main metrics are calculated from Shiprocket delivered orders
  for (const order of orders) {
    const date = order.createdAt?.split('T')[0];
    if (!date) continue;
    
    // Skip cancelled, refunded, or voided orders to match Shopify's revenue calculation
    const financialStatus = (order.financialStatus || '').toLowerCase();
    if (financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled') {
      continue; // Skip this order from chart data
    }
    
    const existing = ordersByDate.get(date);
    // Use totalPrice to match Shopify's total sales
    const revenue = parseFloat(order.totalPrice || order.subtotalPrice || 0);
    
    // Calculate business expenses for this order (daily portion)
    const dailyBusinessExpenses = calculateDailyBusinessExpenses(revenue, businessExpenses);
    
    // Calculate actual costs from available data (no estimates)
    // Get COGS from product costs if available
    let orderCogs = 0;
    (order.lineItems || []).forEach(item => {
      const productId = item.product_id?.toString();
      // COGS would need to come from onboarding data - for now use 0
      orderCogs += 0;
    });
    
    const totalCosts = orderCogs + dailyBusinessExpenses;
    const netProfit = revenue - totalCosts;
    
    if (existing) {
      existing.revenue += revenue;
      existing.totalCosts += totalCosts;
      existing.netProfit += netProfit;
      existing.orders += 1;
    } else {
      ordersByDate.set(date, {
        date,
        revenue,
        totalCosts,
        netProfit,
        orders: 1
      });
    }
  }

  // Convert to array and sort
  const data = Array.from(ordersByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({
      name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: Math.round(item.revenue),
      totalCosts: Math.round(item.totalCosts),
      netProfit: Math.round(item.netProfit),
      netProfitMargin: item.revenue > 0 ? Math.round((item.netProfit / item.revenue) * 100) : 0,
      orders: item.orders
    }));

  console.log(`📊 Performance data: ${data.length} data points (Note: Chart shows Shopify daily data for visualization, main metrics use Shiprocket delivered orders)`);
  return data;
}

function calculateFinancialBreakdown(orders, products, metaInsights, shiprocketShipments, onboardingData, businessExpenses) {
  // Create product lookup map - use onboarding data first
  const productMap = new Map();
  
  // Get product costs from onboarding (primary source)
  if (onboardingData?.step3?.productCosts) {
    onboardingData.step3.productCosts.forEach(p => {
      if (p.productId) {
        productMap.set(p.productId.toString(), parseFloat(p.cost) || 0);
      }
    });
  }
  
  // Fallback to products table
  products.forEach(p => {
    if (p.productId && !productMap.has(p.productId.toString())) {
      productMap.set(p.productId.toString(), p.manufacturingCost || 0);
    }
  });
  
  // ===== Calculate revenue from Shopify orders ONLY =====
  let revenue = 0;
  let cogs = 0;
  let orderCount = 0;
  
  console.log(`� FFinancial Breakdown - Calculating from Shopify orders only...`);
  
  // Filter valid Shopify orders (exclude refunded/cancelled)
  const validOrders = orders.filter(order => {
    const financialStatus = (order.financialStatus || '').toLowerCase();
    return !(financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled');
  });
  
  // Calculate revenue and COGS from Shopify orders
  validOrders.forEach(order => {
    const orderRevenue = parseFloat(order.totalPrice || order.subtotalPrice || 0);
    revenue += orderRevenue;
    orderCount++;
    
    // Calculate COGS for this order
    (order.lineItems || []).forEach(item => {
      const productId = item.product_id?.toString();
      const unitCost = productMap.get(productId) || 0;
      const quantity = item.quantity || 0;
      cogs += unitCost * quantity;
    });
  });
  
  console.log(`📊 Financial Breakdown - Shopify Orders Revenue: ₹${revenue} from ${orderCount} orders`);
  
  // Ad Spend (A) = Total marketing spend
  const adSpend = metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
  console.log(`📊 Financial Breakdown - Ad Spend: ${metaInsights.length} insights, Total: ₹${adSpend}`);
  
  // Shipping Cost - Get actual from Shiprocket (no estimates)
  let shippingCost = 0;
  if (shiprocketShipments && shiprocketShipments.length > 0) {
    shippingCost = shiprocketShipments.reduce((sum, s) => {
      return sum + parseFloat(s.totalCharges || s.shippingCharges || s.freight_charges || 0);
    }, 0);
  }
  
  // Calculate Business Expenses (based on Shopify revenue)
  const daysInPeriod = Math.ceil((new Date() - new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) / (1000 * 60 * 60 * 24));
  const monthlyMultiplier = daysInPeriod / 30;
  
  const agencyFees = (businessExpenses.agencyFees || 0) * monthlyMultiplier;
  const rtoHandlingFees = (businessExpenses.rtoHandlingFees || 0) * monthlyMultiplier;
  const staffFees = (businessExpenses.staffFees || 0) * monthlyMultiplier;
  const officeRent = (businessExpenses.officeRent || 0) * monthlyMultiplier;
  const otherBusinessExpenses = (businessExpenses.otherExpenses || 0) * monthlyMultiplier;
  const paymentGatewayFees = revenue * ((businessExpenses.paymentGatewayFeePercent || 2.5) / 100);
  
  const totalBusinessExpenses = agencyFees + rtoHandlingFees + staffFees + officeRent + otherBusinessExpenses + paymentGatewayFees;
  
  console.log(`📊 Financial Breakdown - Shopify Revenue: ${revenue}, COGS: ${cogs}, Ad Spend: ${adSpend}, Shipping: ${shippingCost}, Business Expenses: ${totalBusinessExpenses}`);
  
  // If no revenue AND no costs, return empty pie data to avoid NaN errors
  if (revenue === 0 && cogs === 0 && adSpend === 0 && shippingCost === 0 && totalBusinessExpenses === 0) {
    console.log(`⚠️  No financial data - returning empty pie chart`);
    return {
      revenue: 0,
      pieData: [],
      list: []
    };
  }
  
  console.log(`   COGS: ${cogs}, Marketing: ${adSpend}, Shipping: ${shippingCost}, Business Expenses: ${totalBusinessExpenses}`);
  
  // Only include items with value > 0 to avoid NaN in charts
  const allItems = [
    { name: 'Product Cost (COGS)', value: cogs, color: '#0d2923' },
    { name: 'Marketing (Ad Spend)', value: adSpend, color: '#2d6a4f' },
    { name: 'Shipping Cost', value: shippingCost, color: '#1a4037' },
    { name: 'Agency Fees', value: agencyFees, color: '#40916c' },
    { name: 'Payment Gateway', value: paymentGatewayFees, color: '#52b788' },
    { name: 'Staff & Operations', value: staffFees + officeRent, color: '#74c69d' },
    { name: 'Other Business Costs', value: rtoHandlingFees + otherBusinessExpenses, color: '#95d5b2' }
  ];
  
  const pieData = allItems.filter(item => item.value > 0);
  
  console.log(`   Pie data items: ${pieData.length} (filtered from ${allItems.length})`);

  return {
    revenue: revenue, // Use Shopify revenue for pie chart center
    pieData,
    list: pieData
  };
}

function calculateMarketingMetrics(metaInsights, orders) {
  const totalSpend = metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
  const totalReach = metaInsights.reduce((sum, insight) => sum + (insight.reach || 0), 0);
  const totalClicks = metaInsights.reduce((sum, insight) => sum + (insight.linkClicks || 0), 0);
  // Use totalPrice to match Shopify's total sales
  const revenue = orders.reduce((sum, order) => {
    return sum + parseFloat(order.totalPrice || order.subtotalPrice || 0);
  }, 0);
  
  const roas = totalSpend > 0 ? revenue / totalSpend : 0;
  const ctr = totalReach > 0 ? (totalClicks / totalReach) * 100 : 0;

  return [
    { title: 'Total Spend', value: `₹${totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total marketing spend' },
    { title: 'ROAS', value: roas.toFixed(2), formula: 'Revenue / Marketing Spend' },
    { title: 'Reach', value: totalReach.toLocaleString('en-IN'), formula: 'Total people reached' },
    { title: 'Link Clicks', value: totalClicks.toLocaleString('en-IN'), formula: 'Total link clicks' },
    { title: 'CTR', value: `${ctr.toFixed(2)}%`, formula: '(Link Clicks / Reach) × 100' }
  ];
}

function calculateMarketingChart(metaInsights, startDate, endDate) {
  if (!metaInsights || metaInsights.length === 0) {
    return [];
  }

  // Calculate overall ROAS for estimation when daily revenue is 0
  const totalSpend = metaInsights.reduce((sum, i) => sum + (i.adSpend || 0), 0);
  const totalRevenue = metaInsights.reduce((sum, i) => sum + (i.metaRevenue || 0), 0);
  const overallROAS = totalSpend > 0 && totalRevenue > 0 ? totalRevenue / totalSpend : 0;

  // Optimize: Use Map for O(1) lookups
  const insightsByDate = new Map();
  
  for (const insight of metaInsights) {
    const date = insight.date;
    if (!date) continue;
    
    const existing = insightsByDate.get(date);
    if (existing) {
      existing.spend += insight.adSpend || 0;
      existing.reach += insight.reach || 0;
      existing.clicks += insight.linkClicks || 0;
      existing.impressions += insight.impressions || 0;
      existing.revenue += insight.metaRevenue || 0;
    } else {
      insightsByDate.set(date, {
        date,
        spend: insight.adSpend || 0,
        reach: insight.reach || 0,
        clicks: insight.linkClicks || 0,
        impressions: insight.impressions || 0,
        revenue: insight.metaRevenue || 0
      });
    }
  }

  // Convert to array and sort
  const data = Array.from(insightsByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => {
      // Calculate ROAS: use actual revenue if available, otherwise estimate using overall ROAS
      let roas = 0;
      if (item.spend > 0) {
        if (item.revenue > 0) {
          // Use actual revenue for this day
          roas = parseFloat((item.revenue / item.spend).toFixed(2));
        } else if (overallROAS > 0) {
          // Estimate using overall ROAS when daily revenue is 0
          roas = parseFloat(overallROAS.toFixed(2));
        }
      }
      
      return {
        name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        spend: Math.round(item.spend),
        reach: item.reach,
        linkClicks: item.clicks,
        roas
      };
    });

  console.log(`📊 Marketing chart data: ${data.length} data points, Overall ROAS: ${overallROAS.toFixed(2)}x`);
  return data;
}

function calculateCustomerTypeData(orders, startDate, endDate) {
  if (!orders || orders.length === 0) {
    console.log(`⚠️  No orders for customer type data`);
    return [];
  }

  // Optimize: Use Set for O(1) customer lookups and Map for dates
  const seenCustomers = new Set();
  const ordersByDate = new Map();
  
  // Single pass - no sorting needed as we process chronologically
  for (const order of orders) {
    const date = order.createdAt?.split('T')[0];
    if (!date) continue;
    
    // Extract customer ID
    const customerId = order.customerId || 
                      order.customer?.id || 
                      order.orderData?.customer?.id ||
                      order.orderData?.customer_id;
    
    const customerKey = customerId ? customerId.toString() : `guest_${order.orderId || order.orderData?.id}`;
    
    // Get or create date entry
    let dateEntry = ordersByDate.get(date);
    if (!dateEntry) {
      dateEntry = { date, new: 0, returning: 0 };
      ordersByDate.set(date, dateEntry);
    }
    
    // Check if customer is new or returning
    if (seenCustomers.has(customerKey)) {
      dateEntry.returning += 1;
    } else {
      seenCustomers.add(customerKey);
      dateEntry.new += 1;
    }
  }

  console.log(`📊 Customer type data: Processed ${orders.length} orders`);

  // Convert to array and sort
  const data = Array.from(ordersByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({
      name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      newCustomers: item.new,
      returningCustomers: item.returning
    }));

  console.log(`   Generated ${data.length} data points`);
  return data;
}

function calculateWebsiteMetrics(orders, customers, metaInsights, shiprocketShipments, onboardingData, businessExpenses) {
  // Filter valid orders (exclude cancelled, refunded, voided)
  const validOrders = orders.filter(order => {
    const financialStatus = (order.financialStatus || '').toLowerCase();
    return !(financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled');
  });
  
  // 1. Total Customers - Unique customers from orders
  const uniqueCustomers = new Set();
  orders.forEach(order => {
    const customerId = order.customerId || order.customer?.id || order.orderData?.customer?.id;
    if (customerId) {
      uniqueCustomers.add(customerId.toString());
    }
  });
  const totalCustomers = uniqueCustomers.size;
  
  // 2. Orders Today - Orders created today
  const today = new Date().toISOString().split('T')[0];
  const ordersToday = validOrders.filter(order => {
    const orderDate = order.createdAt?.split('T')[0];
    return orderDate === today;
  }).length;
  
  // 3. Profit per Order - Calculate net profit per order
  // Get product costs
  const productMap = new Map();
  if (onboardingData?.step3?.productCosts) {
    onboardingData.step3.productCosts.forEach(p => {
      if (p.productId) {
        productMap.set(p.productId.toString(), parseFloat(p.cost) || 0);
      }
    });
  }
  
  // Calculate total revenue and costs
  let revenue = 0;
  let cogs = 0;
  
  validOrders.forEach(order => {
    revenue += parseFloat(order.totalPrice || order.subtotalPrice || 0);
    
    (order.lineItems || []).forEach(item => {
      const productId = item.product_id?.toString();
      const unitCost = productMap.get(productId) || 0;
      const quantity = item.quantity || 0;
      cogs += unitCost * quantity;
    });
  });
  
  const adSpend = metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
  
  // Shipping Cost - Get actual from Shiprocket (no estimates)
  let shippingCost = 0;
  if (shiprocketShipments && shiprocketShipments.length > 0) {
    shippingCost = shiprocketShipments.reduce((sum, s) => {
      return sum + parseFloat(s.totalCharges || s.shippingCharges || s.freight_charges || 0);
    }, 0);
  }
  
  // Calculate Business Expenses
  const daysInPeriod = Math.ceil((new Date() - new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) / (1000 * 60 * 60 * 24));
  const monthlyMultiplier = daysInPeriod / 30;
  
  const totalBusinessExpenses = (
    (businessExpenses.agencyFees || 0) +
    (businessExpenses.rtoHandlingFees || 0) +
    (businessExpenses.staffFees || 0) +
    (businessExpenses.officeRent || 0) +
    (businessExpenses.otherExpenses || 0)
  ) * monthlyMultiplier + (revenue * ((businessExpenses.paymentGatewayFeePercent || 2.5) / 100));
  
  const netProfit = revenue - (cogs + adSpend + shippingCost + totalBusinessExpenses);
  const profitPerOrder = validOrders.length > 0 ? netProfit / validOrders.length : 0;
  
  // 4. Prepaid Orders - Orders with paid financial status
  const prepaidOrders = validOrders.filter(o => 
    (o.financialStatus || '').toLowerCase() === 'paid'
  ).length;

  return [
    { 
      title: 'Total Customers', 
      value: totalCustomers.toLocaleString('en-IN'), 
      formula: 'Unique customers from orders' 
    },
    { 
      title: 'Orders Today', 
      value: ordersToday.toLocaleString('en-IN'), 
      formula: 'Orders placed today' 
    },
    { 
      title: 'Profit per Order', 
      value: `₹${Math.round(profitPerOrder).toLocaleString('en-IN')}`, 
      formula: 'Net Profit ÷ Total Orders' 
    },
    { 
      title: 'Prepaid Orders', 
      value: prepaidOrders.toLocaleString('en-IN'), 
      formula: 'Orders with paid status' 
    }
  ];
}

function calculateProductRankings(orders, products) {
  const productSales = {};
  
  orders.forEach(order => {
    // Skip cancelled, refunded, or voided orders
    const financialStatus = (order.financialStatus || '').toLowerCase();
    if (financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled') {
      return; // Skip this order
    }
    
    (order.lineItems || []).forEach(item => {
      const productId = item.product_id?.toString();
      if (!productSales[productId]) {
        productSales[productId] = {
          id: productId,
          name: item.title || 'Unknown Product',
          sales: 0,
          total: 0
        };
      }
      productSales[productId].sales += item.quantity;
      productSales[productId].total += parseFloat(item.price || 0) * item.quantity;
    });
  });

  const sorted = Object.values(productSales).sort((a, b) => b.sales - a.sales);
  
  return {
    bestSelling: sorted.slice(0, 5).map(p => ({
      ...p,
      total: `₹${p.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    })),
    leastSelling: sorted.slice(-5).reverse().map(p => ({
      ...p,
      total: `₹${p.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    }))
  };
}

function calculateShippingMetrics(shiprocketShipments, orders) {
  // If we have Shiprocket data, use it; otherwise fall back to Shopify orders
  if (shiprocketShipments && shiprocketShipments.length > 0) {
    console.log(`📊 Calculating shipping metrics from ${shiprocketShipments.length} Shiprocket shipments`);
    
    // Log all unique statuses for debugging
    const allStatuses = {};
    shiprocketShipments.forEach(s => {
      const status = (s.shipmentStatus || s.status || 'NO_STATUS').toUpperCase().trim();
      const code = s.statusCode;
      const key = `${status} (${code})`;
      allStatuses[key] = (allStatuses[key] || 0) + 1;
    });
    console.log(`   All statuses:`, allStatuses);
    
    // Get status - prefer shipmentStatus from Shipments API
    const getStatus = (s) => (s.shipmentStatus || s.status || '').toUpperCase().trim();
    const getStatusCode = (s) => parseInt(s.statusCode) || 0;
    
    // Delivered = status "DELIVERED" or status code 6, 7, 8 (exclude RTO)
    const delivered = shiprocketShipments.filter(s => {
      const status = getStatus(s);
      const code = getStatusCode(s);
      // Same logic as shiprocket-dashboard.controller.js
      return (status === 'DELIVERED' || code === 6 || code === 7 || code === 8) &&
             !status.includes('RTO');
    }).length;
    
    // In Transit = status contains "TRANSIT", "SHIPPED", "OUT FOR" or code 4, 5
    const inTransit = shiprocketShipments.filter(s => {
      const status = getStatus(s);
      const code = getStatusCode(s);
      return (status === 'IN TRANSIT' || status === 'OUT FOR DELIVERY' || 
              status === 'SHIPPED' || status === 'PICKED UP' ||
              status.includes('TRANSIT') || status.includes('OUT FOR') ||
              code === 4 || code === 5) &&
             !status.includes('DELIVERED') && !status.includes('RTO');
    }).length;
    
    // RTO = status contains "RTO" or code 9
    const rto = shiprocketShipments.filter(s => {
      const status = getStatus(s);
      const code = getStatusCode(s);
      return status.includes('RTO') || code === 9;
    }).length;
    
    // NDR = status contains "NDR" or "UNDELIVERED"
    const ndrPending = shiprocketShipments.filter(s => {
      const status = getStatus(s);
      return status === 'NDR' || status === 'UNDELIVERED' || status.includes('NDR');
    }).length;
    
    // Pickup Pending = status "NEW", "READY TO SHIP", "PICKUP" or code 1, 2, 3
    const pickupPending = shiprocketShipments.filter(s => {
      const status = getStatus(s);
      const code = getStatusCode(s);
      return status === 'NEW' || status === 'READY TO SHIP' || 
             status === 'PICKUP SCHEDULED' || status === 'AWB ASSIGNED' ||
             status.includes('PICKUP') || status.includes('READY') ||
             code === 1 || code === 2 || code === 3;
    }).length;
    
    // Calculate total shipping cost (actual data only - no estimates)
    let totalShippingCost = shiprocketShipments.reduce((sum, s) => 
      sum + (parseFloat(s.totalCharges || s.shippingCharges || s.freightCharges || s.freight_charges) || 0), 0
    );
    
    // No estimates - use actual data only
    if (totalShippingCost === 0) {
      console.log(`⚠️  No shipping cost data available from Shiprocket`);
    }
    
    const avgShippingCost = shiprocketShipments.length > 0 && totalShippingCost > 0
      ? totalShippingCost / shiprocketShipments.length 
      : 0;

    // Calculate additional metrics
    const totalShipments = shiprocketShipments.length;
    const deliveryRate = totalShipments > 0 ? (delivered / totalShipments) * 100 : 0;
    const rtoRate = totalShipments > 0 ? (rto / totalShipments) * 100 : 0;
    
    // Count prepaid vs COD from Shiprocket data (not Shopify)
    const prepaidOrders = shiprocketShipments.filter(s => 
      (s.paymentMethod || '').toLowerCase() === 'prepaid'
    ).length;
    const codOrders = shiprocketShipments.filter(s => 
      (s.paymentMethod || '').toLowerCase() === 'cod'
    ).length;

    console.log(`   Shipping breakdown:`, {
      totalShipments, delivered, inTransit, rto, ndrPending, pickupPending,
      deliveryRate: `${deliveryRate.toFixed(2)}%`,
      rtoRate: `${rtoRate.toFixed(2)}%`,
      prepaidOrders, codOrders,
      totalCost: totalShippingCost, avgCost: avgShippingCost
    });

    // Debug: Show status distribution
    if (shiprocketShipments.length > 0) {
      console.log(`   Status distribution:`);
      const statusCounts = {};
      shiprocketShipments.forEach(s => {
        const key = `${s.status} (${s.statusCode})`;
        statusCounts[key] = (statusCounts[key] || 0) + 1;
      });
      console.log(statusCounts);
    }

    return [
      { title: 'Total Shipments', value: totalShipments.toString(), formula: 'Total number of shipments' },
      { title: 'Delivered', value: delivered.toString(), formula: 'Successfully delivered orders' },
      { title: 'In-Transit', value: inTransit.toString(), formula: 'Orders in transit' },
      { title: 'RTO', value: rto.toString(), formula: 'Return to origin' },
      { title: 'NDR Pending', value: ndrPending.toString(), formula: 'Non-delivery reports pending' },
      { title: 'Delivery Rate', value: `${deliveryRate.toFixed(2)}%`, formula: '(Delivered / Total) × 100' },
      { title: 'RTO Rate', value: `${rtoRate.toFixed(2)}%`, formula: '(RTO / Total) × 100' },
      { title: 'Prepaid Orders', value: prepaidOrders.toString(), formula: 'Prepaid payment orders' },
      { title: 'COD', value: codOrders.toString(), formula: 'Cash on delivery orders' },
      { title: 'Pickup Pending', value: pickupPending.toString(), formula: 'Awaiting pickup' }
    ];
  } else {
    // Fallback to Shopify orders if no Shiprocket data
    // RTO, NDR, Pickup Pending require Shiprocket connection for actual data
    console.log(`⚠️  No Shiprocket data - RTO/NDR/Pickup require Shiprocket connection`);
    console.log(`   To get actual data: Go to Settings > Shiprocket > Reconnect with your credentials`);
    
    const totalOrders = orders.length;
    const delivered = orders.filter(o => o.fulfillmentStatus === 'fulfilled').length;
    const pending = orders.filter(o => !o.fulfillmentStatus || o.fulfillmentStatus === 'pending' || o.fulfillmentStatus === 'partial').length;
    
    const prepaidOrders = orders.filter(o => o.financialStatus === 'paid').length;
    const codOrders = totalOrders - prepaidOrders;
    
    const deliveryRate = totalOrders > 0 ? (delivered / totalOrders) * 100 : 0;

    return [
      { title: 'Total Shipments', value: totalOrders.toString(), formula: 'Total number of orders' },
      { title: 'Delivered', value: delivered.toString(), formula: 'Successfully delivered orders' },
      { title: 'In-Transit', value: pending.toString(), formula: 'Orders in transit' },
      { title: 'RTO', value: '-', formula: 'Reconnect Shiprocket in Settings' },
      { title: 'NDR Pending', value: '-', formula: 'Reconnect Shiprocket in Settings' },
      { title: 'Delivery Rate', value: `${deliveryRate.toFixed(2)}%`, formula: '(Delivered / Total) × 100' },
      { title: 'RTO Rate', value: '-', formula: 'Reconnect Shiprocket in Settings' },
      { title: 'Prepaid Orders', value: prepaidOrders.toString(), formula: 'Prepaid payment orders' },
      { title: 'COD', value: codOrders.toString(), formula: 'Cash on delivery orders' },
      { title: 'Pickup Pending', value: '-', formula: 'Reconnect Shiprocket in Settings' }
    ];
  }
}

function calculateOrderTypeData(orders) {
  // If no orders, return empty array to avoid NaN in charts
  if (!orders || orders.length === 0) {
    return [];
  }
  
  // Filter out cancelled, refunded, or voided orders
  const validOrders = orders.filter(order => {
    const financialStatus = (order.financialStatus || '').toLowerCase();
    return !(financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled');
  });
  
  if (validOrders.length === 0) {
    return [];
  }
  
  const prepaid = validOrders.filter(o => o.financialStatus === 'paid').length;
  const cod = validOrders.length - prepaid;

  // Only include items with value > 0
  return [
    { name: 'Prepaid', value: prepaid, color: '#2d6a4f' },
    { name: 'COD', value: cod, color: '#52b788' }
  ].filter(item => item.value > 0);
}

module.exports = {
  getDashboardData
};

/**
 * Get Shiprocket Dashboard Data
 * @route GET /api/data/shiprocket-dashboard
 * @access Protected
 */
async function getShiprocketDashboardData(req, res) {
  const startTime = Date.now();
  
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;
    
    // Create cache key
    const cacheKey = `shiprocket-dashboard:${userId}:${startDate}:${endDate}`;
    
    // Check cache first
    const cachedData = await getCachedDashboard(cacheKey);
    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ Returning cached Shiprocket dashboard data (${duration}ms)`);
      return res.json(cachedData);
    }

    console.log(`\n📦 Fetching Shiprocket dashboard data for user: ${userId}`);
    console.log(`   Date range: ${startDate} to ${endDate}`);

    // Fetch data - using Shiprocket API for shipments, database for other data
    let [
      shopifyProducts,
      shopifyOrders,
      shopifyCustomers,
      shopifyConnection,
      metaConnection,
      metaInsights,
      shippingConnection,
      shiprocketShipments,
      onboardingData,
      businessExpenses
    ] = await Promise.all([
      getShopifyProducts(userId),
      getShopifyOrders(userId, startDate, endDate),
      getShopifyCustomers(userId),
      getShopifyConnection(userId),
      getMetaConnection(userId),
      getMetaInsights(userId, startDate, endDate),
      getShippingConnection(userId),
      getShiprocketShipments(userId, startDate, endDate), // This now uses Shiprocket API
      getOnboardingData(userId),
      getBusinessExpenses(userId)
    ]);

    console.log(`🔍 Shiprocket Dashboard Debug:`);
    console.log(`   Shiprocket connection exists: ${!!shippingConnection}`);
    console.log(`   Has Shiprocket token: ${!!(shippingConnection && shippingConnection.token)}`);
    console.log(`   Shiprocket API shipments: ${shiprocketShipments.length}`);
    console.log(`   Shopify orders: ${shopifyOrders.length}`);
    console.log(`   Meta insights: ${metaInsights.length}`);

    // Calculate Shiprocket-specific metrics using API data
    const [
      summary,
      performanceChartData,
      financialsBreakdownData,
      shipping
    ] = await Promise.all([
      Promise.resolve(calculateShiprocketSummary(shopifyOrders, shopifyProducts, metaInsights, shiprocketShipments, onboardingData, businessExpenses)),
      Promise.resolve(calculateShiprocketPerformanceData(shiprocketShipments, startDate, endDate)),
      Promise.resolve(calculateShiprocketFinancialBreakdown(shopifyOrders, shopifyProducts, metaInsights, shiprocketShipments, onboardingData, businessExpenses)),
      Promise.resolve(calculateShippingMetrics(shiprocketShipments, shopifyOrders))
    ]);

    console.log(`📦 Shiprocket Dashboard Data Summary:`, {
      summaryCards: summary?.length || 0,
      performanceDataPoints: performanceChartData?.length || 0,
      pieDataItems: financialsBreakdownData?.pieData?.length || 0,
      shippingCards: shipping?.length || 0,
      revenue: financialsBreakdownData?.revenue || 0
    });

    const shiprocketDashboardData = {
      summary,
      performanceChartData,
      financialsBreakdownData,
      shipping,
      connections: {
        shopify: !!shopifyConnection,
        meta: !!metaConnection,
        shipping: !!shippingConnection
      },
      shiprocketShipments: shiprocketShipments.length
    };

    // Cache the data
    await setCachedDashboard(cacheKey, shiprocketDashboardData);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Shiprocket dashboard data compiled successfully in ${duration}ms\n`);
    
    res.json(shiprocketDashboardData);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Shiprocket dashboard data error after ${duration}ms:`, error);
    res.status(500).json({
      error: 'Failed to fetch Shiprocket dashboard data',
      message: error.message
    });
  }
}
async function getSyncStatus(req, res) {
  try {
    const userId = req.user.userId;
    
    const shopifyBackgroundSync = require('../services/shopify-background-sync.service');
    const syncStatus = await shopifyBackgroundSync.getSyncStatus(userId);
    
    // Also check connection status
    const shopifyConnection = await getShopifyConnection(userId);
    
    res.json({
      syncStatus: syncStatus || {
        status: 'idle',
        message: 'No sync in progress'
      },
      initialSyncCompleted: shopifyConnection?.initialSyncCompleted || false,
      lastSyncAt: shopifyConnection?.syncCompletedAt || null
    });
    
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error.message
    });
  }
}

/**
 * Get Sync Status
 * @route GET /api/data/sync-status
 * @access Protected
 */
async function getSyncStatus(req, res) {
  try {
    const userId = req.user.userId;
    
    const shopifyBackgroundSync = require('../services/shopify-background-sync.service');
    const syncStatus = await shopifyBackgroundSync.getSyncStatus(userId);
    
    // Also check connection status
    const shopifyConnection = await getShopifyConnection(userId);
    
    res.json({
      syncStatus: syncStatus || {
        status: 'idle',
        message: 'No sync in progress'
      },
      initialSyncCompleted: shopifyConnection?.initialSyncCompleted || false,
      lastSyncAt: shopifyConnection?.syncCompletedAt || null
    });
    
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error.message
    });
  }
}

/**
 * Manual Shopify Sync - Sync last 3 months of orders
 * @route POST /api/data/sync-shopify
 * @access Protected
 */
async function syncShopifyOrders(req, res) {
  try {
    const userId = req.user.userId;
    
    console.log(`\n🔄 Manual Shopify sync requested for user: ${userId}`);
    
    // Get Shopify connection
    const shopifyConnection = await getShopifyConnection(userId);
    
    if (!shopifyConnection || !shopifyConnection.accessToken) {
      return res.status(404).json({
        success: false,
        error: 'No Shopify connection found',
        message: 'Please connect your Shopify store first'
      });
    }
    
    const { shopUrl, accessToken } = shopifyConnection;
    console.log(`   Shop: ${shopUrl}`);
    
    // Check if sync is already in progress
    const shopifyBackgroundSync = require('../services/shopify-background-sync.service');
    const currentStatus = await shopifyBackgroundSync.getSyncStatus(userId);
    
    if (currentStatus && currentStatus.status === 'in_progress') {
      return res.json({
        success: true,
        message: 'Sync already in progress',
        status: currentStatus
      });
    }
    
    // Start background sync (last 3 months)
    await shopifyBackgroundSync.startBackgroundSync(userId, shopUrl, accessToken);
    
    res.json({
      success: true,
      message: 'Shopify sync started (last 3 months)',
      status: {
        status: 'starting',
        stage: 'initializing',
        message: 'Starting Shopify sync...'
      }
    });
    
  } catch (error) {
    console.error('Manual Shopify sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start sync',
      message: error.message
    });
  }
}

module.exports = {
  getDashboardData,
  getSyncStatus,
  syncShopifyOrders
};