/**
 * View Shiprocket Sync Status Data
 * 
 * This script queries the shiprocket_sync_status table to see sync progress data
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const dynamoDB = DynamoDBDocumentClient.from(client);

async function viewSyncStatus(userId = null) {
  try {
    console.log('\n📊 Viewing Shiprocket Sync Status Data...\n');
    
    // Try both possible table names
    const tableName = process.env.SYNC_STATUS_TABLE || 'sync_status';
    console.log(`📦 Table: ${tableName}\n`);

    let result;

    if (userId) {
      // Query specific user
      console.log(`🔍 Querying sync status for user: ${userId}\n`);
      const command = new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });
      result = await dynamoDB.send(command);
    } else {
      // Scan all records
      console.log(`🔍 Scanning all sync status records...\n`);
      const command = new ScanCommand({
        TableName: tableName
      });
      result = await dynamoDB.send(command);
    }

    const items = result.Items || [];
    
    if (items.length === 0) {
      console.log('❌ No sync status records found\n');
      return;
    }

    console.log(`✅ Found ${items.length} sync status record(s)\n`);
    console.log('='.repeat(80));

    items.forEach((item, index) => {
      console.log(`\n📋 Record ${index + 1}:`);
      console.log('─'.repeat(80));
      console.log(`   User ID: ${item.userId}`);
      console.log(`   Status: ${item.status || 'N/A'}`);
      console.log(`   Stage: ${item.stage || 'N/A'}`);
      console.log(`   Sync Type: ${item.syncType || 'N/A'}`);
      console.log(`   Message: ${item.message || 'N/A'}`);
      
      if (item.totalOrders !== undefined) {
        console.log(`   Total Orders: ${item.totalOrders}`);
      }
      if (item.processedOrders !== undefined) {
        console.log(`   Processed Orders: ${item.processedOrders}`);
        if (item.totalOrders > 0) {
          const percentage = ((item.processedOrders / item.totalOrders) * 100).toFixed(2);
          console.log(`   Progress: ${percentage}%`);
        }
      }
      if (item.currentPage !== undefined) {
        console.log(`   Current Page: ${item.currentPage}`);
      }
      
      console.log(`   Date Filter: ${item.dateFilter || 'N/A'}`);
      console.log(`   Started At: ${item.startedAt || 'N/A'}`);
      console.log(`   Completed At: ${item.completedAt || 'N/A'}`);
      console.log(`   Updated At: ${item.updatedAt || 'N/A'}`);
      
      if (item.error) {
        console.log(`   ❌ Error: ${item.error}`);
      }
      
      console.log('─'.repeat(80));
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\n✨ Total records displayed: ${items.length}\n`);

  } catch (error) {
    console.error('❌ Error viewing sync status:', error.message);
    if (error.name === 'ResourceNotFoundException') {
      console.log('\n⚠️  Table does not exist!');
      console.log(`   Expected table: ${process.env.SYNC_STATUS_TABLE || 'shiprocket_sync_status'}`);
      console.log('   You may need to create this table first.');
    }
  }
}

// Get userId from command line argument if provided
const userId = process.argv[2];

if (userId) {
  console.log(`\n🎯 Viewing sync status for specific user: ${userId}`);
} else {
  console.log('\n🌐 Viewing all sync status records');
  console.log('💡 Tip: Run with user ID to see specific user: node view-sync-status.js <userId>');
}

viewSyncStatus(userId)
  .then(() => {
    console.log('✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  });
