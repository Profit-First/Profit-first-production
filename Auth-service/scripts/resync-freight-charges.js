/**
 * Re-sync Shiprocket data to populate freight charges
 * This script fetches fresh data from Shiprocket API with the updated code
 */

require('dotenv').config();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const shiprocketService = require('../services/shiprocket.service');

const client = new DynamoDBClient({ 
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
const docClient = DynamoDBDocumentClient.from(client);

// Replace with your user ID
const USER_ID = process.argv[2] || "61d31d1a-a0c1-7076-812f-d55319141da2";

async function resyncFreightCharges() {
  try {
    console.log('\n🔄 Re-syncing Shiprocket data with freight charges...\n');
    console.log(`👤 User ID: ${USER_ID}\n`);

    // Get Shiprocket token
    const getCommand = new GetCommand({
      TableName: 'shipping_connections',
      Key: { userId: USER_ID }
    });

    const result = await docClient.send(getCommand);
    if (!result.Item || !result.Item.token) {
      console.log('❌ No Shiprocket token found for this user');
      console.log('   Please connect Shiprocket first');
      process.exit(1);
    }

    const token = result.Item.token;
    console.log('✅ Token found\n');

    // Sync orders with the updated code (will now include freight charges)
    console.log('📦 Fetching orders from Shiprocket API...');
    const syncResult = await shiprocketService.syncShiprocketOrders(USER_ID, token, {
      maxPages: 50,
      perPage: 250
    });

    console.log('\n✅ Re-sync completed!');
    console.log(`   Total records synced: ${syncResult.totalRecords || 0}`);
    console.log(`   Freight charges are now populated in the database\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

resyncFreightCharges()
  .then(() => {
    console.log('✅ Script completed\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
