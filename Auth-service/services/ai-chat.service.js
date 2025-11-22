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
  
  // Today's orders
  if (lowerQuery.includes('today') && (lowerQuery.includes('order') || lowerQuery.includes('sale'))) {
    return { type: 'orders_today', timeframe: 'today' };
  }
  
  // Revenue queries
  if (lowerQuery.includes('revenue') || lowerQuery.includes('sales')) {
    if (lowerQuery.includes('today')) return { type: 'revenue', timeframe: 'today' };
    if (lowerQuery.includes('week')) return { type: 'revenue', timeframe: 'week' };
    if (lowerQuery.includes('month')) return { type: 'revenue', timeframe: 'month' };
    return { type: 'revenue', timeframe: 'month' };
  }
  
  // Marketing queries
  if (lowerQuery.includes('ad') || lowerQuery.includes('marketing') || lowerQuery.includes('roas')) {
    return { type: 'marketing', timeframe: 'week' };
  }
  
  // Shipping queries
  if (lowerQuery.includes('ship') || lowerQuery.includes('deliver')) {
    return { type: 'shipping', timeframe: 'today' };
  }
  
  // General query
  return { type: 'general', timeframe: 'week' };
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
    if (intent.timeframe === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (intent.timeframe === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (intent.timeframe === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    }

    // Fetch Orders
    if (intent.type === 'orders_today' || intent.type === 'revenue' || intent.type === 'general') {
      try {
        const ordersParams = {
          TableName: process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders',
          KeyConditionExpression: 'userId = :userId',
          FilterExpression: 'created_at >= :startDate',
          ExpressionAttributeValues: {
            ':userId': userId,
            ':startDate': startDate.toISOString()
          },
          Limit: 50
        };

        const ordersResult = await docClient.send(new QueryCommand(ordersParams));
        data.orders = ordersResult.Items || [];
        
        // Calculate summary
        data.ordersSummary = {
          total: data.orders.length,
          revenue: data.orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0),
          avgOrderValue: data.orders.length > 0 
            ? data.orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0) / data.orders.length 
            : 0
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
          totalSpend: data.marketing.reduce((sum, m) => sum + (parseFloat(m.spend) || 0), 0),
          totalReach: data.marketing.reduce((sum, m) => sum + (parseInt(m.reach) || 0), 0),
          totalClicks: data.marketing.reduce((sum, m) => sum + (parseInt(m.clicks) || 0), 0),
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

// Track Bedrock availability
let bedrockAvailable = true;
let lastBedrockCheck = null;
const BEDROCK_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

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
 * Generate AI response using Claude 3 Sonnet
 * Falls back to template responses if Bedrock unavailable
 * 
 * @param {string} prompt - Complete prompt with context + question
 * @param {Object} intent - Parsed query intent
 * @param {Object} data - Business data summaries
 * @returns {Promise<string>} AI-generated or template response
 */
const generateAIResponse = async (prompt, intent, data) => {
  // Check if we should try Bedrock
  const now = Date.now();
  if (!bedrockAvailable && lastBedrockCheck && (now - lastBedrockCheck) < BEDROCK_CHECK_INTERVAL) {
    console.log('⚠️  Bedrock unavailable, using template response');
    return generateTemplateResponse(intent, data);
  }

  try {
    const bedrockClient = initializeBedrock();
    
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Bedrock is working
    bedrockAvailable = true;
    lastBedrockCheck = now;
    
    return responseBody.content[0].text;
  } catch (error) {
    console.error('Bedrock error:', error.message);
    bedrockAvailable = false;
    lastBedrockCheck = now;
    
    // Fallback to template response
    console.log('⚠️  Using template response fallback');
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

    // 3. Build context for AI
    let contextParts = [];
    
    if (data.ordersSummary) {
      contextParts.push(`Orders (${intent.timeframe}): ${data.ordersSummary.total} orders, Total Revenue: ₹${data.ordersSummary.revenue.toFixed(2)}, Avg Order Value: ₹${data.ordersSummary.avgOrderValue.toFixed(2)}`);
    }
    
    if (data.marketingSummary) {
      contextParts.push(`Marketing (${intent.timeframe}): Spend: ₹${data.marketingSummary.totalSpend.toFixed(2)}, Reach: ${data.marketingSummary.totalReach.toLocaleString()}, Clicks: ${data.marketingSummary.totalClicks}, Avg ROAS: ${data.marketingSummary.avgROAS.toFixed(2)}`);
    }
    
    if (data.shippingSummary) {
      const statusStr = Object.entries(data.shippingSummary.statusBreakdown)
        .map(([status, count]) => `${status}: ${count}`)
        .join(', ');
      contextParts.push(`Shipping: Total ${data.shippingSummary.total} shipments (${statusStr})`);
    }

    const context = contextParts.length > 0 
      ? contextParts.join('\n') 
      : 'No recent data available for this query.';

    // 4. Generate AI response (with fallback)
    const prompt = `You are a helpful e-commerce business analytics assistant. 
Answer questions based ONLY on the provided business data. 
Be concise, friendly, and provide actionable insights.
Always format currency as ₹ (Indian Rupees).

Business Data:
${context}

User Question: ${query}

Provide a clear, helpful answer based on the data above.`;

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
