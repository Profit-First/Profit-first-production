/**
 * Prediction Service with Fallback
 * AI-powered predictions using direct DB data + Bedrock (with fallback)
 */

const { InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { initializeBedrock, BEDROCK_MODELS } = require('../config/bedrock.config');
const { generateAIResponse: generateSmartAIResponse } = require('../config/ai.config');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

// Note: AI provider tracking moved to ai.config.js
// This service now uses smart fallback (Bedrock → Groq → Statistical)

/**
 * Generate AI response using Smart AI Config (Bedrock → Groq fallback)
 * @param {string} prompt - Complete prompt
 * @returns {Promise<string>} AI response
 */
const generateAIResponse = async (prompt) => {
  try {
    // Try smart AI (Bedrock → Groq fallback)
    const result = await generateSmartAIResponse(prompt);
    console.log(`✅ Prediction AI from: ${result.provider}`);
    return result.response;
  } catch (error) {
    // All AI providers failed
    console.error('❌ All AI providers unavailable for predictions');
    throw new Error('AI_UNAVAILABLE');
  }
};

/**
 * Get historical metrics for predictions
 * Uses the SAME data fetching logic as dashboard controller for consistency
 * @param {string} userId - User ID
 * @param {number} months - Number of months to fetch (default 2: previous + current)
 * @returns {Promise<Object>} Historical metrics
 */
const getHistoricalMetrics = async (userId, months = 2) => {
  try {
    // Calculate date range: 1 month before current + current month
    // For Dec 12, 2025: November 1st to December 12th
    const currentDate = new Date();
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1); // First day of previous month
    const endDate = currentDate; // Today
    
    const startDateStr = startDate.toISOString().slice(0, 10); // YYYY-MM-DD
    const endDateStr = endDate.toISOString().slice(0, 10); // YYYY-MM-DD

    console.log(`\n🔍 ===== FETCHING HISTORICAL DATA (Same as Dashboard) =====`);
    console.log(`📅 Date Range: ${startDateStr} to ${endDateStr}`);
    console.log(`👤 User ID: ${userId}`);

    // Fetch Shopify orders - SAME as dashboard controller
    const ordersParams = {
      TableName: process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      // Same projection as dashboard
      ProjectionExpression: 'userId, orderId, totalPrice, subtotalPrice, createdAt, lineItems, customerId, customer, orderData, financialStatus, fulfillmentStatus'
    };

    const ordersResult = await docClient.send(new QueryCommand(ordersParams));
    const allOrders = ordersResult.Items || [];
    
    // Filter by date in JavaScript - SAME as dashboard controller
    const orders = allOrders.filter(order => {
      if (!order.createdAt) return false;
      // Extract date from timestamp (YYYY-MM-DD)
      const orderDate = order.createdAt.split('T')[0];
      // Compare dates as strings (works because ISO format)
      return orderDate >= startDateStr && orderDate <= endDateStr;
    });
    
    console.log(`📦 Orders Found: ${allOrders.length} total, ${orders.length} in date range`);

    // Calculate monthly metrics - SAME logic as dashboard calculateSummary
    const monthlyMetrics = {};
    
    orders.forEach(order => {
      // Skip cancelled, refunded, or voided orders - SAME as dashboard
      const financialStatus = (order.financialStatus || '').toLowerCase();
      if (financialStatus === 'refunded' || financialStatus === 'voided' || financialStatus === 'cancelled') {
        console.log(`⚠️  Excluding order ${order.orderId} from predictions (status: ${financialStatus})`);
        return; // Skip this order
      }

      const month = order.createdAt.slice(0, 7); // YYYY-MM from createdAt
      if (!monthlyMetrics[month]) {
        monthlyMetrics[month] = { 
          revenue: 0, 
          orders: 0, 
          cogs: 0,
          items: 0
        };
      }
      
      // Use subtotalPrice if available (product revenue only) - SAME as dashboard
      // subtotalPrice = product prices only (matches Shopify Analytics "Total Sales")
      // totalPrice = products + shipping + tax - discounts
      const subtotal = parseFloat(order.subtotalPrice || 0);
      const total = parseFloat(order.totalPrice || 0);
      const revenue = subtotal > 0 ? subtotal : total;
      
      monthlyMetrics[month].revenue += revenue;
      monthlyMetrics[month].orders += 1;
      monthlyMetrics[month].cogs += parseFloat(order.totalCost || 0);
      monthlyMetrics[month].items += (order.lineItems || []).length;
    });

    console.log(`\n📊 MONTHLY METRICS BREAKDOWN:`);
    Object.keys(monthlyMetrics).sort().forEach(month => {
      const m = monthlyMetrics[month];
      console.log(`  ${month}: ₹${m.revenue.toFixed(2)} revenue, ${m.orders} orders`);
    });

    // Fetch Meta insights - SAME as dashboard controller
    const metaParams = {
      TableName: process.env.META_INSIGHTS_TABLE || 'meta_insights',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ProjectionExpression: 'userId, #date, adSpend, reach, linkClicks, impressions, metaRevenue',
      ExpressionAttributeNames: {
        '#date': 'date'
      }
    };

    const metaResult = await docClient.send(new QueryCommand(metaParams));
    const allInsights = metaResult.Items || [];
    
    // Filter by date range in JavaScript - SAME as dashboard
    const metaInsights = allInsights.filter(insight => {
      if (!insight.date) return false;
      return insight.date >= startDateStr && insight.date <= endDateStr;
    });

    console.log(`💰 Meta Insights Found: ${allInsights.length} total, ${metaInsights.length} in date range`);

    // Calculate monthly ad spend
    const monthlyAdSpend = {};
    metaInsights.forEach(insight => {
      const month = insight.date.slice(0, 7); // YYYY-MM
      if (!monthlyAdSpend[month]) monthlyAdSpend[month] = 0;
      monthlyAdSpend[month] += parseFloat(insight.adSpend || 0);
    });

    console.log(`\n💸 MONTHLY AD SPEND:`);
    Object.keys(monthlyAdSpend).sort().forEach(month => {
      console.log(`  ${month}: ₹${monthlyAdSpend[month].toFixed(2)}`);
    });
    console.log(`🔍 ===== DATA FETCH COMPLETE =====\n`);

    return { monthlyMetrics, monthlyAdSpend };
  } catch (error) {
    console.error('❌ Error fetching historical metrics:', error);
    throw error;
  }
};

/**
 * Statistical prediction fallback for multiple months (when Bedrock unavailable)
 * Uses linear regression and moving averages
 */
const generateStatisticalPredictionsMultiMonth = (historicalData, numMonths = 3) => {
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
  
  const predictions = [];
  let lastRevenue = revenues[revenues.length - 1];
  let lastOrders = orders[orders.length - 1];
  
  // Generate predictions for each month
  for (let i = 1; i <= numMonths; i++) {
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
    
    predictions.push({
      month: i,
      revenue: Math.round(predictedRevenue),
      orders: predictedOrders,
      profit: Math.round(predictedProfit),
      adSpend: Math.round(recommendedAdSpend),
      roas: parseFloat(predictedROAS.toFixed(2)),
      confidence: months.length >= 3 ? 'medium' : 'low',
      insights: `Month ${i}: Based on ${months.length} months of data, revenue trending ${avgRevenueGrowth > 0 ? 'upward' : 'downward'} at ${(avgRevenueGrowth * 100).toFixed(1)}% per month.`,
      method: 'statistical'
    });
    
    // Update for next iteration
    lastRevenue = predictedRevenue;
    lastOrders = predictedOrders;
  }
  
  return predictions;
};

/**
 * Statistical prediction fallback (when Bedrock unavailable)
 * Uses linear regression and moving averages
 * @deprecated Use generateStatisticalPredictionsMultiMonth instead
 */
const generateStatisticalPredictions = (historicalData) => {
  return generateStatisticalPredictionsMultiMonth(historicalData, 1)[0];
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
 * @returns {Promise<Object>} Predictions for next 3 months
 */
const generatePredictions = async (userId) => {
  try {
    const { monthlyMetrics, monthlyAdSpend } = await getHistoricalMetrics(userId, 2);

    const months = Object.keys(monthlyMetrics).sort();
    if (months.length === 0) {
      throw new Error('No historical data available for predictions');
    }

    console.log(`\n🤖 ===== GENERATING PREDICTIONS =====`);
    console.log(`📊 Using ${months.length} months of historical data`);

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

    console.log(`\n📈 HISTORICAL SUMMARY FOR AI:`);
    historicalData.forEach(data => {
      console.log(`  ${data.month}: Rev ₹${data.revenue}, Orders ${data.orders}, Profit ₹${data.profit}, ROAS ${data.roas}x`);
    });

    let predictions = [];
    let usedAI = false;

    // Try Bedrock AI first for 3 months prediction
    try {
      console.log(`\n🧠 Attempting AI prediction (Bedrock/Groq)...`);
      
      const prompt = `You are a business analytics AI. Analyze the following historical data and predict the next 3 months' metrics.

Historical Data (last ${months.length} months):
${JSON.stringify(historicalData, null, 2)}

Based on the trends in this data, predict the following for the NEXT 3 MONTHS:
1. Revenue (in ₹)
2. Number of Orders
3. Profit (in ₹)
4. Recommended Ad Spend (in ₹)
5. Expected ROAS

Provide your predictions in this EXACT JSON format (array of 3 months):
[
  {
    "month": 1,
    "revenue": <number>,
    "orders": <number>,
    "profit": <number>,
    "adSpend": <number>,
    "roas": <number>
  },
  {
    "month": 2,
    "revenue": <number>,
    "orders": <number>,
    "profit": <number>,
    "adSpend": <number>,
    "roas": <number>
  },
  {
    "month": 3,
    "revenue": <number>,
    "orders": <number>,
    "profit": <number>,
    "adSpend": <number>,
    "roas": <number>
  }
]`;

      const response = await generateAIResponse(prompt);
      
      // Parse AI response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        predictions = JSON.parse(jsonMatch[0]);
        predictions.forEach(p => p.method = 'ai');
        usedAI = true;
        console.log('✅ AI prediction successful!');
        console.log(`\n🔮 AI PREDICTIONS (Next 3 Months):`);
        predictions.forEach((pred, idx) => {
          console.log(`  Month ${idx + 1}: Rev ₹${pred.revenue}, Orders ${pred.orders}, Profit ₹${pred.profit}, ROAS ${pred.roas}x`);
        });
      } else {
        throw new Error('Invalid AI response format');
      }
    } catch (aiError) {
      if (aiError.message === 'AI_UNAVAILABLE' || aiError.message === 'ALL_AI_PROVIDERS_UNAVAILABLE') {
        console.log('⚠️  All AI providers unavailable, using statistical predictions');
      } else {
        console.log('⚠️  AI prediction failed, using statistical fallback:', aiError.message);
      }
      
      // Fallback to statistical predictions for 3 months
      console.log(`\n📊 Using Statistical Prediction Method...`);
      predictions = generateStatisticalPredictionsMultiMonth(monthlyMetrics, 3);
      console.log(`\n🔮 STATISTICAL PREDICTIONS (Next 3 Months):`);
      predictions.forEach((pred, idx) => {
        console.log(`  Month ${idx + 1}: Rev ₹${pred.revenue}, Orders ${pred.orders}, Profit ₹${pred.profit}, ROAS ${pred.roas}x`);
      });
    }

    console.log(`\n✅ Prediction Method: ${usedAI ? 'AI (Bedrock/Groq)' : 'Statistical'}`);
    console.log(`🤖 ===== PREDICTIONS COMPLETE =====\n`);

    return {
      predictions,
      historicalData: monthlyMetrics,
      monthlyTrends: historicalData,
      usedAI
    };
  } catch (error) {
    console.error('❌ Error generating predictions:', error);
    throw error;
  }
};

module.exports = {
  generatePredictions,
  getHistoricalMetrics
};
