/**
 * View Shiprocket Sync Log
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const dynamoDB = DynamoDBDocumentClient.from(client);

async function viewSyncLog() {
  try {
    console.log('\n📋 Shiprocket Sync Log\n');
    
    const command = new ScanCommand({
      TableName: 'shiprocket_sync_log',
      Limit: 20
    });

    const result = await dynamoDB.send(command);
    const items = result.Items || [];

    if (items.length === 0) {
      console.log('❌ No sync logs found\n');
      return;
    }

    console.log(`✅ Found ${items.length} sync log(s)\n`);
    console.log('='.repeat(80));

    items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    items.forEach((item, index) => {
      console.log(`\n${index + 1}. Sync ID: ${item.sync_id}`);
      console.log(`   Timestamp: ${item.timestamp}`);
      console.log(`   Status: ${item.status}`);
      
      if (item.details) {
        console.log(`   User: ${item.details.user_email || item.details.userId}`);
        console.log(`   Orders: ${item.details.orders || 0}`);
        console.log(`   Shipments: ${item.details.shipments || 0}`);
        console.log(`   Duration: ${item.details.duration || 'N/A'}`);
      }
    });

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

viewSyncLog();
