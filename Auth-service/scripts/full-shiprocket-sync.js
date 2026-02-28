/**
 * Full Shiprocket Sync - Fetch ALL data and save to DynamoDB
 * 
 * This script will:
 * 1. Fetch all orders and shipments from Shiprocket API
 * 2. Merge the data
 * 3. Save to DynamoDB
 * 4. Show detailed statistics
 */

require('dotenv').config();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ 
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
const docClient = DynamoDBDocumentClient.from(client);

const USER_ID = "61d31d1a-a0c1-7076-812f-d55319141da2";

async function fullSync() {
  try {
    console.log('\n🚀 Starting Full Shiprocket Sync\n');
    console.log(`👤 User: ${USER_ID}`);
    console.log(`📅 Date Range: Last 90 days\n`);

    // Step 1: Get token
    console.log('📡 Step 1: Getting Shiprocket token...');
    const getCommand = new GetCommand({
      TableName: 'shipping_connections',
      Key: { userId: USER_ID }
    });

    const result = await docClient.send(getCommand);
    if (!result.Item || !result.Item.token) {
      console.log('❌ No token found. User needs to connect Shiprocket first.');
      process.exit(1);
    }

    const token = result.Item.token;
    console.log('✅ Token found\n');

    // Step 2: Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`📅 Syncing from ${startDateStr} to ${endDateStr}\n`);

    // Step 3: Use the shiprocket service to sync
    console.log('📦 Step 3: Starting sync using service...\n');
    
    const shiprocketService = require('../services/shiprocket.service');
    
    // Use getShiprocketDataWithCache with force refresh and higher limits
    const syncResult = await shiprocketService.getShiprocketDataWithCache(
      USER_ID,
      token,
      startDateStr,
      endDateStr,
      {
        forceRefresh: true,      // Force fresh fetch
        cacheTTLHours: 24,       // Cache for 24 hours
        maxPages: 50,            // Fetch up to 50 pages (12,500 records)
        perPage: 250             // 250 per page
      }
    );

    if (!syncResult.success) {
      console.log(`\n❌ Sync failed: ${syncResult.error}`);
      process.exit(1);
    }

    const shipments = syncResult.shipments || [];
    console.log(`\n✅ Sync completed!`);
    console.log(`📦 Total records fetched: ${shipments.length}`);
    console.log(`📊 Source: ${syncResult.source}\n`);

    if (shipments.length === 0) {
      console.log('⚠️  No shipments found');
      process.exit(0);
    }

    // Step 4: Analyze the data
    console.log('📊 Analyzing synced data...\n');

    // Count by status
    const statusCounts = {};
    const statusCodeCounts = {};
    let deliveredCount = 0;
    
    shipments.forEach(s => {
      const status = (s.status || 'NO_STATUS').toUpperCase();
      const code = s.statusCode || 'NO_CODE';
      
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      statusCodeCounts[code] = (statusCodeCounts[code] || 0) + 1;
      
      // Count delivered using same logic as dashboard
      if (status === 'DELIVERED' || code === 6 || code === 7 || code === 8) {
        deliveredCount++;
      }
    });

    console.log('📊 Status Breakdown (Top 10):');
    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });

    console.log('\n📊 Status Code Breakdown:');
    Object.entries(statusCodeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([code, count]) => {
        console.log(`   Code ${code}: ${count}`);
      });

    console.log(`\n🎯 Delivered Orders: ${deliveredCount}`);
    console.log(`📊 Delivery Rate: ${((deliveredCount / shipments.length) * 100).toFixed(2)}%`);

    // Date range analysis
    const dates = shipments
      .map(s => s.orderDate || s.createdAt)
      .filter(d => d)
      .sort();
    
    if (dates.length > 0) {
      console.log(`\n📅 Date Range in Data:`);
      console.log(`   Earliest: ${dates[0]}`);
      console.log(`   Latest: ${dates[dates.length - 1]}`);
    }

    console.log('\n✅ Full sync completed successfully!');
    console.log('   Data has been saved to DynamoDB');
    console.log('   Refresh your dashboard to see updated metrics');

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

fullSync()
  .then(() => {
    console.log('\n✅ Script completed\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
