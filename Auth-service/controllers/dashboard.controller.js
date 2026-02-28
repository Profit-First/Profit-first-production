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
 * Retrieves cached dashboard data from Redis or in-memory fallback.
 * Checks Redis first, then falls back to local memory cache if Redis is unavailable or empty.
 * @param {string} cacheKey - The unique key for the dashboard data cache.
 * @returns {Promise<object|null>} The cached data object or null if not found/expired.
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
 * Stores dashboard data in both Redis (if available) and in-memory cache.
 * Sets a TTL of 5 minutes for Redis data.
 * @param {string} cacheKey - The unique key for the dashboard data cache.
 * @param {object} data - The dashboard data to cache.
 * @returns {Promise<void>}
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
 * Periodically cleans up expired entries from the in-memory cache fallback.
 * Iterates through the map and removes items older than CACHE_TTL.
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
 * Main handler to fetch and aggregate dashboard data.
 * Orchestrates fetching data from Shopify, Meta, Shiprocket, and local DB,
 * performs calculations, and returns a consolidated dashboard object.
 * Supports caching and forced refresh.
 *
 * @route GET /api/data/dashboard
 * @access Protected
 * @param {object} req - Express request object containing user ID and query params.
 * @param {object} res - Express response object.
 */
async function getDashboardData(req, res) {
  const startTime = Date.now();

  try {
    const userId = req.user.userId;
    const { startDate, endDate, forceRefresh } = req.query;

    // Create cache key with version to bust cache when calculation changes
    // Increment version when revenue calculation logic changes
    const CACHE_VERSION = 'v4'; // Changed to v4 to fix order counting logic (include all orders, not just valid ones)
    const cacheKey = `dashboard:${CACHE_VERSION}:${userId}:${startDate}:${endDate}`;

    // Check cache first (unless forceRefresh is requested)
    if (!forceRefresh) {
      const cachedData = await getCachedDashboard(cacheKey);
      if (cachedData) {
        const duration = Date.now() - startTime;
        console.log(`⚡ Returning cached dashboard data (${duration}ms)`);
        return res.json(cachedData);
      }
    } else {
      console.log(`🔄 Force refresh requested, skipping cache`);
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

    // Data is stored in DynamoDB during onboarding - just proceed to fetch
    // No need to check for "needsSync" since data should already be there
    console.log(`📊 Fetching dashboard data from DynamoDB...`);

    // Fetch data from all tables in parallel
    let [
      shopifyProducts,
      shopifyOrders, // shopifyCustomers removed (unused)
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
      // getShopifyCustomers(userId), // REMOVED: Unused and heavy
      getShopifyConnection(userId),
      getMetaConnection(userId),
      getMetaInsights(userId, startDate, endDate),
      getShippingConnection(userId),
      getShiprocketShipments(userId, startDate, endDate, { forceRefresh: !!forceRefresh }),
      getOnboardingData(userId),
      getBusinessExpenses(userId)
    ]);

    // Skip auto-sync since we're fetching directly from Shiprocket API
    console.log(`🔍 Shiprocket Debug:`);
    console.log(`   Connection exists: ${!!shippingConnection}`);
    console.log(`   Has token: ${!!(shippingConnection && shippingConnection.token)}`);
    console.log(`   Using direct API calls (no database dependency)`);
    console.log(`   Platform: ${shippingConnection?.platform}`);

    // OPTIMIZATION: Pre-process data once to avoid repeated loops
    // 1. Create Product Cost Map
    const productMap = new Map();
    if (onboardingData?.step3?.productCosts) {
      onboardingData.step3.productCosts.forEach(p => {
        if (p.productId) productMap.set(p.productId.toString(), parseFloat(p.cost) || 0);
      });
    }
    shopifyProducts.forEach(p => {
      if (p.productId && !productMap.has(p.productId.toString())) {
        productMap.set(p.productId.toString(), p.manufacturingCost || 0);
      }
    });

    // 2. Deduplicate Shopify Orders
    const uniqueOrdersMap = new Map();
    shopifyOrders.forEach(o => {
      const key = o.id ? o.id.toString() : (o.orderNumber ? o.orderNumber.toString() : null);
      if (key) uniqueOrdersMap.set(key, o);
    });
    let allUniqueOrders = Array.from(uniqueOrdersMap.values());

    // 3. Filter out test orders and drafts (these should not be counted at all)
    const uniqueOrders = allUniqueOrders.filter(order => {
      const isTest = order.test === true;
      const isDraft = !order.name && !order.orderNumber;
      return !isTest && !isDraft;
    });

    // 4. Filter Valid Orders (exclude cancelled/refunded/voided for revenue calculations)
    const validOrders = uniqueOrders.filter(order => {
      const financialStatus = (order.financialStatus || '').toLowerCase();
      return !(financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled');
    });

    console.log(`📊 Optimization: Pre-processed ${shopifyOrders.length} orders -> ${allUniqueOrders.length} unique -> ${uniqueOrders.length} real orders (excl. test/draft) -> ${validOrders.length} valid (excl. cancelled)`);

    // Calculate all metrics in parallel for better performance
    const [
      summary,
      performanceChartData,
      marketing,
      marketingChart,
      customerTypeByDay,
      website,
      products,
      shipping,
      orderTypeData
    ] = await Promise.all([
      Promise.resolve(calculateSummary(validOrders, uniqueOrders, productMap, metaInsights, shiprocketShipments, businessExpenses)),
      Promise.resolve(calculatePerformanceData(shopifyOrders, startDate, endDate, businessExpenses)),
      Promise.resolve(calculateMarketingMetrics(metaInsights, validOrders)),
      Promise.resolve(calculateMarketingChart(metaInsights, startDate, endDate)),
      Promise.resolve(calculateCustomerTypeData(shopifyOrders, startDate, endDate)),
      Promise.resolve(calculateWebsiteMetrics(validOrders, uniqueOrders, productMap, metaInsights, shiprocketShipments, businessExpenses)),
      Promise.resolve(calculateProductRankings(validOrders, productMap)),
      Promise.resolve(calculateShippingMetrics(shiprocketShipments, shopifyOrders)),
      Promise.resolve(calculateOrderTypeData(validOrders))
    ]);

    // Get shipping cost from summary cards (this uses the correct value from Shiprocket)
    const shippingCostCard = summary.find(c => c.title === 'Shipping Cost');
    const correctShippingCost = shippingCostCard ? parseFloat(shippingCostCard.value.replace(/[^0-9.-]/g, '')) : 0;

    // Calculate financial breakdown with correct shipping cost
    const financialsBreakdownData = calculateFinancialBreakdown(validOrders, productMap, metaInsights, shiprocketShipments, businessExpenses, correctShippingCost);

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

/**
 * Fetches Shopify products from DynamoDB for a specific user.
 * Used for product cost and profitability calculations.
 * @param {string} userId - The unique identifier of the user.
 * @returns {Promise<Array>} Array of Shopify product objects (subset of fields).
 */
async function getShopifyProducts(userId) {
  try {
    let allProducts = [];
    let lastEvaluatedKey = null;

    do {
      const command = new QueryCommand({
        TableName: process.env.SHOPIFY_PRODUCTS_TABLE || 'shopify_products',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        // Optimize: Only fetch required attributes
        ProjectionExpression: 'userId, productId, manufacturingCost, title',
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
      });

      const result = await dynamoDB.send(command);
      allProducts = allProducts.concat(result.Items || []);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allProducts;
  } catch (error) {
    console.error('Error fetching Shopify products:', error.message);
    return [];
  }
}

/**
 * Fetches Shopify orders from DynamoDB for a specific user within a date range.
 * Handles pagination for large datasets and client-side date filtering.
 * @param {string} userId - The unique identifier of the user.
 * @param {string} startDate - Start date string (YYYY-MM-DD).
 * @param {string} endDate - End date string (YYYY-MM-DD).
 * @returns {Promise<Array>} Array of filtered Shopify order objects.
 */
async function getShopifyOrders(userId, startDate, endDate) {
  try {
    // Fetch orders with pagination (DynamoDB has 1MB limit per query)
    // OPTIMIZATION: We do NOT store 'allOrders' to avoid memory crashes for users with 100k+ orders.
    // Instead, we filter immediately and only keep what matches the date range.

    let filteredOrders = [];
    let lastEvaluatedKey = null;
    let totalScanned = 0;

    console.log(`📦 Fetching Shopify orders for ${userId} (${startDate} to ${endDate})...`);

    do {
      const command = new QueryCommand({
        TableName: process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        // Use ExpressionAttributeNames for reserved keywords like 'name'
        ExpressionAttributeNames: {
          '#orderName': 'name'
        },
        // OPTIMIZATION: Only fetch fields needed for dashboard calculations
        // This significantly reduces data transfer size and memory usage
        ProjectionExpression: 'id, orderNumber, #orderName, test, financialStatus, fulfillmentStatus, createdAt, processedAt, currentSubtotalPrice, subtotalPrice, currentTotalDiscounts, totalDiscounts, totalRefunded, totalShippingPrice, shippingLines, currentTotalTax, totalTax, currentTotalDutiesSet, totalDutiesSet, currentTotalAdditionalFeesSet, totalAdditionalFeesSet, lineItems, gateway, paymentMethod, currentTotalPrice, totalPrice, customerId, customer',
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
      });

      const result = await dynamoDB.send(command);
      const items = result.Items || [];
      totalScanned += items.length;

      // Filter IMMEDIATELY inside the loop
      // This ensures we only hold ~3 months of data in memory, not 5 years
      for (const order of items) {
        if (!order.createdAt) continue;
        const orderDate = order.createdAt.split('T')[0];
        if (orderDate >= startDate && orderDate <= endDate) {
          filteredOrders.push(order);
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;

      // Safety check: specific edge case where filteredOrders becomes too massive
      if (filteredOrders.length > 20000) {
        console.warn(`⚠️ Warning: Order limit (20,000) reached for dashboard view. Truncating.`);
        break;
      }

    } while (lastEvaluatedKey);

    console.log(`📦 Shopify Orders: Found ${filteredOrders.length} matching orders (scanned ${totalScanned} total)`);
    return filteredOrders;
  } catch (error) {
    console.error('Error fetching Shopify orders:', error.message);
    return [];
  }
}

/**
 * Fetches Shopify customers from DynamoDB for a specific user.
 * Used for customer retention and repeat purchase analysis.
 * @param {string} userId - The unique identifier of the user.
 * @returns {Promise<Array>} Array of Shopify customer objects.
 */
async function getShopifyCustomers(userId) {
  try {
    let allCustomers = [];
    let lastEvaluatedKey = null;

    do {
      const command = new QueryCommand({
        TableName: process.env.SHOPIFY_CUSTOMERS_TABLE || 'shopify_customers',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
      });

      const result = await dynamoDB.send(command);
      allCustomers = allCustomers.concat(result.Items || []);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allCustomers;
  } catch (error) {
    console.error('Error fetching Shopify customers:', error.message);
    return [];
  }
}

/**
 * Retrieves the Shopify connection details (access token, shop URL) for a user.
 * @param {string} userId - The unique identifier of the user.
 * @returns {Promise<object|null>} Connection object or null if not found.
 */
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

/**
 * Retrieves the Meta (Facebook Ads) connection details for a user.
 * @param {string} userId - The unique identifier of the user.
 * @returns {Promise<object|null>} Connection object or null if not found.
 */
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

/**
 * Fetches Meta Ad insights (spend, impressions, clicks) from DynamoDB.
 * Aggregates data across all connected ad accounts for the user within the date range.
 * @param {string} userId - The unique identifier of the user.
 * @param {string} startDate - Start date string (YYYY-MM-DD).
 * @param {string} endDate - End date string (YYYY-MM-DD).
 * @returns {Promise<Array>} Array of Meta insight objects sorted by date.
 */
async function getMetaInsights(userId, startDate, endDate) {
  try {
    // OPTIMIZATION: Use Query instead of Scan.
    // Assuming userId is the Partition Key.
    // If 'date' is the Sort Key, we could include it in KeyConditionEntities.
    // If not, we use FilterExpression for date, but Query restricts scope to one user partition.

    let allInsights = [];
    let lastEvaluatedKey = null;

    do {
      const command = new QueryCommand({
        TableName: process.env.META_INSIGHTS_TABLE || 'meta_insights',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: '#date BETWEEN :startDate AND :endDate',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':startDate': startDate,
          ':endDate': endDate
        },
        ExpressionAttributeNames: {
          '#date': 'date'
        },
        ProjectionExpression: 'userId, #date, adSpend, reach, linkClicks, impressions, metaRevenue, adAccountId',
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
      });

      const result = await dynamoDB.send(command);
      allInsights = allInsights.concat(result.Items || []);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const insights = allInsights;

    console.log(`📊 Meta Insights: Found ${insights.length} insights for user ${userId} (${startDate} to ${endDate})`);

    // ... (keep existing logic for grouping/logging)

    if (insights.length === 0) {
      console.log(`⚠️  No Meta insights found for user ${userId}`);
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
    const totalAdSpend = sortedInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
    console.log(`   Total Ad Spend: ₹${totalAdSpend}`);

    return sortedInsights;
  } catch (error) {
    console.error('Error fetching Meta insights:', error.message);
    // Fallback? No, just return empty
    return [];
  }
}

/**
 * Retrieves the Shipping (Shiprocket) connection details for a user.
 * @param {string} userId - The unique identifier of the user.
 * @returns {Promise<object|null>} Connection object containing API token or null.
 */
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

/**
 * Fetches Shiprocket shipments with DynamoDB caching.
 * Uses a cache-first strategy to reduce API calls:
 * 1. First checks DynamoDB for cached data
 * 2. If cache is fresh (< 1 hour), returns cached data
 * 3. If cache is stale or missing, fetches from Shiprocket API and caches result
 * 
 * @param {string} userId - The unique identifier of the user.
 * @param {string} startDate - Start date string (YYYY-MM-DD).
 * @param {string} endDate - End date string (YYYY-MM-DD).
 * @param {object} options - Optional settings.
 * @param {boolean} options.forceRefresh - If true, bypasses cache and fetches fresh data.
 * @returns {Promise<Array>} Array of shipment objects (from cache or API).
 */
async function getShiprocketShipments(userId, startDate, endDate, options = {}) {
  try {
    console.log(`\n📦 === FETCHING SHIPROCKET DATA (CACHE-FIRST) ===`);
    console.log(`📅 Date Range: ${startDate} to ${endDate}`);
    console.log(`👤 User ID: ${userId}`);

    // Get shipping connection for token
    const shippingConnection = await getShippingConnection(userId);

    if (!shippingConnection || !shippingConnection.token) {
      console.log(`❌ No Shiprocket token found for user ${userId}`);
      return [];
    }

    console.log(`✅ Found Shiprocket token, using cache-first strategy...`);

    // Use the new cache-first approach from shiprocket.service
    const shiprocketService = require('../services/shiprocket.service');
    const result = await shiprocketService.getShiprocketDataWithCache(
      userId,
      shippingConnection.token,
      startDate,
      endDate,
      {
        cacheTTLHours: 1,      // Cache valid for 1 hour
        maxPages: 10,          // Limit API pages for performance
        perPage: 250,          // Fetch 250 records per page
        forceRefresh: options.forceRefresh || false  // Pass through forceRefresh option
      }
    );

    if (!result.success) {
      console.log(`❌ Failed to fetch Shiprocket data: ${result.error}`);
      return [];
    }

    const shipments = result.shipments || [];
    console.log(`📦 Got ${shipments.length} shipments (source: ${result.source})`);

    // Log data source for debugging
    if (result.source === 'dynamodb_cache') {
      console.log(`⚡ Data served from DynamoDB cache (age: ${result.cacheAge?.toFixed(2)}h)`);
    } else if (result.source === 'shiprocket_api') {
      console.log(`🌐 Fresh data fetched from Shiprocket API and cached`);
    } else if (result.source === 'dynamodb_stale_cache') {
      console.log(`⚠️  Using stale cache due to API failure: ${result.warning}`);
    } else if (result.source === 'dynamodb_fallback') {
      console.log(`🔄 Using fallback cache: ${result.warning}`);
    }

    // Show quick summary if we have data
    if (shipments.length > 0) {
      const orderDates = shipments
        .map(s => s.parsedOrderDate || s.orderDate || s.createdAt)
        .filter(date => date)
        .sort();

      if (orderDates.length > 0) {
        console.log(`📅 Order date range in results: ${orderDates[0]} to ${orderDates[orderDates.length - 1]}`);
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

      console.log(`📊 Shiprocket Data Analysis:`);
      console.log(`   Status breakdown:`, statusCounts);
      console.log(`   Revenue: ${shipmentsWithRevenue}/${shipments.length} shipments have revenue, Total: ₹${totalRevenue.toFixed(2)}`);
    }

    console.log(`📦 === SHIPROCKET FETCH COMPLETE ===\n`);

    return shipments;
  } catch (error) {
    console.error('❌ Shiprocket fetch error:', error.message);
    console.error('Stack trace:', error.stack);
    return [];
  }
}

/**
 * Retrieves user onboarding data, which includes manual product costs (COGS).
 * @param {string} userId - The unique identifier of the user.
 * @returns {Promise<object|null>} Onboarding data object or null.
 */
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

/**
 * Retrieves fixed business expenses configured by the user (rent, staff, agency fees).
 * Returns default values if no expenses are set.
 * @param {string} userId - The unique identifier of the user.
 * @returns {Promise<object>} Object containing monthly business expense values.
 */
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

/**
 * Calculates a comprehensive summary of Shiprocket performance.
 * Focuses purely on shipping data to determine delivered orders, shipping revenue, and costs.
 * @param {Array} orders - Shopify orders (not primarily used here, but passed for context).
 * @param {Array} products - Shopify products (used for COGS fallback).
 * @param {Array} metaInsights - Meta ads data (for Ad spend calculation).
 * @param {Array} shiprocketShipments - Raw shipment data from Shiprocket.
 * @param {object} onboardingData - Contains manual product costs.
 * @param {object} businessExpenses - Fixed business expenses.
 * @returns {Array} Array of metric objects for the dashboard (Revenue, Profit, ROAS, etc.).
 */
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

  // Initialize deliveredOrderCount BEFORE using it
  let deliveredOrderCount = deliveredShipments.length;

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
      deliveredOrderCount = deliveredShipments.length; // Update count
    } else {
      // If still no matches, use ALL shipments for revenue calculation
      console.log(`⚠️  No shipments match any delivery criteria, using ALL shipments for revenue calculation`);
      deliveredShipments.length = 0;
      deliveredShipments.push(...shiprocketShipments);
      deliveredOrderCount = shiprocketShipments.length; // Update count
    }
  }

  // Calculate revenue and COGS from delivered shipments
  let shiprocketRevenue = 0;
  let shiprocketCogs = 0;
  // deliveredOrderCount already declared above
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

  // COGS - Calculate from delivered orders using onboarding product costs
  shiprocketCogs = 0;

  console.log(`\n🔍 COGS CALCULATION (Delivered Orders):`);
  console.log(`   Delivered shipments: ${deliveredShipments.length}`);
  console.log(`   Shopify orders available: ${orders.length}`);
  console.log(`   Products available: ${products.length}`);
  console.log(`   Onboarding data exists: ${!!onboardingData}`);

  // Build product cost map from onboarding (primary) and products table (fallback)
  const productCostMap = new Map();

  // First, load from onboarding step3 (most accurate)
  if (onboardingData && onboardingData.step3 && onboardingData.step3.productCosts) {
    Object.entries(onboardingData.step3.productCosts).forEach(([productId, cost]) => {
      const numericCost = parseFloat(cost) || 0;
      if (numericCost > 0) {
        productCostMap.set(productId.toString(), numericCost);
        console.log(`   ✅ Onboarding: Product ${productId}: Cost = ₹${numericCost}`);
      }
    });
  }

  // Fallback to products table
  products.forEach(p => {
    const productId = p.productId?.toString();
    if (productId && !productCostMap.has(productId) && p.manufacturingCost) {
      const cost = parseFloat(p.manufacturingCost) || 0;
      if (cost > 0) {
        productCostMap.set(productId, cost);
        console.log(`   📦 Products table: Product ${productId}: Cost = ₹${cost}`);
      }
    }
  });

  console.log(`   Total products with costs: ${productCostMap.size}`);

  // Calculate COGS for delivered orders
  deliveredShipments.forEach((shipment, index) => {
    const channelOrderId = shipment.channelOrderId || shipment.channel_order_id || shipment.orderId;

    if (!channelOrderId) return;

    // Find matching Shopify order
    const shopifyOrder = orders.find(o =>
      o.name === channelOrderId ||
      o.id?.toString() === channelOrderId?.toString() ||
      o.orderNumber?.toString() === channelOrderId?.toString()
    );

    if (!shopifyOrder || !shopifyOrder.lineItems) return;

    // Calculate COGS for this order's line items
    let orderCogs = 0;
    shopifyOrder.lineItems.forEach(item => {
      const productId = item.product_id?.toString();
      const quantity = item.quantity || 0;
      const unitCost = productCostMap.get(productId) || 0;

      orderCogs += unitCost * quantity;

      if (index < 3 && unitCost > 0) {
        console.log(`   Order ${channelOrderId}: Product ${productId} × ${quantity} = ₹${unitCost * quantity}`);
      }
    });

    shiprocketCogs += orderCogs;
  });

  console.log(`   ✅ Total COGS (Delivered Orders): ₹${shiprocketCogs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);

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

  // Calculate prepaid revenue for payment gateway fees
  let shiprocketPrepaidRevenue = 0;
  deliveredShipments.forEach((shipment, index) => {
    // Check if this is a prepaid order
    const paymentMethod = (shipment.paymentMethod || '').toLowerCase();
    const isPrepaid = paymentMethod === 'prepaid';

    if (isPrepaid) {
      // Get revenue from Shiprocket API data - try multiple field names
      let shipmentRevenue = 0;

      if (shipment.total && shipment.total > 0) {
        shipmentRevenue = parseFloat(shipment.total);
      } else if (shipment.orderValue && shipment.orderValue > 0) {
        shipmentRevenue = parseFloat(shipment.orderValue);
      } else if (shipment.totalAmount && shipment.totalAmount > 0) {
        shipmentRevenue = parseFloat(shipment.totalAmount);
      } else if (shipment.amount && shipment.amount > 0) {
        shipmentRevenue = parseFloat(shipment.amount);
      } else if (shipment.price && shipment.price > 0) {
        shipmentRevenue = parseFloat(shipment.price);
      } else if (shipment.order_value && shipment.order_value > 0) {
        shipmentRevenue = parseFloat(shipment.order_value);
      } else if (shipment.total_amount && shipment.total_amount > 0) {
        shipmentRevenue = parseFloat(shipment.total_amount);
      }

      shiprocketPrepaidRevenue += shipmentRevenue;
    }
  });

  console.log(`💳 Shiprocket Payment Gateway Calculation: Total Revenue: ₹${shiprocketRevenue}, Prepaid Revenue: ₹${shiprocketPrepaidRevenue}`);

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
  // Add null check for businessExpenses
  if (!businessExpenses) {
    businessExpenses = {
      agencyFees: 0,
      rtoHandlingFees: 0,
      staffFees: 0,
      officeRent: 0,
      otherExpenses: 0,
      paymentGatewayFeePercent: 2.5
    };
  }
  
  const daysInPeriod = Math.ceil((new Date() - new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) / (1000 * 60 * 60 * 24));
  const monthlyMultiplier = daysInPeriod / 30;

  const agencyFees = (businessExpenses.agencyFees || 0) * monthlyMultiplier;
  const rtoHandlingFees = (businessExpenses.rtoHandlingFees || 0) * monthlyMultiplier;
  const staffFees = (businessExpenses.staffFees || 0) * monthlyMultiplier;
  const officeRent = (businessExpenses.officeRent || 0) * monthlyMultiplier;
  const otherBusinessExpenses = (businessExpenses.otherExpenses || 0) * monthlyMultiplier;
  const paymentGatewayFees = shiprocketPrepaidRevenue * ((businessExpenses.paymentGatewayFeePercent || 2.5) / 100);

  const totalBusinessExpenses = agencyFees + rtoHandlingFees + staffFees + officeRent + otherBusinessExpenses + paymentGatewayFees;

  // Profit calculations
  const grossProfit = shiprocketRevenue - shiprocketCogs;
  const netProfit = shiprocketRevenue - (shiprocketCogs + adSpend + shippingCost + totalBusinessExpenses);

  // Calculate Meta ROAS (using Meta's attributed revenue from conversion tracking)
  const metaRevenue = metaInsights.reduce((sum, i) => sum + (i.metaRevenue || 0), 0);
  const metaROAS = adSpend > 0 && metaRevenue > 0 ? metaRevenue / adSpend : 0;

  // Blended ROAS (using total Shopify revenue - includes all channels)
  const blendedROAS = adSpend > 0 ? shiprocketRevenue / adSpend : 0;

  // Use Meta ROAS if available (more accurate), otherwise use blended
  const roas = metaRevenue > 0 ? metaROAS : blendedROAS;

  // Metrics
  const grossProfitMargin = shiprocketRevenue > 0 ? (grossProfit / shiprocketRevenue) * 100 : 0;
  const netProfitMargin = shiprocketRevenue > 0 ? (netProfit / shiprocketRevenue) * 100 : 0;
  const aov = deliveredOrderCount > 0 ? shiprocketRevenue / deliveredOrderCount : 0;
  const deliveryRate = shiprocketShipments.length > 0 ? (deliveredOrderCount / shiprocketShipments.length) * 100 : 0;
  const cpp = deliveredOrderCount > 0 ? adSpend / deliveredOrderCount : 0;
  const poas = adSpend > 0 ? netProfit / adSpend : 0;

  console.log(`📦 Shiprocket Summary Calculations:`, {
    shiprocketRevenue,
    deliveredOrderCount,
    grossProfit,
    netProfit,
    deliveryRate: `${deliveryRate.toFixed(2)}%`,
    metaRevenue,
    metaROAS: metaROAS.toFixed(2),
    blendedROAS: blendedROAS.toFixed(2),
    usingMetaROAS: metaRevenue > 0
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
    { title: 'Shipping Per Order', value: `₹${deliveredOrderCount > 0 ? (shippingCost / deliveredOrderCount).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}`, formula: 'Shipping Cost / Delivered Orders' },
    { title: 'Ad Spend', value: `₹${adSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total marketing spend' },
    { title: 'Business Expenses', value: `₹${totalBusinessExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Agency + Gateway + Staff + Rent + Other' },

    // Profit Metrics
    { title: 'Gross Profit', value: `₹${grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Revenue - COGS' },
    { title: 'Net Profit', value: `₹${netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Revenue - (COGS + Ad Spend + Shipping + Business Expenses)' },
    { title: 'Gross Profit Margin', value: `${grossProfitMargin.toFixed(2)}%`, formula: '(Gross Profit / Revenue) × 100' },
    { title: 'Net Profit Margin', value: `${netProfitMargin.toFixed(2)}%`, formula: '(Net Profit / Revenue) × 100' },
    { title: 'Net Profit Per Order', value: `₹${deliveredOrderCount > 0 ? (netProfit / deliveredOrderCount).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}`, formula: 'Net Profit / Delivered Orders' },

    // Marketing Metrics
    { title: 'ROAS', value: roas.toFixed(2), formula: metaRevenue > 0 ? 'Meta Attributed Revenue ÷ Ad Spend' : 'Total Revenue ÷ Ad Spend', subtitle: metaRevenue > 0 ? 'From Meta conversion tracking' : 'Blended (all channels)' },
    { title: 'POAS', value: poas.toFixed(2), formula: 'Net Profit ÷ Ad Spend' },
    { title: 'Cost per Purchase', value: `₹${cpp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Ad Spend ÷ Delivered Orders' },

    // Shipping Performance
    { title: 'Total Shipments', value: shiprocketShipments.length.toLocaleString('en-IN'), formula: 'All Shiprocket shipments in date range' },
    { title: 'Pending Deliveries', value: (shiprocketShipments.length - deliveredOrderCount).toLocaleString('en-IN'), formula: 'Total Shipments - Delivered Orders' }
  ];
}

/**
 * Generates daily performance data for Shiprocket shipments.
 * Used for the performance chart in the Shiprocket dashboard.
 * @param {Array} shiprocketShipments - Raw shipment data.
 * @param {string} startDate - Start date (YYYY-MM-DD).
 * @param {string} endDate - End date (YYYY-MM-DD).
 * @returns {Array} Array of daily data points (revenue, costs, profit) sorted by date.
 */
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

/**
 * Calculates financial breakdown (Revenue vs Costs) specifically for Shiprocket.
 * Used for the pie chart and list breakdown in the Shiprocket dashboard.
 * @param {Array} orders - Shopify orders.
 * @param {Array} products - Shopify products.
 * @param {Array} metaInsights - Meta ads data.
 * @param {Array} shiprocketShipments - Raw shipment data.
 * @param {object} onboardingData - Manual product costs.
 * @param {object} businessExpenses - Fixed business expenses.
 * @returns {object} Object containing revenue, pieData array, and list array.
 */
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
  let shiprocketPrepaidRevenue = 0;
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

      // Check if this is a prepaid order
      const paymentMethod = (shipment.paymentMethod || '').toLowerCase();
      if (paymentMethod === 'prepaid') {
        shiprocketPrepaidRevenue += shipmentRevenue;
      }
    }
  });

  // COGS - Calculate from delivered orders using onboarding product costs
  console.log(`\n🔍 COGS CALCULATION for Financial Breakdown (Delivered Orders):`);
  console.log(`   Delivered shipments: ${deliveredShipments.length}`);
  console.log(`   Products available: ${products.length}`);
  console.log(`   Onboarding data exists: ${!!onboardingData}`);

  // Build product cost map from onboarding (primary) and products table (fallback)
  const productCostMap = new Map();

  // First, load from onboarding step3 (most accurate)
  if (onboardingData && onboardingData.step3 && onboardingData.step3.productCosts) {
    Object.entries(onboardingData.step3.productCosts).forEach(([productId, cost]) => {
      const numericCost = parseFloat(cost) || 0;
      if (numericCost > 0) {
        productCostMap.set(productId.toString(), numericCost);
        console.log(`   ✅ Onboarding: Product ${productId}: Cost = ₹${numericCost}`);
      }
    });
  }

  // Fallback to products table
  products.forEach(p => {
    const productId = p.productId?.toString();
    if (productId && !productCostMap.has(productId) && p.manufacturingCost) {
      const cost = parseFloat(p.manufacturingCost) || 0;
      if (cost > 0) {
        productCostMap.set(productId, cost);
        console.log(`   📦 Products table: Product ${productId}: Cost = ₹${cost}`);
      }
    }
  });

  console.log(`   Total products with costs: ${productCostMap.size}`);

  // Calculate COGS for delivered orders
  // Optimization: Create Map for faster Order lookup
  const shopifyOrderMap = new Map();
  if (orders) {
    orders.forEach(o => {
      if (o.name) shopifyOrderMap.set(o.name, o);
      if (o.id) shopifyOrderMap.set(o.id.toString(), o);
      if (o.orderNumber) shopifyOrderMap.set(o.orderNumber.toString(), o);
    });
  }

  deliveredShipments.forEach((shipment, index) => {
    const channelOrderId = shipment.channelOrderId || shipment.channel_order_id || shipment.orderId;

    if (!channelOrderId) return;

    // Find matching Shopify order using Map (O(1))
    const shopifyOrder = shopifyOrderMap.get(channelOrderId) ||
      (channelOrderId && shopifyOrderMap.get(channelOrderId.toString()));

    if (!shopifyOrder || !shopifyOrder.lineItems) return;

    // Calculate COGS for this order's line items
    let orderCogs = 0;
    shopifyOrder.lineItems.forEach(item => {
      const productId = item.product_id?.toString();
      const quantity = item.quantity || 0;
      const unitCost = productCostMap.get(productId) || 0;

      orderCogs += unitCost * quantity;

      if (index < 3 && unitCost > 0) {
        console.log(`   Order ${channelOrderId}: Product ${productId} × ${quantity} = ₹${unitCost * quantity}`);
      }
    });

    shiprocketCogs += orderCogs;
  });

  console.log(`   ✅ Total COGS (Delivered Orders): ₹${shiprocketCogs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);

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
  const paymentGatewayFees = shiprocketPrepaidRevenue * ((businessExpenses.paymentGatewayFeePercent || 2.5) / 100);

  console.log(`📦 Shiprocket Financial Breakdown - Revenue: ₹${shiprocketRevenue}, Prepaid: ₹${shiprocketPrepaidRevenue} from ${deliveredShipments.length || shiprocketShipments.length} shipments`);

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

/**
 * Calculates the daily portion of business expenses for a single day/order.
 * Used to distribute monthly fixed costs (rent, staff) across daily performance data.
 * @param {object} order - The specific order (used to calculate variable gateway fees).
 * @param {object} businessExpenses - Monthly fixed expense configuration.
 * @returns {number} valid daily expense amount.
 */
function calculateDailyBusinessExpenses(order, businessExpenses) {
  if (!businessExpenses) return 0;

  // Monthly expenses converted to daily
  const dailyAgencyFees = (businessExpenses.agencyFees || 0) / 30;
  const dailyRtoHandlingFees = (businessExpenses.rtoHandlingFees || 0) / 30;
  const dailyStaffFees = (businessExpenses.staffFees || 0) / 30;
  const dailyOfficeRent = (businessExpenses.officeRent || 0) / 30;
  const dailyOtherExpenses = (businessExpenses.otherExpenses || 0) / 30;

  // Payment gateway fees (percentage of PREPAID revenue only)
  let paymentGatewayFees = 0;
  if (order) {
    const gateway = (order.gateway || '').toLowerCase();
    const paymentMethod = (order.paymentMethod || '').toLowerCase();

    // Consider as prepaid if gateway is not COD or cash_on_delivery
    const isPrepaid = gateway !== 'cod' &&
      gateway !== 'cash_on_delivery' &&
      paymentMethod !== 'cod' &&
      paymentMethod !== 'cash_on_delivery';

    if (isPrepaid) {
      const revenue = parseFloat(order.currentTotalPrice || order.totalPrice || 0);
      paymentGatewayFees = revenue * ((businessExpenses.paymentGatewayFeePercent || 2.5) / 100);
    }
  }

  return dailyAgencyFees + dailyRtoHandlingFees + dailyStaffFees + dailyOfficeRent + dailyOtherExpenses + paymentGatewayFees;
}

/**
 * Generates daily performance data for Shopify orders.
 * Used for the performance chart in the main dashboard.
 * @param {Array} shopifyOrders - Shopify orders.
 * @param {string} startDate - Start date (YYYY-MM-DD).
 * @param {string} endDate - End date (YYYY-MM-DD).
 * @param {object} businessExpenses - Business expense configuration.
 * @returns {Array} Array of daily data points (revenue, costs, profit) sorted by date.
 */
function calculatePerformanceData(shopifyOrders, startDate, endDate, businessExpenses) {
  if (!shopifyOrders || shopifyOrders.length === 0) {
    return [];
  }

  // Group orders by date
  const ordersByDate = new Map();

  // Filter valid orders (exclude cancelled/voided)
  const validOrders = shopifyOrders.filter(order => {
    const status = (order.financialStatus || '').toLowerCase();
    return status !== 'voided' && status !== 'cancelled';
  });

  validOrders.forEach(order => {
    const dateStr = (order.createdAt || order.processedAt || '').split('T')[0];
    if (!dateStr) return;

    // Calculate order revenue using the standard formula
    const grossSales = parseFloat(order.currentSubtotalPrice || order.subtotalPrice || 0) +
      parseFloat(order.currentTotalDiscounts || order.totalDiscounts || 0);
    const discounts = parseFloat(order.currentTotalDiscounts || order.totalDiscounts || 0);
    const returns = parseFloat(order.totalRefunded || 0);
    const netSales = grossSales - discounts - returns;
    const shipping = parseFloat(order.totalShippingPrice || order.shippingLines?.[0]?.price || 0);
    const taxes = parseFloat(order.currentTotalTax || order.totalTax || 0);
    const duties = parseFloat(order.currentTotalDutiesSet?.shopMoney?.amount || order.totalDutiesSet?.shopMoney?.amount || 0);
    const fees = parseFloat(order.currentTotalAdditionalFeesSet?.shopMoney?.amount || order.totalAdditionalFeesSet?.shopMoney?.amount || 0);

    const revenue = netSales + shipping + taxes + duties + fees;

    const existing = ordersByDate.get(dateStr);
    if (existing) {
      existing.revenue += revenue;
      existing.orders += 1;
    } else {
      ordersByDate.set(dateStr, {
        date: dateStr,
        revenue,
        orders: 1
      });
    }
  });

  // Calculate daily business expenses (distributed evenly across days)
  const daysCount = ordersByDate.size || 1;
  const monthlyExpenses =
    (businessExpenses.agencyFees || 0) +
    (businessExpenses.rtoHandlingFees || 0) +
    (businessExpenses.staffFees || 0) +
    (businessExpenses.officeRent || 0) +
    (businessExpenses.otherExpenses || 0);
  const dailyExpenses = monthlyExpenses / 30;

  // Convert to array and add cost calculations
  const data = Array.from(ordersByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => {
      // Estimate daily costs (can be enhanced with actual COGS)
      const estimatedCosts = dailyExpenses + (item.revenue * 0.02); // 2% gateway fees estimate
      const netProfit = item.revenue - estimatedCosts;

      return {
        name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: Math.round(item.revenue),
        totalCosts: Math.round(estimatedCosts),
        netProfit: Math.round(netProfit),
        netProfitMargin: item.revenue > 0 ? Math.round((netProfit / item.revenue) * 100) : 0,
        orders: item.orders
      };
    });

  console.log(`📊 Performance data: ${data.length} data points from ${validOrders.length} orders`);
  return data;
}

/**
 * Calculates the main dashboard summary metrics (Shopify focus).
 * Includes Total Revenue, Net Profit, Ad Spend, and RTO metrics.
 * @param {Array} orders - Shopify orders.
 * @param {Array} products - Shopify products.
 * @param {Array} metaInsights - Meta ads data.
 * @param {Array} shiprocketShipments - Shiprocket shipments (for RTO/Shipping costs).
 * @param {object} onboardingData - Product costs.
 * @param {object} businessExpenses - Fixed expenses.
 * @returns {Array} Array of summary cards for the dashboard.
 */
/**
 * Calculates the main dashboard summary metrics (Shopify focus).
 * Includes Total Revenue, Net Profit, Ad Spend, and RTO metrics.
 * OPTIMIZED: Uses pre-processed data.
 * @param {Array} validOrders - Pre-filtered valid Shopify orders.
 * @param {Array} uniqueOrders - Deduplicated Shopify orders (for total counts).
 * @param {Map} productMap - Pre-computed product cost map.
 * @param {Array} metaInsights - Meta ads data.
 * @param {Array} shiprocketShipments - Shiprocket shipments (for RTO/Shipping costs).
 * @param {object} businessExpenses - Fixed expenses.
 * @returns {Array} Array of summary cards for the dashboard.
 */
function calculateSummary(validOrders, uniqueOrders, productMap, metaInsights, shiprocketShipments, businessExpenses) {

  // console.log(`📦 Loaded ${productMap.size} product costs from onboarding`);

  // Count cancelled orders separately (refunded, voided, cancelled status)
  const cancelledOrders = uniqueOrders.filter(order => {
    const financialStatus = (order.financialStatus || '').toLowerCase();
    const isTest = order.test === true;
    const isDraft = !order.name && !order.orderNumber;
    
    // Don't count test or draft orders
    if (isTest || isDraft) return false;
    
    return financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled';
  }).length;

  // Total orders = all real orders (excluding test/draft but INCLUDING cancelled)
  // This matches Shopify's "Total Orders" which includes cancelled
  const totalOrders = uniqueOrders.filter(order => {
    const isTest = order.test === true;
    const isDraft = !order.name && !order.orderNumber;
    return !isTest && !isDraft;
  }).length;

  /* 
  // Optional: Detailed Status Breakdown (Can be enabled for debugging)
  const statusBreakdown = {};
  uniqueOrders.forEach(order => {
    const status = order.financialStatus || 'unknown';
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
  });
  console.log(`\n📊 Financial Status Breakdown (All Orders):`, statusBreakdown);
  */

  // Calculate revenue by simply summing currentTotalPrice (already includes everything)
  const revenue = validOrders.reduce((sum, order) => {
    return sum + parseFloat(order.currentTotalPrice || order.totalPrice || 0);
  }, 0);

  console.log(`   📊 Revenue Calculation (Simplified):`);
  console.log(`      Total Orders: ${totalOrders}`);
  console.log(`      Valid Orders (excl. cancelled): ${validOrders.length}`);
  console.log(`      Cancelled Orders: ${cancelledOrders}`);
  console.log(`      Revenue (sum of currentTotalPrice): ₹${revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ⭐`);

  // Calculate Payment Type Breakdown (Prepaid vs COD)
  const prepaidGateways = ['shopify_payments', 'razorpay', 'payu', 'stripe', 'paypal', 'phonepe', 'paytm', 'gpay'];
  const validPrepaidOrders = validOrders.filter(order => {
    const gateway = (order.gateway || order.paymentMethod || '').toLowerCase();
    return prepaidGateways.some(pg => gateway.includes(pg)) || gateway.includes('prepaid');
  });
  const validCodOrders = validOrders.filter(order => {
    const gateway = (order.gateway || order.paymentMethod || '').toLowerCase();
    return gateway.includes('cod') || gateway.includes('cash');
  });
  const validCodOrdersCount = validCodOrders.length;

  // Calculate prepaid metrics
  let prepaidGrossSales = 0;
  let prepaidNetSales = 0;
  let prepaidRevenue = 0;
  validPrepaidOrders.forEach(order => {
    const orderGross = parseFloat(order.currentSubtotalPrice || 0) + parseFloat(order.currentTotalDiscounts || order.totalDiscounts || 0);
    const orderDiscount = parseFloat(order.currentTotalDiscounts || order.totalDiscounts || 0);
    const orderReturns = parseFloat(order.totalRefunded || 0);
    const orderNet = orderGross - orderDiscount - orderReturns;
    const orderShipping = parseFloat(order.totalShippingPrice || order.shippingLines?.[0]?.price || 0);
    const orderTax = parseFloat(order.currentTotalTax || order.totalTax || 0);
    const orderDuties = parseFloat(order.currentTotalDutiesSet?.shopMoney?.amount || order.totalDutiesSet?.shopMoney?.amount || 0);
    const orderFees = parseFloat(order.currentTotalAdditionalFeesSet?.shopMoney?.amount || order.totalAdditionalFeesSet?.shopMoney?.amount || 0);

    prepaidGrossSales += orderGross;
    prepaidNetSales += orderNet;
    prepaidRevenue += orderNet + orderShipping + orderTax + orderDuties + orderFees;
  });

  // Calculate COD metrics
  let codRevenue = 0;
  validCodOrders.forEach(order => {
    const orderGross = parseFloat(order.currentSubtotalPrice || 0) + parseFloat(order.currentTotalDiscounts || order.totalDiscounts || 0);
    const orderDiscount = parseFloat(order.currentTotalDiscounts || order.totalDiscounts || 0);
    const orderReturns = parseFloat(order.totalRefunded || 0);
    const orderNet = orderGross - orderDiscount - orderReturns;
    const orderShipping = parseFloat(order.totalShippingPrice || order.shippingLines?.[0]?.price || 0);
    const orderTax = parseFloat(order.currentTotalTax || order.totalTax || 0);
    const orderDuties = parseFloat(order.currentTotalDutiesSet?.shopMoney?.amount || order.totalDutiesSet?.shopMoney?.amount || 0);
    const orderFees = parseFloat(order.currentTotalAdditionalFeesSet?.shopMoney?.amount || order.totalAdditionalFeesSet?.shopMoney?.amount || 0);

    codRevenue += orderNet + orderShipping + orderTax + orderDuties + orderFees;
  });

  // Calculate COGS (Cost of Goods Sold) from product costs
  let cogs = 0;
  validOrders.forEach(order => {
    if (order.lineItems) {
      order.lineItems.forEach(item => {
        const productId = item.productId?.toString() || item.product_id?.toString();
        const cost = productMap.get(productId) || 0;
        const quantity = parseInt(item.quantity || 1);
        cogs += cost * quantity;
      });
    }
  });

  // Calculate Ad Spend from Meta Insights
  const adSpend = metaInsights.reduce((sum, insight) => sum + parseFloat(insight.adSpend || insight.spend || 0), 0);

  console.log(`   4. Payment Breakdown (Source for Gateway Fees):`);
  console.log(`      Prepaid Orders: ${validPrepaidOrders.length} (Revenue: ₹${prepaidRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })})`);
  console.log(`         - Gross Sales:  ₹${prepaidGrossSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
  console.log(`         - Net Sales:    ₹${prepaidNetSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
  console.log(`      COD Orders:     ${validCodOrdersCount} (Revenue: ₹${codRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })})`);


  console.log(`   Total Orders: ${totalOrders}`);
  console.log(`   Average Order Value: ₹${totalOrders > 0 ? (revenue / totalOrders).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : 0}`);

  // Debug: Compare with currentTotalPrice
  const currentTotalPriceSum = validOrders.reduce((sum, o) => sum + parseFloat(o.currentTotalPrice || 0), 0);
  const difference = currentTotalPriceSum - revenue;

  console.log(`\n🔍 Comparison with currentTotalPrice:`);
  console.log(`   currentTotalPrice sum: ₹${currentTotalPriceSum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`   Manual calculation: ₹${revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`   Difference: ₹${difference.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);

  console.log(`\n📊 ========== REVENUE CALCULATION DEBUG ==========`);
  console.log(`📊 Order & Revenue Summary:`);
  console.log(`   Total Shopify orders (all): ${uniqueOrders.length}`);
  console.log(`   Cancelled/Voided orders: ${cancelledOrders}`);
  console.log(`   Valid orders (excluding cancelled): ${totalOrders}`);
  console.log(`   Revenue from valid orders: ₹${revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
  console.log(`================================================\n`);

  // Show orders with significant differences
  const ordersWithDifferences = validOrders.filter(order => {
    const currentTotal = parseFloat(order.currentTotalPrice || 0);
    const total = parseFloat(order.totalPrice || 0);
    return Math.abs(currentTotal - total) > 10; // More than ₹10 difference
  });

  if (ordersWithDifferences.length > 0) {
    console.log(`\n⚠️  Found ${ordersWithDifferences.length} orders with significant differences (>₹10):`);
    ordersWithDifferences.slice(0, 10).forEach((order, idx) => {
      const currentTotal = parseFloat(order.currentTotalPrice || 0);
      const total = parseFloat(order.totalPrice || 0);
      const diff = currentTotal - total;
      console.log(`   ${idx + 1}. Order ${order.name}: Diff = ₹${diff.toFixed(2)} (Current: ₹${currentTotal.toFixed(2)}, Original: ₹${total.toFixed(2)})`);
    });
  }


  // Shipping Cost - Get actual freight charges from Shiprocket (not total charges)
  let shippingCost = 0;
  if (shiprocketShipments && shiprocketShipments.length > 0) {
    shippingCost = shiprocketShipments.reduce((sum, s) => {
      // Only use freight_charges (actual shipping cost), not totalCharges
      return sum + parseFloat(s.freight_charges || s.freightCharges || 0);
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
  const paymentGatewayFees = prepaidRevenue * ((businessExpenses.paymentGatewayFeePercent || 2.5) / 100);

  const totalBusinessExpenses = agencyFees + rtoHandlingFees + staffFees + officeRent + otherBusinessExpenses + paymentGatewayFees;

  console.log(`📊 Financial Breakdown - Shopify Revenue: ${revenue}, COGS: ${cogs}, Ad Spend: ${adSpend}, Shipping: ${shippingCost}, Business Expenses: ${totalBusinessExpenses}`);

  // Calculate Net Profit
  const netProfit = revenue - cogs - adSpend - shippingCost - totalBusinessExpenses;
  const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const netProfitPerOrder = totalOrders > 0 ? netProfit / totalOrders : 0;

  // Calculate Meta ROAS (using Meta's attributed revenue from conversion tracking)
  const metaRevenue = metaInsights.reduce((sum, i) => sum + (i.metaRevenue || 0), 0);
  const metaROAS = adSpend > 0 && metaRevenue > 0 ? metaRevenue / adSpend : 0;

  // Blended ROAS (using total Shopify revenue - includes all channels)
  const blendedROAS = adSpend > 0 ? revenue / adSpend : 0;

  // Use Meta ROAS if available (more accurate), otherwise use blended
  const roas = metaRevenue > 0 ? metaROAS : blendedROAS;
  const poas = adSpend > 0 ? netProfit / adSpend : 0;

  console.log(`📊 ROAS Calculation:`, {
    metaRevenue,
    metaROAS: metaROAS.toFixed(2),
    blendedROAS: blendedROAS.toFixed(2),
    finalROAS: roas.toFixed(2),
    usingMetaROAS: metaRevenue > 0
  });

  // RTO Logic (from Shiprocket)
  const rtoCount = shiprocketShipments ? shiprocketShipments.filter(s => (s.status || '').toLowerCase().includes('rto')).length : 0;
  const inTransitCount = shiprocketShipments ? shiprocketShipments.filter(s =>
    !['delivered', 'rto', 'cancelled', 'lost'].some(st => (s.status || '').toLowerCase().includes(st))
  ).length : 0;

  // RTO Revenue Lost (Estimate: AOV * RTO Count)
  const aov = totalOrders > 0 ? revenue / totalOrders : 0;
  const rtoRevenueLost = rtoCount * aov;
  
  console.log(`📊 RTO Revenue Lost Calculation:`, {
    rtoCount,
    totalOrders,
    revenue,
    aov: aov.toFixed(2),
    rtoRevenueLost: rtoRevenueLost.toFixed(2)
  });

  // Risk Level
  let riskLevel = 'green';
  let riskValue = 'Low Risk';
  if (netProfit < 0) {
    riskLevel = 'red';
    riskValue = 'High Risk';
  } else if (poas > 0 && poas < 1) {
    riskLevel = 'yellow';
    riskValue = 'Medium Risk';
  }

  // Determine decision based on stats
  let decision = 'Scale Carefully';
  let decisionColor = 'text-yellow-400';
  if (poas > 2) { decision = 'Scale Aggressively'; decisionColor = 'text-emerald-400'; }
  else if (poas < 1) { decision = 'Stop Scaling'; decisionColor = 'text-red-500'; }

  return [
    { title: 'Revenue Generated', value: `₹${revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, subtitle: 'Gross - Discounts - Returns' },
    { title: 'Net Profit', value: `₹${netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, subtitle: 'After all expenses', formula: 'Revenue - COGS - Ad Spend - Shipping - Business Expenses' },
    { title: 'Net Profit Margin', value: `${netProfitMargin.toFixed(2)}%`, formula: '(Net Profit ÷ Revenue) × 100' },
    { title: 'Ad Spend', value: `₹${adSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
    { title: 'ROAS', value: `${roas.toFixed(2)}`, formula: metaRevenue > 0 ? 'Meta Attributed Revenue ÷ Ad Spend' : 'Total Revenue ÷ Ad Spend' },
    { title: 'POAS', value: `${poas.toFixed(2)}`, formula: 'Net Profit ÷ Ad Spend' },
    { title: 'Total Orders', value: totalOrders },
    { title: 'Cancelled Orders', value: cancelledOrders },
    { title: 'RTO Count', value: rtoCount },
    { title: 'Net Profit Per Order', value: `₹${netProfitPerOrder.toFixed(0)}` },
    { title: 'Shipping Cost', value: `₹${shippingCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
    { title: 'RTO Handling', value: `₹${rtoHandlingFees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
    { title: 'Gateway Fees', value: `₹${paymentGatewayFees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
    { title: 'Fixed Costs', value: `₹${(agencyFees + staffFees + officeRent + otherBusinessExpenses).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
    { title: 'RTO Revenue Lost', value: `₹${rtoRevenueLost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
    { title: 'In-Transit Orders', value: inTransitCount },
    { title: 'Expected Delivery', value: inTransitCount },
    { title: 'Expected Revenue', value: `₹${(inTransitCount * (totalOrders > 0 ? revenue / totalOrders : 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
    { title: 'Risk Level', value: riskValue, riskColor: riskLevel },
    { title: 'Decision', value: decision, decisionColor: decisionColor }
  ];
}

/**
 * Calculates Marketing metrics (ROAS, CTR, Spend) from Meta Insights.
 * @param {Array} metaInsights - meta ads data.
 * @param {Array} orders - Shopify orders (for revenue calculation in ROAS).
 * @returns {Array} Array of marketing metric cards.
 */
function calculateMarketingMetrics(metaInsights, orders) {
  const totalSpend = metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
  const totalReach = metaInsights.reduce((sum, insight) => sum + (insight.reach || 0), 0);
  const totalClicks = metaInsights.reduce((sum, insight) => sum + (insight.linkClicks || 0), 0);
  // Use currentTotalPrice for Shopify's "Total Sales" (includes everything after adjustments)
  // Calculate revenue using consistent formula: Net Sales + Shipping + Duties + Fees + Taxes
  // Gross Sales = Subtotal + Discounts (Restored definition)
  const revenue = orders.reduce((sum, order) => {
    const grossSales = parseFloat(order.currentSubtotalPrice || order.subtotalPrice || 0) + parseFloat(order.currentTotalDiscounts || order.totalDiscounts || 0);
    const discounts = parseFloat(order.currentTotalDiscounts || order.totalDiscounts || 0);
    const returns = parseFloat(order.totalRefunded || 0);

    const netSales = grossSales - discounts - returns;

    const shipping = parseFloat(order.totalShippingPrice || order.shippingLines?.[0]?.price || 0);
    const taxes = parseFloat(order.currentTotalTax || order.totalTax || 0);
    const duties = parseFloat(order.currentTotalDutiesSet?.shopMoney?.amount || order.totalDutiesSet?.shopMoney?.amount || 0);
    const fees = parseFloat(order.currentTotalAdditionalFeesSet?.shopMoney?.amount || order.totalAdditionalFeesSet?.shopMoney?.amount || 0);

    return sum + (netSales + shipping + taxes + duties + fees);
  }, 0);

  // Calculate Meta ROAS (using Meta's attributed revenue from conversion tracking)
  const metaRevenue = metaInsights.reduce((sum, i) => sum + (i.metaRevenue || 0), 0);
  const metaROAS = totalSpend > 0 && metaRevenue > 0 ? metaRevenue / totalSpend : 0;

  // Blended ROAS (using total Shopify revenue - includes all channels)
  const blendedROAS = totalSpend > 0 ? revenue / totalSpend : 0;

  // Use Meta ROAS if available (more accurate), otherwise use blended
  const roas = metaRevenue > 0 ? metaROAS : blendedROAS;
  const ctr = totalReach > 0 ? (totalClicks / totalReach) * 100 : 0;

  return [
    { title: 'Total Spend', value: `₹${totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total marketing spend' },
    { title: 'ROAS', value: roas.toFixed(2), formula: metaRevenue > 0 ? 'Meta Attributed Revenue / Ad Spend' : 'Total Revenue / Ad Spend', subtitle: metaRevenue > 0 ? 'From Meta conversion tracking' : 'Blended (all channels)' },
    { title: 'Reach', value: totalReach.toLocaleString('en-IN'), formula: 'Total people reached' },
    { title: 'Link Clicks', value: totalClicks.toLocaleString('en-IN'), formula: 'Total link clicks' },
    { title: 'CTR', value: `${ctr.toFixed(2)}%`, formula: '(Link Clicks / Reach) × 100' }
  ];
}

/**
 * Generates data for the Marketing Performance chart.
 * Shows Spend vs Recall/Clicks over time.
 * @param {Array} metaInsights - Meta ads data.
 * @param {string} startDate - Start date.
 * @param {string} endDate - End date.
 * @returns {Array} Daily marketing performance data.
 */
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

/**
 * Calculates New vs Returning customer metrics over time.
 * @param {Array} orders - Shopify orders.
 * @param {string} startDate - Start date.
 * @param {string} endDate - End date.
 * @returns {Array} Daily customer type breakdown.
 */
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

/**
 * Calculates high-level website metrics like Total Customers, Orders Today.
 * @param {Array} orders - Shopify orders.
 * @param {Array} customers - Shopify customers.
 * @param {Array} metaInsights - Meta data.
 * @param {Array} shiprocketShipments - Shipping data.
 * @param {object} onboardingData - Product costs.
 * @param {object} businessExpenses - Fixed expenses.
 * @returns {Array} Array of website metric cards.
 */
/**
 * Calculates high-level website metrics like Total Customers, Orders Today.
 * OPTIMIZED: Uses pre-processed data.
 * @param {Array} validOrders - Pre-filtered valid Shopify orders.
 * @param {Array} uniqueOrders - Deduplicated Shopify orders (for customer counts).
 * @param {Map} productMap - Pre-computed product cost map.
 * @param {Array} metaInsights - Meta data.
 * @param {Array} shiprocketShipments - Shipping data.
 * @param {object} businessExpenses - Fixed expenses.
 * @returns {Array} Array of website metric cards.
 */
function calculateWebsiteMetrics(validOrders, uniqueOrders, productMap, metaInsights, shiprocketShipments, businessExpenses) {
  // console.log(`📊 Financial Breakdown - Calculating from Shopify orders only...`);

  // 1. Total Customers - Unique customers from ALL orders (including cancelled?)
  // Originally used 'orders', now leveraging uniqueOrders
  const uniqueCustomers = new Set();
  uniqueOrders.forEach(order => {
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
  // Uses passed productMap

  // Calculate total revenue and costs
  let revenue = 0;
  let cogs = 0;

  validOrders.forEach(order => {
    // Calculate revenue using consistent formula
    // Gross Sales = Subtotal + Discounts (Standard definition)
    const grossSales = parseFloat(order.currentSubtotalPrice || order.subtotalPrice || 0) + parseFloat(order.currentTotalDiscounts || order.totalDiscounts || 0);
    const discounts = parseFloat(order.currentTotalDiscounts || order.totalDiscounts || 0);
    const returns = parseFloat(order.totalRefunded || 0);

    const netSales = grossSales - discounts - returns;

    const shipping = parseFloat(order.totalShippingPrice || order.shippingLines?.[0]?.price || 0);
    const taxes = parseFloat(order.currentTotalTax || order.totalTax || 0);
    const duties = parseFloat(order.currentTotalDutiesSet?.shopMoney?.amount || order.totalDutiesSet?.shopMoney?.amount || 0);
    const fees = parseFloat(order.currentTotalAdditionalFeesSet?.shopMoney?.amount || order.totalAdditionalFeesSet?.shopMoney?.amount || 0);

    revenue += (netSales + shipping + taxes + duties + fees);

    (order.lineItems || []).forEach(item => {
      const productId = item.product_id?.toString();
      const unitCost = productMap.get(productId) || 0;
      const quantity = item.quantity || 0;
      cogs += unitCost * quantity;
    });
  });

  const adSpend = metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);

  // Shipping Cost - Get actual freight charges from Shiprocket (not total charges)
  let shippingCost = 0;
  if (shiprocketShipments && shiprocketShipments.length > 0) {
    shippingCost = shiprocketShipments.reduce((sum, s) => {
      // Only use freight_charges (actual shipping cost), not totalCharges
      return sum + parseFloat(s.freight_charges || s.freightCharges || 0);
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

/**
 * Calculates product profitability rankings (Best/Least Selling).
 * @param {Array} orders - Shopify orders.
 * @param {Array} products - Shopify products.
 * @param {Array} shiprocketShipments - Shipping data (unused but passed for consistency).
 * @param {object} onboardingData - Product costs.
 * @returns {object} Object containing bestSelling and leastSelling product arrays.
 */
/**
 * Calculates product profitability rankings (Best/Least Selling).
 * OPTIMIZED: Uses pre-processed data.
 * @param {Array} validOrders - Pre-filtered valid Shopify orders.
 * @param {Map} productMap - Pre-computed product cost map.
 * @returns {object} Object containing bestSelling and leastSelling product arrays.
 */
function calculateProductRankings(validOrders, productMap) {
  try {
    // console.log(`\n📦 PRODUCT PROFITABILITY CALCULATION STARTED`);

    const productSales = {};

    validOrders.forEach(order => {
      (order.lineItems || []).forEach(item => {
        const productId = item.product_id?.toString();
        const unitCost = productMap.get(productId) || 0;

        if (!productSales[productId]) {
          productSales[productId] = {
            id: productId,
            name: item.title || 'Unknown Product',
            sales: 0,
            total: 0,
            unitCost: unitCost
          };
        }

        productSales[productId].sales += item.quantity;
        productSales[productId].total += parseFloat(item.price || 0) * item.quantity;
      });
    });

    const sorted = Object.values(productSales).sort((a, b) => b.sales - a.sales);

    // console.log(`   Total unique products found: ${sorted.length}`);

    const result = {
      bestSelling: sorted.slice(0, 10).map(p => {
        const cogs = p.unitCost * p.sales;
        const netProfit = p.total - cogs;

        return {
          ...p,
          total: `₹${p.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
          cogs: cogs,
          netProfit: netProfit
        };
      }),
      leastSelling: sorted.slice(-5).reverse().map(p => {
        const cogs = p.unitCost * p.sales;
        const netProfit = p.total - cogs;

        return {
          ...p,
          total: `₹${p.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
          cogs: cogs,
          netProfit: netProfit
        };
      })
    };

    return result;

  } catch (error) {
    console.error(`❌ ERROR in calculateProductRankings:`, error);
    return {
      bestSelling: [],
      leastSelling: []
    };
  }
}

/**
 * Calculates shipping metrics (Delivered, RTO, In-Transit).
 * Uses Shiprocket data if available, otherwise estimates from Shopify.
 * @param {Array} shiprocketShipments - Shiprocket data.
 * @param {Array} orders - Shopify orders (fallback).
 * @returns {Array} Array of shipping metric cards.
 */
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

/**
 * Calculates breakdown of orders by payment type (Prepaid vs COD).
 * OPTIMIZED: Uses pre-processed valid orders.
 * @param {Array} validOrders - Pre-filtered valid Shopify orders.
 * @returns {Array} Pie chart data for order types.
 */
function calculateOrderTypeData(validOrders) {
  // If no orders, return empty array to avoid NaN in charts
  if (!validOrders || validOrders.length === 0) {
    return [];
  }

  // Use passed validOrders directly (no re-filtering needed)

  // Check payment method/gateway for more accurate Prepaid/COD classification
  // Using simple financialStatus='paid' is often correct but strict gateway check is better
  const prepaid = validOrders.filter(order => {
    const gateway = (order.gateway || '').toLowerCase();
    const paymentMethod = (order.paymentMethod || '').toLowerCase();

    const isCod = gateway === 'cod' ||
      gateway === 'cash_on_delivery' ||
      paymentMethod === 'cod' ||
      paymentMethod === 'cash_on_delivery';

    return !isCod; // If not COD, it's prepaid
  }).length;

  const cod = validOrders.length - prepaid;

  // Only include items with value > 0
  return [
    { name: 'Prepaid', value: prepaid, color: '#2d6a4f' },
    { name: 'COD', value: cod, color: '#52b788' }
  ].filter(item => item.value > 0);
}

/**
 * Calculates detailed financial breakdown for the main dashboard.
 * OPTIMIZED: Uses pre-processed data.
 * @param {Array} validOrders - Pre-filtered valid Shopify orders.
 * @param {Map} productMap - Pre-computed product cost map.
 * @param {Array} metaInsights - Meta ads data.
 * @param {Array} shiprocketShipments - Shiprocket data.
 * @param {object} businessExpenses - Fixed expenses.
 * @param {number} overrideShippingCost - Optional: Use this shipping cost instead of calculating
 * @returns {object} Breakdown object with revenue and cost components.
 */
function calculateFinancialBreakdown(validOrders, productMap, metaInsights, shiprocketShipments, businessExpenses, overrideShippingCost = null) {

  // console.log(`📊 Financial Breakdown - Calculating from pre-filtered orders...`);

  let revenue = 0;
  let cogs = 0;
  let orderCount = 0;

  // Calculate revenue and COGS from Shopify orders
  validOrders.forEach(order => {
    // Calculate revenue using consistent formula
    // Gross Sales = Subtotal + Discounts (Standard definition)
    const grossSales = parseFloat(order.currentSubtotalPrice || order.subtotalPrice || 0) + parseFloat(order.currentTotalDiscounts || order.totalDiscounts || 0);
    const discounts = parseFloat(order.currentTotalDiscounts || order.totalDiscounts || 0);
    const returns = parseFloat(order.totalRefunded || 0);
    const netSales = grossSales - discounts - returns;

    const shipping = parseFloat(order.totalShippingPrice || order.shippingLines?.[0]?.price || 0);
    const taxes = parseFloat(order.currentTotalTax || order.totalTax || 0);
    const duties = parseFloat(order.currentTotalDutiesSet?.shopMoney?.amount || order.totalDutiesSet?.shopMoney?.amount || 0);
    const fees = parseFloat(order.currentTotalAdditionalFeesSet?.shopMoney?.amount || order.totalAdditionalFeesSet?.shopMoney?.amount || 0);

    const orderRevenue = netSales + shipping + taxes + duties + fees;
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

  // Calculate prepaid revenue for payment gateway fees
  const prepaidRevenue = validOrders.reduce((sum, order) => {
    // Check if order is prepaid (not COD)
    const gateway = (order.gateway || '').toLowerCase();
    const paymentMethod = (order.paymentMethod || '').toLowerCase();

    // Consider as prepaid if gateway is not COD or cash_on_delivery
    const isPrepaid = gateway !== 'cod' &&
      gateway !== 'cash_on_delivery' &&
      paymentMethod !== 'cod' &&
      paymentMethod !== 'cash_on_delivery';

    if (isPrepaid) {
      return sum + parseFloat(order.currentTotalPrice || order.totalPrice || 0);
    }
    return sum;
  }, 0);

  // console.log(`📊 Financial Breakdown - Shopify Orders Revenue: ₹${revenue}, Prepaid: ₹${prepaidRevenue} from ${orderCount} orders`);

  // Ad Spend (A) = Total marketing spend
  const adSpend = metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);

  // Shipping Cost - Use override if provided (from Shiprocket dashboard), otherwise calculate
  let shippingCost = 0;
  if (overrideShippingCost !== null) {
    shippingCost = overrideShippingCost;
    console.log(`📦 Using override shipping cost: ₹${shippingCost.toFixed(2)}`);
  } else if (shiprocketShipments && shiprocketShipments.length > 0) {
    shippingCost = shiprocketShipments.reduce((sum, s) => {
      // Only use freight_charges (actual shipping cost), not totalCharges
      return sum + parseFloat(s.freight_charges || s.freightCharges || 0);
    }, 0);
  }

  // Calculate Business Expenses
  const daysInPeriod = Math.ceil((new Date() - new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) / (1000 * 60 * 60 * 24));
  const monthlyMultiplier = daysInPeriod / 30;

  const rtoCount = shiprocketShipments.filter(s => {
    const status = (s.shipmentStatus || s.status || '').toUpperCase();
    const code = s.statusCode;
    return status.includes('RTO') || code === 9;
  }).length;

  const totalRtoHandlingFees = rtoCount * (businessExpenses.rtoHandlingFees || 0);
  const paymentGatewayFees = prepaidRevenue * ((businessExpenses.paymentGatewayFeePercent || 2.5) / 100);

  const totalBusinessExpenses = ((businessExpenses.agencyFees || 0) * monthlyMultiplier) +
    totalRtoHandlingFees +
    ((businessExpenses.staffFees || 0) * monthlyMultiplier) +
    ((businessExpenses.officeRent || 0) * monthlyMultiplier) +
    ((businessExpenses.otherExpenses || 0) * monthlyMultiplier) +
    paymentGatewayFees;

  const totalCosts = cogs + adSpend + shippingCost + totalBusinessExpenses;
  const netProfit = revenue - totalCosts;

  // Breakdown for Pie Chart
  const pieData = [
    { name: 'Product Cost (COGS)', value: cogs, color: '#0d2923' },
    { name: 'Marketing (Ad Spend)', value: adSpend, color: '#2d6a4f' },
    { name: 'Shipping Cost', value: shippingCost, color: '#1a4037' },
    { name: 'Business Expenses', value: totalBusinessExpenses, color: '#40916c' }
  ].filter(item => item.value > 0);

  return {
    revenue,
    totalCosts,
    netProfit,
    cogs,
    adSpend,
    shippingCost,
    businessExpenses: totalBusinessExpenses,
    pieData
  };
}

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

    // OPTIMIZATION: Pre-process data once to avoid repeated loops
    // 1. Create Product Cost Map
    const productMap = new Map();
    if (onboardingData?.step3?.productCosts) {
      onboardingData.step3.productCosts.forEach(p => {
        if (p.productId) productMap.set(p.productId.toString(), parseFloat(p.cost) || 0);
      });
    }
    shopifyProducts.forEach(p => {
      if (p.productId && !productMap.has(p.productId.toString())) {
        productMap.set(p.productId.toString(), p.manufacturingCost || 0);
      }
    });

    // 2. Deduplicate Shopify Orders
    const uniqueOrdersMap = new Map();
    shopifyOrders.forEach(o => {
      const key = o.id ? o.id.toString() : (o.orderNumber ? o.orderNumber.toString() : null);
      if (key) uniqueOrdersMap.set(key, o);
    });
    const uniqueOrders = Array.from(uniqueOrdersMap.values());

    // 3. Filter Valid Orders (Strict Formula)
    const validOrders = uniqueOrders.filter(order => {
      const financialStatus = (order.financialStatus || '').toLowerCase();
      return !(financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled');
    });

    console.log(`📊 Shiprocket Data Optimization: Pre-processed ${shopifyOrders.length} orders -> ${validOrders.length} valid`);

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
  syncShopifyOrders,
  calculateShiprocketSummaryForChatbot: calculateShiprocketSummary
};
