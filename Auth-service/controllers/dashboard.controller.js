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
    
    // Check cache first (await since it's async)
    const cachedData = await getCachedDashboard(cacheKey);
    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ Returning cached dashboard data (${duration}ms)`);
      return res.json(cachedData);
    }

    console.log(`\n📊 Fetching fresh dashboard data for user: ${userId}`);
    console.log(`   Date range: ${startDate} to ${endDate}`);

    // Fetch data from all tables in parallel
    const [
      shopifyProducts,
      shopifyOrders,
      shopifyCustomers,
      shopifyConnection,
      metaConnection,
      metaInsights,
      shippingConnection,
      shiprocketShipments,
      onboardingData
    ] = await Promise.all([
      getShopifyProducts(userId),
      getShopifyOrders(userId, startDate, endDate),
      getShopifyCustomers(userId),
      getShopifyConnection(userId),
      getMetaConnection(userId),
      getMetaInsights(userId, startDate, endDate),
      getShippingConnection(userId),
      getShiprocketShipments(userId, startDate, endDate),
      getOnboardingData(userId)
    ]);

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
      Promise.resolve(calculateSummary(shopifyOrders, shopifyProducts, metaInsights, shiprocketShipments)),
      Promise.resolve(calculatePerformanceData(shopifyOrders, startDate, endDate)),
      Promise.resolve(calculateFinancialBreakdown(shopifyOrders, shopifyProducts, metaInsights, shiprocketShipments)),
      Promise.resolve(calculateMarketingMetrics(metaInsights, shopifyOrders)),
      Promise.resolve(calculateMarketingChart(metaInsights, startDate, endDate)),
      Promise.resolve(calculateCustomerTypeData(shopifyOrders, startDate, endDate)),
      Promise.resolve(calculateWebsiteMetrics(shopifyOrders)),
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
    // Fetch all orders for the user with pagination (DynamoDB has 1MB limit per query)
    let allOrders = [];
    let lastEvaluatedKey = null;
    let pageCount = 0;
    
    do {
      pageCount++;
      const command = new QueryCommand({
        TableName: process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        // Continue from last position if paginating
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
      });
      
      const result = await dynamoDB.send(command);
      const pageItems = result.Items || [];
      allOrders = allOrders.concat(pageItems);
      lastEvaluatedKey = result.LastEvaluatedKey;
      
      console.log(`   📄 DynamoDB Page ${pageCount}: ${pageItems.length} orders (Total so far: ${allOrders.length})`);
      
    } while (lastEvaluatedKey); // Keep fetching until no more pages
    
    console.log(`   📊 Total orders in DynamoDB: ${allOrders.length}`);
    
    // Debug: Log sample order dates
    if (allOrders.length > 0) {
      const sampleDates = allOrders.slice(0, 5).map(o => o.createdAt);
      console.log(`   📅 Sample order dates: ${sampleDates.join(', ')}`);
    }
    
    // Filter by date range in JavaScript (more reliable than DynamoDB FilterExpression)
    const filteredOrders = allOrders.filter(order => {
      if (!order.createdAt) {
        console.log(`   ⚠️ Order ${order.orderId} has no createdAt`);
        return false;
      }
      
      // Extract date from timestamp (YYYY-MM-DD)
      const orderDate = order.createdAt.split('T')[0];
      
      // Compare dates as strings (works because ISO format)
      return orderDate >= startDate && orderDate <= endDate;
    });
    
    console.log(`📦 Shopify Orders: ${filteredOrders.length} orders (filtered from ${allOrders.length} total) for date range ${startDate} to ${endDate}`);
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
    // Fetch all insights for the user (no date filter in query)
    const command = new QueryCommand({
      TableName: process.env.META_INSIGHTS_TABLE || 'meta_insights',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      // Optimize: Only fetch required attributes
      ProjectionExpression: 'userId, #date, adSpend, reach, linkClicks, impressions, metaRevenue',
      ExpressionAttributeNames: {
        '#date': 'date'
      }
    });
    const result = await dynamoDB.send(command);
    const allInsights = result.Items || [];
    
    // Filter by date range in JavaScript
    const filteredInsights = allInsights.filter(insight => {
      if (!insight.date) return false;
      
      // Compare dates as strings (works because ISO format YYYY-MM-DD)
      return insight.date >= startDate && insight.date <= endDate;
    });
    
    console.log(`📊 Meta Insights: ${filteredInsights.length} insights (filtered from ${allInsights.length} total) for date range ${startDate} to ${endDate}`);
    return filteredInsights;
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
    // Fetch all shipments for the user
    const command = new QueryCommand({
      TableName: process.env.SHIPROCKET_SHIPMENTS_TABLE || 'shiprocket_shipments',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      // Optimize: Only fetch required attributes
      ProjectionExpression: 'userId, shipmentId, orderId, #status, statusCode, totalCharges, syncedAt, createdAt, pickupDate, orderDate',
      ExpressionAttributeNames: {
        '#status': 'status'
      }
    });
    const result = await dynamoDB.send(command);
    const allShipments = result.Items || [];
    
    // For Shiprocket, we should match shipments to orders in the date range
    // Since shipments might not have proper date fields, we'll return all shipments
    // and let the calculation function handle the matching
    
    // Try to filter by date if we have date fields, otherwise return all
    const filteredShipments = allShipments.filter(shipment => {
      // Try multiple date fields: orderDate, createdAt, pickupDate
      const shipmentDate = shipment.orderDate || shipment.createdAt || shipment.pickupDate;
      
      // If no date field exists, include the shipment (will be matched by orderId later)
      if (!shipmentDate) return true;
      
      // Extract date from timestamp (YYYY-MM-DD)
      const dateOnly = typeof shipmentDate === 'string' && shipmentDate.includes('T') 
        ? shipmentDate.split('T')[0] 
        : shipmentDate;
      
      // Compare dates as strings
      return dateOnly >= startDate && dateOnly <= endDate;
    });
    
    console.log(`📦 Shiprocket Shipments: ${filteredShipments.length} shipments (filtered from ${allShipments.length} total) for date range ${startDate} to ${endDate}`);
    
    // If filtering resulted in 0 but we have shipments, return all (date fields might be missing)
    if (filteredShipments.length === 0 && allShipments.length > 0) {
      console.log(`⚠️  Date filtering returned 0 shipments, returning all ${allShipments.length} shipments`);
      return allShipments;
    }
    
    return filteredShipments;
  } catch (error) {
    console.error('Error fetching Shiprocket shipments:', error.message);
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

// Calculation functions

function calculateSummary(orders, products, metaInsights, shiprocketShipments) {
  // Create product lookup map for O(1) access instead of O(n) find
  const productMap = new Map();
  products.forEach(p => {
    if (p.productId) {
      productMap.set(p.productId, p.manufacturingCost || 0);
    }
  });
  
  // Single pass through orders to calculate revenue and COGS
  // Revenue = subtotalPrice (product revenue only, excludes shipping & tax)
  // This matches Shopify's "Total Sales" in Analytics
  let revenue = 0;
  let totalWithShippingTax = 0; // For reference
  let cogs = 0;
  
  orders.forEach(order => {
    // Skip cancelled, refunded, or voided orders to match Shopify's revenue calculation
    const financialStatus = (order.financialStatus || '').toLowerCase();
    if (financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled') {
      console.log(`⚠️  Excluding order ${order.orderId} from revenue (status: ${financialStatus})`);
      return; // Skip this order
    }
    
    // Use subtotalPrice if available (product revenue only), fallback to totalPrice
    // subtotalPrice = product prices only (matches Shopify Analytics "Total Sales")
    // totalPrice = products + shipping + tax - discounts
    const subtotal = parseFloat(order.subtotalPrice || 0);
    const total = parseFloat(order.totalPrice || 0);
    
    // Prefer subtotalPrice for accurate product revenue
    revenue += subtotal > 0 ? subtotal : total;
    totalWithShippingTax += total;
    
    // Calculate COGS for this order
    (order.lineItems || []).forEach(item => {
      const productId = item.product_id?.toString();
      const unitCost = productMap.get(productId) || 0;
      const quantity = item.quantity || 0;
      cogs += unitCost * quantity;
    });
  });
  
  console.log(`📊 Revenue breakdown: Product Revenue (subtotal): ₹${revenue}, Total with shipping/tax: ₹${totalWithShippingTax}`);
  
  // Count only valid orders (exclude cancelled, refunded, voided)
  const totalOrders = orders.filter(order => {
    const financialStatus = (order.financialStatus || '').toLowerCase();
    return !(financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled');
  }).length;
  
  // Ad Spend (A) = Total amount spent on ads
  const adSpend = metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
  
  // Shipping Cost (S) = Total logistics and shipping expense
  // Try to get from Shiprocket data first
  let shippingCost = shiprocketShipments.reduce((sum, shipment) => 
    sum + (parseFloat(shipment.totalCharges) || 0), 0
  );
  
  // If Shiprocket data has no costs, estimate based on valid orders only
  // Average shipping cost in India: ₹70 per order
  if (shippingCost === 0 && totalOrders > 0) {
    const avgShippingPerOrder = 70;
    shippingCost = totalOrders * avgShippingPerOrder;
    console.log(`⚠️  No shipping cost data from Shiprocket, estimating: ${totalOrders} valid orders × ₹${avgShippingPerOrder} = ₹${shippingCost}`);
  }
  
  // 2. Profit Calculations
  // Gross Profit (GP) = R − COGS
  const grossProfit = revenue - cogs;
  
  // Net Profit (NP) = R − (COGS + A + S)
  const netProfit = revenue - (cogs + adSpend + shippingCost);
  
  // 3. Derived Metrics
  // Gross Profit Margin (%) = (GP / R) × 100
  const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  
  // Net Profit Margin (%) = (NP / R) × 100
  const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  
  // Average Order Value (AOV) = R ÷ Total Orders
  const aov = totalOrders > 0 ? revenue / totalOrders : 0;
  
  // Cost per Purchase (CPP) = A ÷ Total Orders
  const cpp = totalOrders > 0 ? adSpend / totalOrders : 0;
  
  // Return on Ad Spend (ROAS) = Revenue ÷ Ad Spend
  const roas = adSpend > 0 ? revenue / adSpend : 0;
  
  // Profit on Ad Spend (POAS) = NP ÷ A
  const poas = adSpend > 0 ? netProfit / adSpend : 0;
  
  // Total Costs = COGS + Ad Spend + Shipping
  const totalCosts = cogs + adSpend + shippingCost;

  console.log(`📊 Summary Calculations:`, {
    revenue, cogs, adSpend, shippingCost,
    grossProfit, netProfit,
    grossProfitMargin: `${grossProfitMargin.toFixed(2)}%`,
    netProfitMargin: `${netProfitMargin.toFixed(2)}%`,
    aov, roas: roas.toFixed(2)
  });

  return [
    // Basic Metrics
    { title: 'Total Orders', value: totalOrders.toLocaleString('en-IN'), formula: 'Total number of orders' },
    { title: 'Revenue', value: `₹${revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'R = Sum of all order amounts' },
    
    // Cost Breakdown
    { title: 'COGS', value: `₹${cogs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Cost of Goods Sold' },
    { title: 'Ad Spend', value: `₹${adSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total marketing spend' },
    { title: 'Shipping Cost', value: `₹${shippingCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Total logistics expense' },
    
    // Profit Metrics
    { title: 'Net Profit', value: `₹${netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'NP = R − (COGS + A + S)' },
    { title: 'Gross Profit', value: `₹${grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'GP = R − COGS' },
    
    // Margin Metrics
    { title: 'Gross Profit Margin', value: `${grossProfitMargin.toFixed(2)}%`, formula: '(GP / R) × 100' },
    { title: 'Net Profit Margin', value: `${netProfitMargin.toFixed(2)}%`, formula: '(NP / R) × 100' },
    
    // Marketing Metrics
    { title: 'ROAS', value: roas.toFixed(2), formula: 'Revenue ÷ Ad Spend' },
    { title: 'POAS', value: poas.toFixed(2), formula: 'NP ÷ Ad Spend' },
    
    // Order Metrics
    { title: 'Avg Order Value', value: `₹${aov.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, formula: 'Average Order Value (AOV)' }
  ];
}

function calculatePerformanceData(orders, startDate, endDate) {
  if (!orders || orders.length === 0) {
    return [];
  }

  // Optimize: Use Map for O(1) lookups
  const ordersByDate = new Map();
  
  // Single pass through orders
  for (const order of orders) {
    const date = order.createdAt?.split('T')[0];
    if (!date) continue;
    
    // Skip cancelled, refunded, or voided orders to match Shopify's revenue calculation
    const financialStatus = (order.financialStatus || '').toLowerCase();
    if (financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled') {
      continue; // Skip this order from chart data
    }
    
    const existing = ordersByDate.get(date);
    // Use subtotalPrice (product revenue) to match Shopify Analytics
    const subtotal = parseFloat(order.subtotalPrice || 0);
    const total = parseFloat(order.totalPrice || 0);
    const revenue = subtotal > 0 ? subtotal : total;
    
    // Estimate costs (COGS ~40%, Marketing ~15%, Shipping ~10%, Other ~5% = 70% total costs)
    const totalCosts = revenue * 0.70;
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

  console.log(`📊 Performance data: ${data.length} data points`);
  return data;
}

function calculateFinancialBreakdown(orders, products, metaInsights, shiprocketShipments) {
  // Create product lookup map for O(1) access
  const productMap = new Map();
  products.forEach(p => {
    if (p.productId) {
      productMap.set(p.productId, p.manufacturingCost || 0);
    }
  });
  
  // Single pass through orders to calculate revenue and COGS
  // Use subtotalPrice (product revenue) to match Shopify Analytics
  let revenue = 0;
  let cogs = 0;
  
  orders.forEach(order => {
    // Skip cancelled, refunded, or voided orders to match Shopify's revenue calculation
    const financialStatus = (order.financialStatus || '').toLowerCase();
    if (financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled') {
      return; // Skip this order
    }
    
    // Use subtotalPrice if available (product revenue only), fallback to totalPrice
    const subtotal = parseFloat(order.subtotalPrice || 0);
    const total = parseFloat(order.totalPrice || 0);
    revenue += subtotal > 0 ? subtotal : total;
    
    (order.lineItems || []).forEach(item => {
      const productId = item.product_id?.toString();
      const unitCost = productMap.get(productId) || 0;
      const quantity = item.quantity || 0;
      cogs += unitCost * quantity;
    });
  });
  
  // Ad Spend (A) = Total marketing spend
  const adSpend = metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
  
  // Shipping Cost (S) = Total logistics expense
  // Try to get from Shiprocket data first
  let shippingCost = shiprocketShipments.reduce((sum, shipment) => 
    sum + (parseFloat(shipment.totalCharges) || 0), 0
  );
  
  // Count valid orders for shipping cost estimation
  const validOrders = orders.filter(order => {
    const financialStatus = (order.financialStatus || '').toLowerCase();
    return !(financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled');
  }).length;
  
  // If Shiprocket data has no costs, estimate based on valid orders
  if (shippingCost === 0 && validOrders > 0) {
    const avgShippingPerOrder = 70; // Average shipping cost in India
    shippingCost = validOrders * avgShippingPerOrder;
  }
  
  console.log(`📊 Financial Breakdown - Revenue: ${revenue}, COGS: ${cogs}, Ad Spend: ${adSpend}, Shipping: ${shippingCost}`);
  
  // If no revenue AND no costs, return empty pie data to avoid NaN errors
  if (revenue === 0 && cogs === 0 && adSpend === 0 && shippingCost === 0) {
    console.log(`⚠️  No financial data - returning empty pie chart`);
    return {
      revenue: 0,
      pieData: [],
      list: []
    };
  }
  
  // Calculate other costs (estimated as 5% of revenue for misc expenses)
  const otherCosts = Math.max(0, revenue * 0.05);
  
  console.log(`   COGS: ${cogs}, Marketing: ${adSpend}, Shipping: ${shippingCost}, Other: ${otherCosts}`);
  
  // Only include items with value > 0 to avoid NaN in charts
  const allItems = [
    { name: 'Product Cost (COGS)', value: cogs, color: '#0d2923' },
    { name: 'Marketing (Ad Spend)', value: adSpend, color: '#2d6a4f' },
    { name: 'Shipping Cost', value: shippingCost, color: '#1a4037' },
    { name: 'Other Costs', value: otherCosts, color: '#40916c' }
  ];
  
  const pieData = allItems.filter(item => item.value > 0);
  
  console.log(`   Pie data items: ${pieData.length} (filtered from ${allItems.length})`);

  return {
    revenue,
    pieData,
    list: pieData
  };
}

function calculateMarketingMetrics(metaInsights, orders) {
  const totalSpend = metaInsights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
  const totalReach = metaInsights.reduce((sum, insight) => sum + (insight.reach || 0), 0);
  const totalClicks = metaInsights.reduce((sum, insight) => sum + (insight.linkClicks || 0), 0);
  // Use subtotalPrice (product revenue) to match Shopify Analytics
  const revenue = orders.reduce((sum, order) => {
    const subtotal = parseFloat(order.subtotalPrice || 0);
    const total = parseFloat(order.totalPrice || 0);
    return sum + (subtotal > 0 ? subtotal : total);
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

function calculateWebsiteMetrics(orders) {
  // Count only valid orders (exclude cancelled, refunded, voided)
  const validOrders = orders.filter(order => {
    const financialStatus = (order.financialStatus || '').toLowerCase();
    return !(financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled');
  }).length;
  
  const sessions = validOrders * 3; // Rough estimate
  const conversionRate = validOrders > 0 ? (validOrders / sessions) * 100 : 0;

  return [
    { title: 'Sessions', value: sessions.toLocaleString('en-IN'), formula: 'Total website sessions' },
    { title: 'Conversion Rate', value: `${conversionRate.toFixed(2)}%`, formula: '(Orders / Sessions) × 100' },
    { title: 'Bounce Rate', value: '45%', formula: 'Single page sessions' },
    { title: 'Avg Session Duration', value: '3m 24s', formula: 'Average time on site' }
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
    
    // Log first shipment for debugging
    if (shiprocketShipments[0]) {
      console.log(`   Sample shipment:`, {
        status: shiprocketShipments[0].status,
        statusCode: shiprocketShipments[0].statusCode,
        totalCharges: shiprocketShipments[0].totalCharges
      });
    }
    
    // Count by status (case-insensitive and flexible matching)
    // Note: statusCode might be "UNKNOWN", so rely primarily on status string
    const delivered = shiprocketShipments.filter(s => {
      const status = (s.status || '').toUpperCase();
      const code = s.statusCode ? parseInt(s.statusCode) : null;
      return status.includes('DELIVER') && !status.includes('RTO') || code === 6;
    }).length;
    
    const inTransit = shiprocketShipments.filter(s => {
      const status = (s.status || '').toUpperCase();
      const code = s.statusCode ? parseInt(s.statusCode) : null;
      return status.includes('TRANSIT') || status.includes('SHIPPED') || status.includes('OUT FOR DELIVERY') || code === 7;
    }).length;
    
    const rto = shiprocketShipments.filter(s => {
      const status = (s.status || '').toUpperCase();
      const code = s.statusCode ? parseInt(s.statusCode) : null;
      return status.includes('RTO') || (status.includes('RETURN') && !status.includes('NON')) || code === 9;
    }).length;
    
    const ndrPending = shiprocketShipments.filter(s => {
      const status = (s.status || '').toUpperCase();
      const code = s.statusCode ? parseInt(s.statusCode) : null;
      return status.includes('NDR') || status.includes('NON DELIVERY') || code === 17;
    }).length;
    
    const pickupPending = shiprocketShipments.filter(s => {
      const status = (s.status || '').toUpperCase();
      const code = s.statusCode ? parseInt(s.statusCode) : null;
      return (status.includes('PICKUP') || status === 'PENDING') && !status.includes('NDR') || code === 1;
    }).length;
    
    // Calculate total shipping cost
    let totalShippingCost = shiprocketShipments.reduce((sum, s) => 
      sum + (parseFloat(s.totalCharges) || 0), 0
    );
    
    // If no cost data, estimate based on shipment count
    if (totalShippingCost === 0 && shiprocketShipments.length > 0) {
      const avgShippingPerShipment = 70; // Average shipping cost in India
      totalShippingCost = shiprocketShipments.length * avgShippingPerShipment;
    }
    
    const avgShippingCost = shiprocketShipments.length > 0 
      ? totalShippingCost / shiprocketShipments.length 
      : 0;

    // Calculate additional metrics
    const totalShipments = shiprocketShipments.length;
    const deliveryRate = totalShipments > 0 ? (delivered / totalShipments) * 100 : 0;
    const rtoRate = totalShipments > 0 ? (rto / totalShipments) * 100 : 0;
    
    // Count prepaid vs COD from orders
    const prepaidOrders = orders.filter(o => o.financialStatus === 'paid').length;
    const codOrders = orders.length - prepaidOrders;

    console.log(`   Shipping breakdown:`, {
      totalShipments, delivered, inTransit, rto, ndrPending, pickupPending,
      deliveryRate: `${deliveryRate.toFixed(2)}%`,
      rtoRate: `${rtoRate.toFixed(2)}%`,
      prepaidOrders, codOrders,
      totalCost: totalShippingCost, avgCost: avgShippingCost
    });

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
    console.log(`⚠️  No Shiprocket data, using Shopify orders for shipping metrics`);
    const delivered = orders.filter(o => o.fulfillmentStatus === 'fulfilled').length;
    const pending = orders.filter(o => !o.fulfillmentStatus || o.fulfillmentStatus === 'pending').length;
    const totalOrders = orders.length;
    const deliveryRate = totalOrders > 0 ? (delivered / totalOrders) * 100 : 0;
    
    // Count prepaid vs COD from orders
    const prepaidOrders = orders.filter(o => o.financialStatus === 'paid').length;
    const codOrders = orders.length - prepaidOrders;

    return [
      { title: 'Total Shipments', value: totalOrders.toString(), formula: 'Total number of orders' },
      { title: 'Delivered', value: delivered.toString(), formula: 'Successfully delivered orders' },
      { title: 'In-Transit', value: pending.toString(), formula: 'Orders in transit' },
      { title: 'RTO', value: '0', formula: 'Return to origin' },
      { title: 'NDR Pending', value: '0', formula: 'Non-delivery reports pending' },
      { title: 'Delivery Rate', value: `${deliveryRate.toFixed(2)}%`, formula: '(Delivered / Total) × 100' },
      { title: 'RTO Rate', value: '0.00%', formula: '(RTO / Total) × 100' },
      { title: 'Prepaid Orders', value: prepaidOrders.toString(), formula: 'Prepaid payment orders' },
      { title: 'COD', value: codOrders.toString(), formula: 'Cash on delivery orders' },
      { title: 'Pickup Pending', value: '0', formula: 'Awaiting pickup' }
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
