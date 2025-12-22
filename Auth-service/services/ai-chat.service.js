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

        // Fetch all orders with pagination (DynamoDB has 1MB limit per query)
        let allOrders = [];
        let lastEvaluatedKey = null;
        
        do {
          const command = new QueryCommand({
            ...ordersParams,
            ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
          });
          
          const result = await docClient.send(command);
          allOrders = allOrders.concat(result.Items || []);
          lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);
        
        console.log(`📦 Chatbot: Total orders in DB: ${allOrders.length}`);
        
        // Filter by date in JavaScript (same as dashboard)
        data.orders = allOrders.filter(order => {
          if (!order.createdAt) return false;
          const orderDate = new Date(order.createdAt);
          // For custom date range, yesterday, day before yesterday - filter between start and end
          if (intent.timeframe === 'custom' || intent.timeframe === 'yesterday' || intent.timeframe === 'day_before_yesterday') {
            return orderDate >= startDate && orderDate <= endDate;
          }
          return orderDate >= startDate && orderDate <= endDate;
        });
        
        // Exclude cancelled/refunded orders (same as dashboard)
        data.orders = data.orders.filter(order => {
          const financialStatus = (order.financialStatus || '').toLowerCase();
          return !(financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled');
        });
        
        console.log(`📦 Chatbot: Found ${allOrders.length} total orders, ${data.orders.length} in timeframe (${intent.timeframe})`);
        
        // Log date range for debugging
        if (data.orders.length === 0 && allOrders.length > 0) {
          const orderDates = allOrders
            .filter(o => o.createdAt)
            .map(o => new Date(o.createdAt).toISOString().split('T')[0])
            .sort();
          if (orderDates.length > 0) {
            console.log(`⚠️  Chatbot: No orders in timeframe. Available: ${orderDates[0]} to ${orderDates[orderDates.length - 1]}`);
          }
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
        data.marketingSummary = {
          totalSpend: data.marketing.reduce((sum, m) => sum + (parseFloat(m.adSpend) || 0), 0),
          totalReach: data.marketing.reduce((sum, m) => sum + (parseInt(m.reach) || 0), 0),
          totalClicks: data.marketing.reduce((sum, m) => sum + (parseInt(m.linkClicks) || 0), 0),
          avgROAS: data.marketing.length > 0
            ? data.marketing.reduce((sum, m) => sum + (parseFloat(m.roas) || 0), 0) / data.marketing.length
            : 0
        };
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
        return `Marketing performance for ${intent.timeframe}: Total spend ₹${marketingSummary.totalSpend.toLocaleString('en-IN')}, Reach: ${marketingSummary.totalReach.toLocaleString('en-IN')}, Clicks: ${marketingSummary.totalClicks.toLocaleString('en-IN')}, Average ROAS: ${marketingSummary.avgROAS.toFixed(2)}x.`;
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
        parts.push(`Marketing: ₹${marketingSummary.totalSpend.toLocaleString('en-IN')} spend, ${marketingSummary.avgROAS.toFixed(2)}x ROAS`);
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

    // 2. Fetch relevant data from DynamoDB
    const data = await fetchRelevantData(userId, intent);
    console.log('Fetched data summaries:', {
      orders: data.ordersSummary,
      marketing: data.marketingSummary,
      shipping: data.shippingSummary
    });

    // 3. Build context for AI with actual date range
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
    } else if (intent.timeframe === 'day_before_yesterday') {
      const dayBefore = new Date();
      dayBefore.setDate(now.getDate() - 2);
      dateRangeText = `Day before yesterday (${dayBefore.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    } else if (intent.timeframe === 'week') {
      const weekStart = new Date();
      weekStart.setDate(now.getDate() - 7);
      dateRangeText = `Last 7 days (${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    } else if (intent.timeframe === 'month') {
      const monthStart = new Date();
      monthStart.setMonth(now.getMonth() - 1);
      dateRangeText = `Last 30 days (${monthStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    } else if (intent.timeframe === 'future') {
      dateRangeText = `Future predictions`;
    }
    
    let contextParts = [];
    
    if (data.ordersSummary) {
      contextParts.push(`Orders (${dateRangeText}): ${data.ordersSummary.total} orders, Total Revenue: ₹${data.ordersSummary.revenue.toFixed(2)}, Avg Order Value: ₹${data.ordersSummary.avgOrderValue.toFixed(2)}`);
    }
    
    if (data.marketingSummary) {
      contextParts.push(`Marketing (${dateRangeText}): Spend: ₹${data.marketingSummary.totalSpend.toFixed(2)}, Reach: ${data.marketingSummary.totalReach.toLocaleString()}, Clicks: ${data.marketingSummary.totalClicks}, Avg ROAS: ${data.marketingSummary.avgROAS.toFixed(2)}`);
    }
    
    if (data.shippingSummary) {
      const statusStr = Object.entries(data.shippingSummary.statusBreakdown)
        .map(([status, count]) => `${status}: ${count}`)
        .join(', ');
      contextParts.push(`Shipping (${dateRangeText}): Total ${data.shippingSummary.total} shipments (${statusStr})`);
    }

    const context = contextParts.length > 0 
      ? contextParts.join('\n') 
      : 'No recent data available for this query.';

    // 4. Generate AI response (with fallback)
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
      // For historical data queries
      prompt = `You are a helpful e-commerce business analytics assistant. 
Answer questions based ONLY on the provided business data. 
Be concise, friendly, and provide actionable insights.
Always format currency as ₹ (Indian Rupees).

Business Data:
${context}

User Question: ${query}

Provide a clear, helpful answer based on the data above.`;
    }

    const aiResponse = await generateAIResponse(prompt, intent, data);
    
    return {
      response: aiResponse,
      intent: intent.type,
      timeframe: intent.timeframe,
      dataAvailable: contextParts.length > 0
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
