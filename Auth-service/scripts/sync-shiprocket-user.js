/**
 * Manually Trigger Shiprocket Sync for a User
 * 
 * This script fetches shipments from Shiprocket API and saves them to DynamoDB
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

// Replace with your actual user ID
const USER_ID = "61d31d1a-a0c1-7076-812f-d55319141da2";

async function syncShiprocketForUser() {
  try {
    console.log(`\n🔄 Starting Shiprocket sync for user: ${USER_ID}\n`);

    // Step 1: Get Shiprocket connection and token
    console.log('📡 Step 1: Fetching Shiprocket connection...');
    
    const getCommand = new GetCommand({
      TableName: 'shipping_connections',
      Key: {
        userId: USER_ID
      }
    });

    const result = await docClient.send(getCommand);
    
    if (!result.Item || !result.Item.token) {
      console.log('❌ No Shiprocket connection or token found for this user');
      console.log('   User needs to connect Shiprocket in Settings first');
      process.exit(1);
    }

    const token = result.Item.token;
    console.log('✅ Token found');

    // Check if token is expired
    if (result.Item.tokenExpiry) {
      const expiryDate = new Date(result.Item.tokenExpiry);
      const now = new Date();
      if (expiryDate < now) {
        console.log('❌ Token is expired!');
        console.log(`   Expired on: ${expiryDate.toISOString()}`);
        console.log('   User needs to reconnect Shiprocket in Settings');
        process.exit(1);
      }
    }

    // Step 2: Use the shiprocket service to fetch and save data
    console.log('\n📦 Step 2: Fetching shipments from Shiprocket API...');
    
    const shiprocketService = require('../services/shiprocket.service');
    
    // Set date range (last 90 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`   Date range: ${startDateStr} to ${endDateStr}`);
    
    // Fetch shipments using the service
    const syncResult = await shiprocketService.getShiprocketDataWithCache(
      USER_ID,
      token,
      startDateStr,
      endDateStr,
      {
        forceRefresh: true,  // Force fresh fetch from API
        cacheTTLHours: 1,
        maxPages: 20,        // Fetch up to 20 pages
        perPage: 250         // 250 records per page
      }
    );

    if (!syncResult.success) {
      console.log(`❌ Sync failed: ${syncResult.error}`);
      if (syncResult.error.includes('401') || syncResult.error.includes('Unauthorized')) {
        console.log('   Token is invalid or expired');
        console.log('   User needs to reconnect Shiprocket in Settings');
      }
      process.exit(1);
    }

    const shipments = syncResult.shipments || [];
    console.log(`✅ Fetched ${shipments.length} shipments from Shiprocket`);

    if (shipments.length === 0) {
      console.log('\n⚠️  No shipments found for this date range');
      console.log('   This could mean:');
      console.log('   1. No orders have been shipped in the last 90 days');
      console.log('   2. Shiprocket account has no shipments');
      console.log('   3. API returned empty results');
    } else {
      // Show summary
      console.log('\n📊 Shipment Summary:');
      
      const statusCounts = {};
      shipments.forEach(s => {
        const status = s.status || 'NO_STATUS';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      console.log('   Status breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`     ${status}: ${count}`);
      });

      // Show date range of shipments
      const dates = shipments
        .map(s => s.orderDate || s.createdAt)
        .filter(d => d)
        .sort();
      
      if (dates.length > 0) {
        console.log(`\n   Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
      }

      console.log(`\n✅ Shipments saved to DynamoDB`);
      console.log(`   Source: ${syncResult.source}`);
    }

    console.log('\n🎉 Sync completed successfully!');
    console.log('   Refresh your dashboard to see the updated data');

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

syncShiprocketForUser()
  .then(() => {
    console.log('\n✅ Script completed\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
