/**
 * AI Chat Service
 * 
 * ARCHITECTURE:
 * This service implements a Direct DB → AI approach for business analytics chat
 * Flow: User Query → Parse Intent → Fetch DB Data → Generate AI Response
 * 
 * KEY FEATURES:
 * - No vector storage needed (direct data queries)
 * - No LangChain wrapper (direct AWS SDK calls)
 * - Uses Claude 3 Sonnet in us-east-1 region for AI responses
 * - Fetches real-time data from DynamoDB tables (orders, marketing, shipping)
 * 
 * REGIONS:
 * - Main app data: ap-south-1 (Mumbai)
 * - AI model (Bedrock): us-east-1 (N. Virginia)
 * 
 * TABLES USED:
 * - shopify_orders: Order data from Shopify
 * - meta_insights: Facebook/Instagram ad performance
 * - shiprocket_shipments: Shipping and delivery status
 */

const { InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { initializeBedrock } = require('../config/bedrock.config');
const { generateAIResponse: generateSmartAIResponse } = require('../config/ai.config');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client for data fetching
// Uses main AWS region (ap-south-1) where business data is stored
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Fetch comprehensive dashboard data using the same controller logic
 * This ensures chatbot shows exactly the same metrics as dashboard
 */
const fetchDashboardData = async (userId, startDate, endDate) => {
  try {
    console.log(`📊 Chatbot: Fetching FULL dashboard data for ${userId} from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Import MAIN dashboard controller for FULL business data (Shopify + Shiprocket combined)
    const dashboardController = require('../controllers/dashboard.controller');
    const shiprocketDashboard = require('../controllers/shiprocket-dashboard-v2.controller');

    // Create mock request/response objects to call the controller
    const mockReq = {
      query: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        userId: userId
      },
      user: {
        userId: userId
      }
    };

    let dashboardData = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          dashboardData = data;
        }
      }),
      json: (data) => {
        dashboardData = data;
      }
    };

    // Call the main dashboard controller
    await dashboardController.getDashboardData(mockReq, mockRes);

    if (!dashboardData || !dashboardData.summary) {
      console.log('⚠️ Chatbot: No dashboard data returned, using fallback');
      return { error: 'No dashboard data available' };
    }

    console.log(`✅ Chatbot: Full dashboard data fetched with ${dashboardData.summary.length} summary cards`);

    // Also fetch Shiprocket-specific data
    let shiprocketData = null;
    try {
      shiprocketData = await shiprocketDashboard.getShiprocketSummaryForChatbot(
        userId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      console.log(`✅ Chatbot: Shiprocket data also fetched`);
    } catch (err) {
      console.log('⚠️ Chatbot: Could not fetch Shiprocket data:', err.message);
    }

    // Extract key metrics from summary cards (same as dashboard shows)
    const findCard = (title) => dashboardData.summary.find(c => c.title === title);

    return {
      shopify: {
        totalOrders: parseInt(findCard('Total Orders')?.value || '0'),
        cancelledOrders: parseInt(findCard('Cancelled Orders')?.value || '0'),
        revenue: parseFloat((findCard('Revenue Generated')?.value || '₹0').replace(/[^0-9.-]/g, '')),
        cogs: parseFloat((findCard('COGS')?.value || '₹0').replace(/[^0-9.-]/g, '')),
        adSpend: parseFloat((findCard('Ad Spend')?.value || '₹0').replace(/[^0-9.-]/g, '')),
        shippingCost: parseFloat((findCard('Shipping Spend')?.value || '₹0').replace(/[^0-9.-]/g, '')),
        shippingPerOrder: parseFloat((findCard('Shipping per Order')?.value || '₹0').replace(/[^0-9.-]/g, '')),
        businessExpenses: parseFloat((findCard('Fixed Costs')?.value || '₹0').replace(/[^0-9.-]/g, '')),
        netProfit: parseFloat((findCard('Money Kept')?.value || '₹0').replace(/[^0-9.-]/g, '')),
        moneyKept: parseFloat((findCard('Money Kept')?.value || '₹0').replace(/[^0-9.-]/g, '')),
        grossProfit: parseFloat((findCard('Gross Profit')?.value || '₹0').replace(/[^0-9.-]/g, '')),
        grossProfitMargin: parseFloat((findCard('Gross Profit Margin')?.value || '0%').replace(/[^0-9.-]/g, '')),
        netProfitMargin: parseFloat((findCard('Profit Margin')?.value || '0%').replace(/[^0-9.-]/g, '')),
        netProfitPerOrder: parseFloat((findCard('Profit per Order')?.value || '₹0').replace(/[^0-9.-]/g, '')),
        roas: parseFloat(findCard('ROAS')?.value || '0'),
        poas: parseFloat(findCard('POAS')?.value || '0'),
        aov: parseFloat((findCard('Average Order Value')?.value || '₹0').replace(/[^0-9.-]/g, '')),
        cpp: parseFloat((findCard('CPP')?.value || '₹0').replace(/[^0-9.-]/g, '')),
        rtoCount: parseInt(findCard('RTO Count')?.value || '0'),
        deliveredOrders: parseInt(findCard('Delivered Orders')?.value || '0')
      },
      shiprocket: shiprocketData ? {
        totalRevenue: shiprocketData.totalRevenue || 0,
        deliveredRevenue: shiprocketData.deliveredRevenue || 0,
        deliveredOrders: shiprocketData.deliveredOrders || 0,
        rtoOrders: shiprocketData.rtoOrders || 0,
        canceledOrders: shiprocketData.canceledOrders || 0,
        shippingCost: shiprocketData.shippingCost || 0,
        deliveredFreight: shiprocketData.deliveredFreight || 0,
        rtoFreight: shiprocketData.rtoFreight || 0,
        netProfit: shiprocketData.netProfit || 0,
        moneyKept: shiprocketData.moneyKept || 0,
        totalOrders: shiprocketData.totalOrders || 0,
        deliveryRate: shiprocketData.deliveryRate || '0',
        rtoRate: shiprocketData.rtoRate || '0'
      } : null,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }
    };

  } catch (error) {
    console.error('❌ Chatbot: Error fetching dashboard data:', error.message);
    console.error('❌ Chatbot: Error stack:', error.stack);

    // Return error info for debugging
    return {
      error: error.message,
      shopify: null,
      shiprocket: null
    };
  }
};

// Helper function to fetch onboarding data
async function fetchOnboardingData(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.ONBOARDING_TABLE || 'onboarding',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    });
    const result = await docClient.send(command);
    console.log(`📋 Chatbot: Fetched ${(result.Items || []).length} onboarding records`);
    return result.Items?.[0] || null;
  } catch (error) {
    console.error('❌ Chatbot: Error fetching onboarding data:', error.message);
    return null;
  }
}

// Helper function to fetch business expenses
async function fetchBusinessExpensesData(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.BUSINESS_EXPENSES_TABLE || 'business_expenses',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    });
    const result = await docClient.send(command);
    console.log(`💰 Chatbot: Fetched ${(result.Items || []).length} business expense records`);
    return result.Items?.[0] || null;
  } catch (error) {
    console.error('❌ Chatbot: Error fetching business expenses:', error.message);
    return null;
  }
}

// Helper functions to fetch data (same as dashboard controller)
async function fetchShopifyOrders(userId, startDate, endDate) {
  try {
    const params = {
      TableName: process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      // Optimization: Fetch only needed fields to reduce memory usage and transfer size
      ProjectionExpression: 'userId, createdAt, financialStatus, subtotalPrice, totalPrice, lineItems, test'
    };

    let filteredOrders = [];
    let lastEvaluatedKey = null;
    let totalScanned = 0;

    do {
      const command = new QueryCommand({
        ...params,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
      });
      const result = await docClient.send(command);
      const items = result.Items || [];
      totalScanned += items.length;

      // Filter IMMEDIATELY inside the loop to avoid memory explosion
      for (const order of items) {
        if (!order.createdAt) continue;
        const orderDate = new Date(order.createdAt);
        const financialStatus = (order.financialStatus || '').toLowerCase();

        // Filter by date and status
        if (orderDate >= startDate &&
          orderDate <= endDate &&
          !(financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled')) {
          filteredOrders.push(order);
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;

      // Safety Limit to prevent crash if range is too large
      if (filteredOrders.length > 20000) {
        console.warn(`⚠️ Chatbot: Order limit (20,000) reached. Truncating.`);
        break;
      }

    } while (lastEvaluatedKey);

    console.log(`📦 Chatbot: Fetched ${filteredOrders.length} valid orders (scanned ${totalScanned})`);
    return filteredOrders;
  } catch (error) {
    console.error('❌ Chatbot: Error fetching Shopify orders:', error.message);
    return [];
  }
}

async function fetchShopifyProducts(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.SHOPIFY_PRODUCTS_TABLE || 'shopify_products',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ProjectionExpression: 'userId, productId, manufacturingCost, title'
    });
    const result = await docClient.send(command);
    console.log(`📦 Chatbot: Fetched ${(result.Items || []).length} products`);
    return result.Items || [];
  } catch (error) {
    console.error('❌ Chatbot: Error fetching Shopify products:', error.message);
    return [];
  }
}

async function fetchMetaInsights(userId, startDate, endDate) {
  try {
    const command = new QueryCommand({
      TableName: process.env.META_INSIGHTS_TABLE || 'meta_insights',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    });
    const result = await docClient.send(command);

    // Filter by date
    const filteredInsights = (result.Items || []).filter(insight => {
      if (!insight.date) return false;
      const insightDate = new Date(insight.date);
      return insightDate >= startDate && insightDate <= endDate;
    });

    console.log(`📊 Chatbot: Fetched ${(result.Items || []).length} total insights, ${filteredInsights.length} in date range`);
    return filteredInsights;
  } catch (error) {
    console.error('❌ Chatbot: Error fetching Meta insights:', error.message);
    return [];
  }
}

async function fetchShiprocketShipments(userId, startDate, endDate) {
  try {
    const command = new QueryCommand({
      TableName: process.env.SHIPROCKET_SHIPMENTS_TABLE || 'shiprocket_shipments',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    });
    const result = await docClient.send(command);

    // Filter by date if createdAt exists
    const filteredShipments = (result.Items || []).filter(shipment => {
      if (!shipment.createdAt) return true; // Include if no date filter possible
      const shipmentDate = new Date(shipment.createdAt);
      return shipmentDate >= startDate && shipmentDate <= endDate;
    });

    console.log(`🚚 Chatbot: Fetched ${(result.Items || []).length} total shipments, ${filteredShipments.length} in date range`);
    return filteredShipments;
  } catch (error) {
    console.error('❌ Chatbot: Error fetching Shiprocket shipments:', error.message);
    return [];
  }
}

async function fetchBusinessExpenses(userId, startDate, endDate) {
  try {
    const command = new QueryCommand({
      TableName: process.env.BUSINESS_EXPENSES_TABLE || 'business_expenses',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    });
    const result = await docClient.send(command);
    console.log(`💰 Chatbot: Fetched ${(result.Items || []).length} business expense records`);
    return result.Items || [];
  } catch (error) {
    console.error('❌ Chatbot: Error fetching business expenses:', error.message);
    return [];
  }
}

// Simplified metric calculations (key metrics from dashboard)
function calculateShopifyMetrics(orders, products, metaInsights, shiprocketShipments, businessExpenses) {
  // Revenue calculation (same as dashboard)
  const revenue = orders.reduce((sum, order) => {
    const subtotal = parseFloat(order.subtotalPrice || 0);
    const total = parseFloat(order.totalPrice || 0);
    return sum + (subtotal > 0 ? subtotal : total);
  }, 0);

  // COGS calculation (same as dashboard)
  const productMap = new Map();
  products.forEach(p => {
    if (p.productId && p.manufacturingCost) {
      productMap.set(p.productId.toString(), parseFloat(p.manufacturingCost) || 0);
    }
  });

  let cogs = 0;
  orders.forEach(order => {
    (order.lineItems || []).forEach(item => {
      const productId = item.product_id?.toString();
      const unitCost = productMap.get(productId) || 0;
      const quantity = item.quantity || 0;
      cogs += unitCost * quantity;
    });
  });

  // Other calculations (same as dashboard)
  const adSpend = metaInsights.reduce((sum, insight) => sum + (parseFloat(insight.adSpend) || 0), 0);
  const shippingCost = shiprocketShipments.reduce((sum, s) => sum + (parseFloat(s.freightCharges) || 0), 0);

  // Business expenses calculation
  const totalBusinessExpenses = businessExpenses.reduce((sum, expense) => {
    return sum + (parseFloat(expense.agencyFees) || 0) +
      (parseFloat(expense.rtoHandlingFees) || 0) +
      (parseFloat(expense.staffFees) || 0) +
      (parseFloat(expense.officeRent) || 0) +
      (parseFloat(expense.otherBusinessExpenses) || 0);
  }, 0);

  // Profit calculations
  const grossProfit = revenue - cogs;
  const netProfit = revenue - (cogs + adSpend + shippingCost + totalBusinessExpenses);

  // Margins
  const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  // Other metrics
  const totalOrders = orders.length;
  const roas = adSpend > 0 ? revenue / adSpend : 0;
  const poas = adSpend > 0 ? netProfit / adSpend : 0;
  const aov = totalOrders > 0 ? revenue / totalOrders : 0;
  const cpp = totalOrders > 0 && adSpend > 0 ? adSpend / totalOrders : 0;
  const netProfitPerOrder = totalOrders > 0 ? netProfit / totalOrders : 0;
  const shippingPerOrder = totalOrders > 0 ? shippingCost / totalOrders : 0;

  return {
    totalOrders,
    revenue,
    cogs,
    adSpend,
    shippingCost,
    shippingPerOrder,
    businessExpenses: totalBusinessExpenses,
    netProfit,
    grossProfit,
    grossProfitMargin,
    netProfitMargin,
    netProfitPerOrder,
    roas,
    poas,
    aov,
    cpp
  };
}

function calculateShiprocketMetrics(shiprocketShipments, metaInsights, businessExpenses) {
  // Shiprocket specific calculations (same as shiprocket dashboard controller)
  const deliveredShipments = shiprocketShipments.filter(s => {
    const status = (s.status || '').toUpperCase();
    const code = parseInt(s.statusCode) || 0;
    return status === 'DELIVERED' || code === 6 || code === 7 || code === 8;
  });

  const revenue = deliveredShipments.reduce((sum, s) => sum + (parseFloat(s.orderAmount) || 0), 0);
  const shippingCharges = shiprocketShipments.reduce((sum, s) => sum + (parseFloat(s.freightCharges) || 0), 0);
  const adSpend = metaInsights.reduce((sum, insight) => sum + (parseFloat(insight.adSpend) || 0), 0);

  // Business expenses
  const totalBusinessExpenses = businessExpenses.reduce((sum, expense) => {
    return sum + (parseFloat(expense.agencyFees) || 0) +
      (parseFloat(expense.rtoHandlingFees) || 0) +
      (parseFloat(expense.staffFees) || 0) +
      (parseFloat(expense.officeRent) || 0) +
      (parseFloat(expense.otherBusinessExpenses) || 0);
  }, 0);

  const netProfit = revenue - (adSpend + shippingCharges + totalBusinessExpenses);
  const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const deliveredCount = deliveredShipments.length;
  const roas = adSpend > 0 ? revenue / adSpend : 0;
  const aov = deliveredCount > 0 ? revenue / deliveredCount : 0;
  const cpp = deliveredCount > 0 && adSpend > 0 ? adSpend / deliveredCount : 0;
  const netProfitPerOrder = deliveredCount > 0 ? netProfit / deliveredCount : 0;
  const shippingPerOrder = deliveredCount > 0 ? shippingCharges / deliveredCount : 0;

  return {
    revenue,
    netProfit,
    netProfitMargin,
    netProfitPerOrder,
    adSpend,
    businessExpenses: totalBusinessExpenses,
    shippingCharges,
    shippingPerOrder,
    deliveredOrders: deliveredCount,
    roas,
    aov,
    cpp,
    cogs: 0, // Not available in shiprocket
    grossProfit: 0 // Cannot calculate without COGS
  };
}

/**
 * Parse user query to determine intent
 * 
 * PURPOSE: Analyze user's natural language query to understand what data they need
 * 
 * INTENT TYPES:
 * - orders_today: Today's order count/details
 * - revenue: Revenue queries (today/week/month)
 * - marketing: Ad spend, ROAS, reach, clicks
 * - shipping: Delivery status, shipment tracking
 * - general: Broad business overview
 * 
 * EXAMPLES:
 * - "How many orders today?" → { type: 'orders_today', timeframe: 'today' }
 * - "What's my revenue this month?" → { type: 'revenue', timeframe: 'month' }
 * - "Show me ad performance" → { type: 'marketing', timeframe: 'week' }
 * 
 * @param {string} query - User's natural language query
 * @returns {Object} Parsed intent with type and timeframe
 */
const parseQueryIntent = (query) => {
  const lowerQuery = query.toLowerCase();

  // Determine timeframe first (more specific patterns with natural language)
  let timeframe = 'month'; // default - changed to month for initial queries
  let customDateRange = null; // For specific date ranges like "1 november to 30 november"

  // Check for specific date ranges first (e.g., "1 november to 30 november", "1 nov - 30 nov")
  const dateRangePattern = /(\d{1,2})\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(?:to|-|till|until)\s*(\d{1,2})\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?/i;
  const dateRangeMatch = lowerQuery.match(dateRangePattern);

  if (dateRangeMatch) {
    const monthMap = {
      'january': 0, 'jan': 0, 'february': 1, 'feb': 1, 'march': 2, 'mar': 2,
      'april': 3, 'apr': 3, 'may': 4, 'june': 5, 'jun': 5, 'july': 6, 'jul': 6,
      'august': 7, 'aug': 7, 'september': 8, 'sep': 8, 'october': 9, 'oct': 9,
      'november': 10, 'nov': 10, 'december': 11, 'dec': 11
    };

    const startDay = parseInt(dateRangeMatch[1]);
    const startMonth = monthMap[dateRangeMatch[2].toLowerCase()];
    const endDay = parseInt(dateRangeMatch[3]);
    const endMonth = dateRangeMatch[4] ? monthMap[dateRangeMatch[4].toLowerCase()] : startMonth;

    // Determine year (use current year, or previous year if month is in the future)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    let startYear = currentYear;
    let endYear = currentYear;

    // If the start month is after current month, it's likely referring to last year
    if (startMonth > currentMonth) {
      startYear = currentYear - 1;
    }
    if (endMonth > currentMonth) {
      endYear = currentYear - 1;
    }

    customDateRange = {
      startDate: new Date(startYear, startMonth, startDay, 0, 0, 0, 0),
      endDate: new Date(endYear, endMonth, endDay, 23, 59, 59, 999)
    };

    timeframe = 'custom';
    console.log(`📅 Parsed custom date range: ${customDateRange.startDate.toDateString()} to ${customDateRange.endDate.toDateString()}`);
  }
  // Today variations
  else if (lowerQuery.includes('today') || lowerQuery.includes('this day') ||
    lowerQuery.includes('aaj') || lowerQuery.includes('current day')) {
    timeframe = 'today';
  }
  // Yesterday variations
  else if (lowerQuery.includes('yesterday') || lowerQuery.includes('last day') ||
    lowerQuery.includes('kal') || lowerQuery.includes('previous day')) {
    timeframe = 'yesterday';
  }
  // Day before yesterday
  else if (lowerQuery.includes('day before yesterday') ||
    lowerQuery.includes('2 days ago') || lowerQuery.includes('two days ago') ||
    lowerQuery.includes('parso')) {
    timeframe = 'day_before_yesterday';
  }
  // Month variations
  else if (lowerQuery.includes('30 days') || lowerQuery.includes('last month') ||
    lowerQuery.includes('this month') || lowerQuery.includes('monthly') ||
    lowerQuery.includes('past month') || lowerQuery.includes('previous month')) {
    timeframe = 'month';
  }
  // Week variations
  else if (lowerQuery.includes('7 days') || lowerQuery.includes('week') ||
    lowerQuery.includes('weekly') || lowerQuery.includes('last week') ||
    lowerQuery.includes('this week')) {
    timeframe = 'week';
  }

  // Future queries (redirect to predictions)
  if (lowerQuery.includes('tomorrow') || lowerQuery.includes('next day') ||
    lowerQuery.includes('day after tomorrow') || lowerQuery.includes('future') ||
    lowerQuery.includes('predict') || lowerQuery.includes('forecast')) {
    timeframe = 'future';
  }

  // Today's orders
  if (lowerQuery.includes('today') && (lowerQuery.includes('order') || lowerQuery.includes('sale'))) {
    return { type: 'orders_today', timeframe: 'today', customDateRange };
  }

  // Revenue queries
  if (lowerQuery.includes('revenue') || lowerQuery.includes('sales')) {
    return { type: 'revenue', timeframe, customDateRange };
  }

  // Marketing queries
  if (lowerQuery.includes('ad') || lowerQuery.includes('marketing') || lowerQuery.includes('roas')) {
    return { type: 'marketing', timeframe, customDateRange };
  }

  // Shipping queries
  if (lowerQuery.includes('ship') || lowerQuery.includes('deliver')) {
    return { type: 'shipping', timeframe, customDateRange };
  }

  // Snapshot/overview queries (general business data)
  if (lowerQuery.includes('snapshot') || lowerQuery.includes('overview') ||
    lowerQuery.includes('summary') || lowerQuery.includes('report')) {
    return { type: 'general', timeframe, customDateRange };
  }

  // General query
  return { type: 'general', timeframe, customDateRange };
};

/**
 * Fetch relevant data from DynamoDB based on query intent
 * 
 * PURPOSE: Retrieve only the data needed to answer the user's specific question
 * This optimizes performance by not fetching unnecessary data
 * 
 * DATA SOURCES:
 * 1. Shopify Orders (shopify_orders table)
 *    - Order count, revenue, average order value
 *    - Filtered by date range based on intent timeframe
 * 
 * 2. Meta/Facebook Ads (meta_insights table)
 *    - Ad spend, reach, clicks, ROAS
 *    - Marketing campaign performance
 * 
 * 3. Shiprocket Shipping (shiprocket_shipments table)
 *    - Delivery status breakdown
 *    - Shipment tracking information
 * 
 * TIMEFRAMES:
 * - today: From midnight today
 * - week: Last 7 days
 * - month: Last 30 days
 * 
 * @param {string} userId - User ID to filter data
 * @param {Object} intent - Parsed query intent (type and timeframe)
 * @returns {Promise<Object>} Aggregated data with summaries
 */
const fetchRelevantData = async (userId, intent) => {
  const data = {};
  const now = new Date();

  try {
    // Calculate date range based on timeframe
    let startDate = new Date();
    let endDate = new Date();

    // Handle custom date range first (e.g., "1 november to 30 november")
    if (intent.timeframe === 'custom' && intent.customDateRange) {
      startDate = intent.customDateRange.startDate;
      endDate = intent.customDateRange.endDate;
      console.log(`📅 Using custom date range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    } else if (intent.timeframe === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (intent.timeframe === 'yesterday') {
      startDate.setDate(now.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(now.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
    } else if (intent.timeframe === 'day_before_yesterday') {
      startDate.setDate(now.getDate() - 2);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(now.getDate() - 2);
      endDate.setHours(23, 59, 59, 999);
    } else if (intent.timeframe === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (intent.timeframe === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else if (intent.timeframe === 'future') {
      // For future queries, return empty data and let AI explain
      return data;
    }

    // Fetch Orders
    if (intent.type === 'orders_today' || intent.type === 'revenue' || intent.type === 'general') {
      try {
        const ordersParams = {
          TableName: process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId
          }
        };

        // Fetch orders with pagination (DynamoDB has 1MB limit per query)
        // OPTIMIZATION: Filter inside loop to avoid memory crash
        let filteredOrders = [];
        let lastEvaluatedKey = null;
        let totalScanned = 0;

        do {
          const command = new QueryCommand({
            ...ordersParams,
            ProjectionExpression: 'userId, createdAt, financialStatus, subtotalPrice, totalPrice, lineItems',
            ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
          });

          const result = await docClient.send(command);
          const items = result.Items || [];
          totalScanned += items.length;

          for (const order of items) {
            if (!order.createdAt) continue;
            const orderDate = new Date(order.createdAt);
            const financialStatus = (order.financialStatus || '').toLowerCase();

            // Filter by date range
            const inDateRange = orderDate >= startDate && orderDate <= endDate;

            // Filter by status (exclude cancelled/refunded)
            const validStatus = !(financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled');

            if (inDateRange && validStatus) {
              filteredOrders.push(order);
            }
          }

          lastEvaluatedKey = result.LastEvaluatedKey;

          // Safety Limit
          if (filteredOrders.length > 20000) {
            console.warn(`⚠️ Chatbot: Order limit (20,000) reached for intent ${intent.type}. Truncating.`);
            break;
          }

        } while (lastEvaluatedKey);

        data.orders = filteredOrders;
        console.log(`📦 Chatbot: Found ${filteredOrders.length} valid orders in timeframe (${intent.timeframe}) (scanned ${totalScanned})`);

        // Log if no orders found but database has data (debug info)
        if (data.orders.length === 0 && totalScanned > 0) {
          console.log(`⚠️  Chatbot: No matching orders found in range, but scanned ${totalScanned} records.`);
        }

        // Calculate summary (use subtotalPrice like dashboard for accurate revenue)
        const totalRevenue = data.orders.reduce((sum, o) => {
          const subtotal = parseFloat(o.subtotalPrice || 0);
          const total = parseFloat(o.totalPrice || 0);
          return sum + (subtotal > 0 ? subtotal : total);
        }, 0);

        data.ordersSummary = {
          total: data.orders.length,
          revenue: totalRevenue,
          avgOrderValue: data.orders.length > 0 ? totalRevenue / data.orders.length : 0
        };
      } catch (err) {
        console.log('Orders fetch error:', err.message);
      }
    }

    // Fetch Marketing Data
    if (intent.type === 'marketing' || intent.type === 'general') {
      try {
        const metaParams = {
          TableName: process.env.META_INSIGHTS_TABLE || 'meta_insights',
          KeyConditionExpression: 'userId = :userId',
          FilterExpression: '#date >= :startDate',
          ExpressionAttributeNames: { '#date': 'date' },
          ExpressionAttributeValues: {
            ':userId': userId,
            ':startDate': startDate.toISOString().split('T')[0]
          },
          Limit: 30
        };

        const metaResult = await docClient.send(new QueryCommand(metaParams));
        data.marketing = metaResult.Items || [];

        // Calculate summary
        const totalSpend = data.marketing.reduce((sum, m) => sum + (parseFloat(m.adSpend) || 0), 0);
        const totalReach = data.marketing.reduce((sum, m) => sum + (parseInt(m.reach) || 0), 0);
        const totalClicks = data.marketing.reduce((sum, m) => sum + (parseInt(m.linkClicks) || 0), 0);

        // Calculate ROAS properly: Revenue / Ad Spend (same as dashboard)
        const totalRevenue = data.ordersSummary ? data.ordersSummary.revenue : 0;
        const calculatedROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

        data.marketingSummary = {
          totalSpend: totalSpend,
          totalReach: totalReach,
          totalClicks: totalClicks,
          avgROAS: calculatedROAS,
          totalRevenue: totalRevenue
        };

        console.log(`📊 Chatbot Marketing Summary: Spend=₹${totalSpend}, Revenue=₹${totalRevenue}, ROAS=${calculatedROAS.toFixed(2)}`);
      } catch (err) {
        console.log('Marketing fetch error:', err.message);
      }
    }

    // Fetch Shipping Data
    if (intent.type === 'shipping' || intent.type === 'general') {
      try {
        const shippingParams = {
          TableName: process.env.SHIPROCKET_SHIPMENTS_TABLE || 'shiprocket_shipments',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId
          },
          Limit: 30
        };

        const shippingResult = await docClient.send(new QueryCommand(shippingParams));
        data.shipping = shippingResult.Items || [];

        // Calculate summary
        const statusCounts = {};
        data.shipping.forEach(s => {
          const status = s.status || 'Unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        data.shippingSummary = {
          total: data.shipping.length,
          statusBreakdown: statusCounts
        };
      } catch (err) {
        console.log('Shipping fetch error:', err.message);
      }
    }

    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    return data;
  }
};

// Note: AI provider tracking moved to ai.config.js
// This service now uses smart fallback (Bedrock → Groq → Templates)

/**
 * Generate template-based response (fallback when Bedrock unavailable)
 */
const generateTemplateResponse = (intent, data) => {
  const { ordersSummary, marketingSummary, shippingSummary } = data;

  switch (intent.type) {
    case 'orders_today':
      if (ordersSummary) {
        return `You received ${ordersSummary.total} orders ${intent.timeframe} with a total revenue of ₹${ordersSummary.revenue.toLocaleString('en-IN')}. The average order value is ₹${ordersSummary.avgOrderValue.toLocaleString('en-IN')}.`;
      }
      return `No order data available for ${intent.timeframe}.`;

    case 'revenue':
      if (ordersSummary) {
        return `Your revenue for ${intent.timeframe} is ₹${ordersSummary.revenue.toLocaleString('en-IN')} from ${ordersSummary.total} orders. Average order value: ₹${ordersSummary.avgOrderValue.toLocaleString('en-IN')}.`;
      }
      return `No revenue data available for ${intent.timeframe}.`;

    case 'marketing':
      if (marketingSummary) {
        const roasText = marketingSummary.avgROAS > 0
          ? `ROAS: ${marketingSummary.avgROAS.toFixed(2)}x (₹${marketingSummary.totalRevenue.toLocaleString('en-IN')} revenue from ₹${marketingSummary.totalSpend.toLocaleString('en-IN')} spend)`
          : `ROAS: 0 (No revenue attributed to ad spend)`;

        let response = `Marketing performance for ${intent.timeframe}: Total spend ₹${marketingSummary.totalSpend.toLocaleString('en-IN')}, Reach: ${marketingSummary.totalReach.toLocaleString('en-IN')}, Clicks: ${marketingSummary.totalClicks.toLocaleString('en-IN')}, ${roasText}.`;

        // Add additional metrics if available from dashboard data
        if (marketingSummary.aov) {
          response += ` Average Order Value: ₹${marketingSummary.aov.toLocaleString('en-IN')}.`;
        }
        if (marketingSummary.cpp) {
          response += ` Cost Per Purchase: ₹${marketingSummary.cpp.toLocaleString('en-IN')}.`;
        }
        if (marketingSummary.orderCount) {
          response += ` Total Orders: ${marketingSummary.orderCount}.`;
        }

        return response;
      }
      return `No marketing data available for ${intent.timeframe}.`;

    case 'shipping':
      if (shippingSummary) {
        const statusStr = Object.entries(shippingSummary.statusBreakdown)
          .map(([status, count]) => `${status}: ${count}`)
          .join(', ');
        return `Shipping status: Total ${shippingSummary.total} shipments (${statusStr}).`;
      }
      return `No shipping data available.`;

    case 'general':
      const parts = [];
      if (ordersSummary) {
        parts.push(`Orders: ${ordersSummary.total} orders, Revenue: ₹${ordersSummary.revenue.toLocaleString('en-IN')}`);
      }
      if (marketingSummary) {
        const roasText = marketingSummary.avgROAS > 0
          ? `${marketingSummary.avgROAS.toFixed(2)}x ROAS`
          : `0 ROAS (no revenue from ads)`;
        parts.push(`Marketing: ₹${marketingSummary.totalSpend.toLocaleString('en-IN')} spend, ${roasText}`);
      }
      if (shippingSummary) {
        parts.push(`Shipping: ${shippingSummary.total} shipments`);
      }
      return parts.length > 0
        ? `Business overview for ${intent.timeframe}: ${parts.join('. ')}.`
        : `No data available for ${intent.timeframe}.`;

    default:
      return `I found some data for your query, but I'm currently in fallback mode. Please try again later for more detailed insights.`;
  }
};

/**
 * Generate AI response using Smart AI Config (Bedrock → Groq → Templates)
 * Automatically falls back through providers
 * 
 * @param {string} prompt - Complete prompt with context + question
 * @param {Object} intent - Parsed query intent
 * @param {Object} data - Business data summaries
 * @returns {Promise<string>} AI-generated or template response
 */
const generateAIResponse = async (prompt, intent, data) => {
  try {
    // Try smart AI (Bedrock → Groq fallback)
    const result = await generateSmartAIResponse(prompt);
    console.log(`✅ AI Response from: ${result.provider}`);
    return result.response;
  } catch (error) {
    // All AI providers failed, use template fallback
    console.log('⚠️ All AI providers unavailable, using template response');
    return generateTemplateResponse(intent, data);
  }
};

/**
 * Process chat query - Main orchestration function
 * 
 * COMPLETE FLOW:
 * 1. Parse Query Intent
 *    - Analyze user's question to understand what they're asking
 *    - Determine timeframe (today/week/month)
 * 
 * 2. Fetch Relevant Data
 *    - Query DynamoDB tables based on intent
 *    - Aggregate and summarize data
 *    - Calculate metrics (totals, averages, etc.)
 * 
 * 3. Build AI Context
 *    - Format data into human-readable summaries
 *    - Include only relevant information
 *    - Add currency formatting (₹)
 * 
 * 4. Generate AI Response
 *    - Send context + question to Claude 3 Sonnet
 *    - Get natural language answer
 *    - Return formatted response
 * 
 * EXAMPLE FLOW:
 * User asks: "How many orders today?"
 * → Intent: { type: 'orders_today', timeframe: 'today' }
 * → Fetch: Orders from midnight today
 * → Context: "Orders (today): 45 orders, Total Revenue: ₹125,000, Avg Order Value: ₹2,777"
 * → AI Response: "You've received 45 orders today with a total revenue of ₹125,000..."
 * 
 * @param {string} userId - User ID for data filtering
 * @param {string} query - User's natural language question
 * @returns {Promise<Object>} Response object with AI answer and metadata
 */
const processChatQuery = async (userId, query) => {
  try {
    // 1. Parse query intent
    const intent = parseQueryIntent(query);
    console.log('Query intent:', intent);

    // 2. Calculate date range for dashboard data
    let startDate = new Date();
    let endDate = new Date();

    if (intent.timeframe === 'custom' && intent.customDateRange) {
      startDate = intent.customDateRange.startDate;
      endDate = intent.customDateRange.endDate;
    } else if (intent.timeframe === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (intent.timeframe === 'yesterday') {
      startDate.setDate(endDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
    } else if (intent.timeframe === 'week') {
      startDate.setDate(endDate.getDate() - 7);
    } else if (intent.timeframe === 'month') {
      startDate.setMonth(endDate.getMonth() - 1);
    }

    // 3. Try to fetch comprehensive dashboard data, fallback to simple method if it fails
    let dashboardData = null;

    try {
      console.log('📊 Chatbot: Attempting comprehensive dashboard data fetch...');
      dashboardData = await fetchDashboardData(userId, startDate, endDate);

      if (dashboardData && !dashboardData.error) {
        console.log('✅ Chatbot: Comprehensive dashboard data fetched successfully');
      } else {
        console.log('⚠️ Chatbot: Comprehensive fetch returned error, falling back to simple method');
        throw new Error(dashboardData?.error || 'Comprehensive fetch failed');
      }
    } catch (comprehensiveError) {
      console.log('⚠️ Chatbot: Comprehensive dashboard fetch failed, using simple method:', comprehensiveError.message);

      // Fallback to the original simple data fetching method
      const data = await fetchRelevantData(userId, intent);

      // Convert simple data to dashboard format
      dashboardData = {
        shopify: {
          totalOrders: data.ordersSummary?.total || 0,
          revenue: data.ordersSummary?.revenue || 0,
          cogs: 0,
          adSpend: data.marketingSummary?.totalSpend || 0,
          shippingCost: 0,
          shippingPerOrder: 0,
          businessExpenses: 0,
          netProfit: (data.ordersSummary?.revenue || 0) - (data.marketingSummary?.totalSpend || 0),
          grossProfit: data.ordersSummary?.revenue || 0,
          grossProfitMargin: 0,
          netProfitMargin: 0,
          netProfitPerOrder: 0,
          roas: data.marketingSummary?.avgROAS || 0,
          poas: 0,
          aov: data.ordersSummary?.avgOrderValue || 0,
          cpp: 0
        },
        shiprocket: {
          revenue: data.ordersSummary?.revenue || 0,
          netProfit: (data.ordersSummary?.revenue || 0) - (data.marketingSummary?.totalSpend || 0),
          netProfitMargin: 0,
          netProfitPerOrder: 0,
          adSpend: data.marketingSummary?.totalSpend || 0,
          businessExpenses: 0,
          shippingCharges: 0,
          shippingPerOrder: 0,
          deliveredOrders: data.ordersSummary?.total || 0,
          roas: data.marketingSummary?.avgROAS || 0,
          aov: data.ordersSummary?.avgOrderValue || 0,
          cpp: 0,
          cogs: 0,
          grossProfit: 0
        },
        dateRange: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        },
        fallbackMode: true
      };
    }

    if (!dashboardData) {
      return {
        response: "I'm having trouble accessing your dashboard data right now. Please try again later.",
        intent: intent.type,
        timeframe: intent.timeframe,
        dataAvailable: false
      };
    }

    console.log('Dashboard data available:', {
      shopify: dashboardData.shopify ? Object.keys(dashboardData.shopify) : [],
      shiprocket: dashboardData.shiprocket ? Object.keys(dashboardData.shiprocket) : [],
      dateRange: dashboardData.dateRange,
      fallbackMode: dashboardData.fallbackMode || false
    });

    // 4. Build context for AI with exact dashboard metrics
    const now = new Date();
    let dateRangeText = '';

    if (intent.timeframe === 'custom' && intent.customDateRange) {
      const startStr = intent.customDateRange.startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const endStr = intent.customDateRange.endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      dateRangeText = `${startStr} to ${endStr}`;
    } else if (intent.timeframe === 'today') {
      dateRangeText = `Today (${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    } else if (intent.timeframe === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      dateRangeText = `Yesterday (${yesterday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    } else if (intent.timeframe === 'week') {
      const weekStart = new Date();
      weekStart.setDate(now.getDate() - 7);
      dateRangeText = `Last 7 days (${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    } else if (intent.timeframe === 'month') {
      const monthStart = new Date();
      monthStart.setMonth(now.getMonth() - 1);
      dateRangeText = `Last 30 days (${monthStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    }

    // Build comprehensive context with exact dashboard metrics (ONLY non-zero values)
    let contextParts = [];

    // Helper function to add metric only if non-zero
    const addMetric = (label, value, isPercentage = false, isCurrency = true) => {
      if (value === 0 || value === '0' || value === 0.00) return;

      let formattedValue;
      if (isPercentage) {
        formattedValue = `${value.toFixed(2)}%`;
      } else if (isCurrency) {
        formattedValue = `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
      } else {
        formattedValue = value.toString();
      }

      contextParts.push(`• ${label}: ${formattedValue}`);
    };

    // Shopify Dashboard Metrics (only non-zero)
    const shopify = dashboardData.shopify;
    contextParts.push(`BUSINESS DASHBOARD (${dateRangeText}):`);
    addMetric('Total Orders', shopify.totalOrders, false, false);
    if (shopify.cancelledOrders > 0) addMetric('Cancelled Orders', shopify.cancelledOrders, false, false);
    if (shopify.rtoCount > 0) addMetric('RTO Count', shopify.rtoCount, false, false);
    addMetric('Revenue', shopify.revenue);
    if (shopify.cogs > 0) addMetric('COGS', shopify.cogs);
    if (shopify.adSpend > 0) addMetric('Ad Spend', shopify.adSpend);
    if (shopify.shippingCost > 0) addMetric('Shipping Cost', shopify.shippingCost);
    if (shopify.shippingPerOrder > 0) addMetric('Shipping Per Order', shopify.shippingPerOrder);
    if (shopify.businessExpenses > 0) addMetric('Business Expenses', shopify.businessExpenses);
    addMetric('Money Kept', shopify.moneyKept || shopify.netProfit);
    if (shopify.grossProfit > 0) addMetric('Gross Profit', shopify.grossProfit);
    if (shopify.grossProfitMargin > 0) addMetric('Gross Profit Margin', shopify.grossProfitMargin, true);
    if (shopify.netProfitMargin !== 0) addMetric('Profit Margin', shopify.netProfitMargin, true);
    if (shopify.netProfitPerOrder !== 0) addMetric('Profit per Order', shopify.netProfitPerOrder);
    if (shopify.roas > 0) addMetric('ROAS', shopify.roas, false, false);
    if (shopify.poas !== 0) addMetric('POAS', shopify.poas, false, false);
    addMetric('AOV', shopify.aov);
    if (shopify.cpp > 0) addMetric('CPP', shopify.cpp);
    if (shopify.deliveredOrders > 0) addMetric('Delivered Orders', shopify.deliveredOrders, false, false);

    contextParts.push(''); // Empty line

    // Shiprocket Dashboard Metrics (only if available and non-zero)
    if (dashboardData.shiprocket) {
      const shiprocket = dashboardData.shiprocket;
      contextParts.push(`SHIPROCKET SHIPPING DATA (${dateRangeText}):`);
      if (shiprocket.deliveredRevenue > 0) addMetric('Revenue Earned (Delivered Only)', shiprocket.deliveredRevenue);
      if (shiprocket.deliveredOrders > 0) addMetric('Delivered Orders', shiprocket.deliveredOrders, false, false);
      if (shiprocket.rtoOrders > 0) addMetric('RTO Orders', shiprocket.rtoOrders, false, false);
      if (shiprocket.canceledOrders > 0) addMetric('Canceled Orders', shiprocket.canceledOrders, false, false);
      if (shiprocket.shippingCost > 0) addMetric('Shipping Spend', shiprocket.shippingCost);
      if (shiprocket.deliveredFreight > 0) addMetric('Delivered Freight', shiprocket.deliveredFreight);
      if (shiprocket.rtoFreight > 0) addMetric('RTO Freight', shiprocket.rtoFreight);
      if (shiprocket.moneyKept > 0) addMetric('Money Kept (Shiprocket)', shiprocket.moneyKept);
      if (shiprocket.deliveryRate) addMetric('Delivery Rate', shiprocket.deliveryRate, true, false);
      if (shiprocket.rtoRate) addMetric('RTO Rate', shiprocket.rtoRate, true, false);
      contextParts.push(''); // Empty line
    }

    const context = contextParts.join('\n');

    // 5. Generate AI response (with fallback)
    let prompt = '';

    if (intent.timeframe === 'future') {
      // For future predictions, redirect to AI Growth dashboard
      prompt = `You are a helpful e-commerce business analytics assistant.

User Question: ${query}

The user is asking about future predictions (tomorrow, next month, etc.).

Respond politely that:
1. You can only provide historical data (past performance)
2. For future predictions and forecasts, they should check the "AI Growth" dashboard
3. The AI Growth dashboard provides AI-powered predictions for next month's revenue, orders, and other metrics

Be friendly and helpful in your response.`;
    } else {
      // For historical data queries with comprehensive dashboard metrics
      prompt = `You are a concise business analytics assistant. Answer ONLY what the user asks - nothing more.

BUSINESS DATA:
${context}

USER QUESTION: ${query}

CRITICAL INSTRUCTIONS:
- Answer ONLY the specific question asked - be direct and brief
- If asked "what is my revenue", respond with JUST the revenue number, nothing else
- If asked "hello" or greetings, respond with a brief friendly greeting only
- DO NOT provide unsolicited information or full dashboard summaries unless specifically asked
- ONLY mention metrics that are provided in the data above
- DO NOT mention or discuss any metric that shows ₹0, 0, or 0.00%
- Use exact numbers from the dashboard data above
- Format currency as ₹X,XXX (Indian format)
- Keep responses under 3 sentences unless asked for detailed analysis
- Be conversational but precise and brief`;
    }

    const aiResponse = await generateAIResponse(prompt, intent, { dashboardData });

    return {
      response: aiResponse,
      intent: intent.type,
      timeframe: intent.timeframe,
      dataAvailable: true,
      dashboardData: dashboardData
    };
  } catch (error) {
    console.error('Error processing chat query:', error);
    throw error;
  }
};

module.exports = {
  processChatQuery,
  generateAIResponse
};
