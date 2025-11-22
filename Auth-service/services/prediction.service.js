/**
 * Prediction Service with Fallback
 * AI-powered predictions using direct DB data + Bedrock (with fallback)
 */

const { InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { initializeBedrock, BEDROCK_MODELS } = require('../config/bedrock.config');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

// Track Bedrock availability
let bedrockAvailable = true;
let lastBedrockCheck = null;
const BEDROCK_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

/**
 * Generate AI response using Claude 3 Sonnet (us-east-1)
 * Falls back to statistical prediction if Bedrock unavailable
 * @param {string} prompt - Complete prompt
 * @returns {Promise<string>} AI response
 */
const generateAIResponse = async (prompt) => {
  // Check if we should try Bedrock
  const now = Date.now();
  if (!bedrockAvailable && lastBedrockCheck && (now - lastBedrockCheck) < BEDROCK_CHECK_INTERVAL) {
    throw new Error('BEDROCK_UNAVAILABLE');
  }

  try {
    const bedrockClient = initializeBedrock();
    
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5
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
    throw new Error('BEDROCK_UNAVAILABLE');
  }
};

/**
 * Get historical metrics for predictions
 * @param {string} userId - User ID
 * @param {number} months - Number of months to fetch
 * @returns {Promise<Object>} Historical metrics
 */
const getHistoricalMetrics = async (userId, months = 3) => {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - months);

    // Fetch Shopify orders
    const ordersParams = {
      TableName: process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'created_at >= :date',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':date': threeMonthsAgo.toISOString()
      }
    };

    const ordersResult = await docClient.send(new QueryCommand(ordersParams));
    const orders = ordersResult.Items || [];

    // Calculate monthly metrics
    const monthlyMetrics = {};
    orders.forEach(order => {
      const month = new Date(order.created_at).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyMetrics[month]) {
        monthlyMetrics[month] = { 
          revenue: 0, 
          orders: 0, 
          cogs: 0,
          items: 0
        };
      }
      monthlyMetrics[month].revenue += parseFloat(order.total_price || 0);
      monthlyMetrics[month].orders += 1;
      monthlyMetrics[month].cogs += parseFloat(order.total_cost || 0);
      monthlyMetrics[month].items += parseInt(order.line_items?.length || 0);
    });

    // Fetch Meta insights
    const metaParams = {
      TableName: process.env.META_INSIGHTS_TABLE || 'meta_insights',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#date >= :date',
      ExpressionAttributeNames: { '#date': 'date' },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':date': threeMonthsAgo.toISOString().slice(0, 10)
      }
    };

    const metaResult = await docClient.send(new QueryCommand(metaParams));
    const metaInsights = metaResult.Items || [];

    const monthlyAdSpend = {};
    metaInsights.forEach(insight => {
      const month = insight.date.slice(0, 7);
      if (!monthlyAdSpend[month]) monthlyAdSpend[month] = 0;
      monthlyAdSpend[month] += parseFloat(insight.spend || 0);
    });

    return { monthlyMetrics, monthlyAdSpend };
  } catch (error) {
    console.error('Error fetching historical metrics:', error);
    throw error;
  }
};

/**
 * Statistical prediction fallback (when Bedrock unavailable)
 * Uses linear regression and moving averages
 */
const generateStatisticalPredictions = (historicalData) => {
  const months = Object.keys(historicalData).sort();
  
  if (months.length === 0) {
    throw new Error('No historical data available');
  }

  // Calculate trends
  const revenues = months.map(m => historicalData[m].revenue);
  const orders = months.map(m => historicalData[m].orders);
  
  // Simple linear trend
  const avgRevenueGrowth = calculateGrowthRate(revenues);
  const avgOrderGrowth = calculateGrowthRate(orders);
  
  // Predict next month
  const lastRevenue = revenues[revenues.length - 1];
  const lastOrders = orders[orders.length - 1];
  
  const predictedRevenue = lastRevenue * (1 + avgRevenueGrowth);
  const predictedOrders = Math.round(lastOrders * (1 + avgOrderGrowth));
  
  // Calculate other metrics
  const avgCOGSRatio = 0.35; // 35% COGS
  const predictedCOGS = predictedRevenue * avgCOGSRatio;
  const predictedGrossProfit = predictedRevenue - predictedCOGS;
  
  // Recommend ad spend (10-15% of revenue)
  const recommendedAdSpend = predictedRevenue * 0.12;
  const predictedROAS = predictedRevenue / recommendedAdSpend;
  
  // Estimate net profit
  const otherExpenses = predictedRevenue * 0.15; // 15% for shipping, etc
  const predictedProfit = predictedGrossProfit - recommendedAdSpend - otherExpenses;
  
  return {
    revenue: Math.round(predictedRevenue),
    orders: predictedOrders,
    profit: Math.round(predictedProfit),
    adSpend: Math.round(recommendedAdSpend),
    roas: parseFloat(predictedROAS.toFixed(2)),
    confidence: months.length >= 3 ? 'medium' : 'low',
    insights: `Based on ${months.length} months of data, revenue is trending ${avgRevenueGrowth > 0 ? 'upward' : 'downward'} at ${(avgRevenueGrowth * 100).toFixed(1)}% per month.`,
    method: 'statistical'
  };
};

/**
 * Calculate growth rate from array of values
 */
const calculateGrowthRate = (values) => {
  if (values.length < 2) return 0;
  
  let totalGrowth = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) {
      totalGrowth += (values[i] - values[i - 1]) / values[i - 1];
    }
  }
  
  return totalGrowth / (values.length - 1);
};

/**
 * Generate predictions using Bedrock AI or statistical fallback
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Predictions for next month
 */
const generatePredictions = async (userId) => {
  try {
    const { monthlyMetrics, monthlyAdSpend } = await getHistoricalMetrics(userId, 6);

    const months = Object.keys(monthlyMetrics).sort();
    if (months.length === 0) {
      throw new Error('No historical data available for predictions');
    }

    console.log(`📊 Generating predictions for user ${userId} with ${months.length} months of data`);

    // Build historical summary
    const historicalData = months.map(month => {
      const metrics = monthlyMetrics[month];
      const adSpend = monthlyAdSpend[month] || 0;
      const profit = metrics.revenue - metrics.cogs - adSpend;
      const roas = adSpend > 0 ? (metrics.revenue / adSpend) : 0;
      
      return {
        month,
        revenue: parseFloat(metrics.revenue.toFixed(2)),
        orders: metrics.orders,
        adSpend: parseFloat(adSpend.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        roas: parseFloat(roas.toFixed(2))
      };
    });

    let predictions;
    let usedAI = false;

    // Try Bedrock AI first
    try {
      const prompt = `You are a business analytics AI. Analyze the following historical data and predict next month's metrics.

Historical Data (last ${months.length} months):
${JSON.stringify(historicalData, null, 2)}

Based on the trends in this data, predict the following for next month:
1. Revenue (in ₹)
2. Number of Orders
3. Profit (in ₹)
4. Recommended Ad Spend (in ₹)
5. Expected ROAS

Provide your predictions in this EXACT JSON format (numbers only, no currency symbols):
{
  "revenue": <number>,
  "orders": <number>,
  "profit": <number>,
  "adSpend": <number>,
  "roas": <number>,
  "confidence": "<low|medium|high>",
  "insights": "<brief explanation of the prediction>"
}`;

      const response = await generateAIResponse(prompt);
      
      // Parse AI response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        predictions = JSON.parse(jsonMatch[0]);
        predictions.method = 'ai';
        usedAI = true;
        console.log('✅ Using AI predictions from Bedrock');
      } else {
        throw new Error('Invalid AI response format');
      }
    } catch (aiError) {
      if (aiError.message === 'BEDROCK_UNAVAILABLE') {
        console.log('⚠️  Bedrock unavailable, using statistical predictions');
      } else {
        console.log('⚠️  AI prediction failed, using statistical fallback:', aiError.message);
      }
      
      // Fallback to statistical predictions
      predictions = generateStatisticalPredictions(monthlyMetrics);
    }

    return {
      predictions,
      historicalData: monthlyMetrics,
      monthlyTrends: historicalData,
      usedAI
    };
  } catch (error) {
    console.error('Error generating predictions:', error);
    throw error;
  }
};

module.exports = {
  generatePredictions,
  getHistoricalMetrics
};
