/**
 * Clean all data for a specific user
 * Usage: node scripts/clean-user-data.js
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const dynamoDB = DynamoDBDocumentClient.from(client);

const USER_EMAIL = 'sparklesjewellery003@gmail.com';

// Only clean Shopify orders table
const TABLES = [
  process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders'
];

async function getUserId(email) {
  console.log(`\n🔍 Finding userId for email: ${email}`);
  
  try {
    const command = new ScanCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'Users',
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    });
    
    const result = await dynamoDB.send(command);
    
    if (result.Items && result.Items.length > 0) {
      const userId = result.Items[0].userId;
      console.log(`✅ Found userId: ${userId}`);
      return userId;
    } else {
      console.log(`❌ No user found with email: ${email}`);
      return null;
    }
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

async function deleteItemsInBatches(tableName, items) {
  if (items.length === 0) return;
  
  // DynamoDB BatchWrite can handle max 25 items at a time
  const batchSize = 25;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const deleteRequests = batch.map(item => ({
      DeleteRequest: {
        Key: {
          userId: item.userId,
          ...(item.orderId && { orderId: item.orderId }),
          ...(item.productId && { productId: item.productId }),
          ...(item.customerId && { customerId: item.customerId }),
          ...(item.date && { date: item.date }),
          ...(item.shipmentId && { shipmentId: item.shipmentId })
        }
      }
    }));
    
    try {
      const command = new BatchWriteCommand({
        RequestItems: {
          [tableName]: deleteRequests
        }
      });
      
      await dynamoDB.send(command);
      console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)`);
    } catch (error) {
      console.error(`   Error deleting batch:`, error.message);
    }
  }
}

async function cleanTable(tableName, userId) {
  console.log(`\n🧹 Cleaning table: ${tableName}`);
  
  try {
    // Query all items for this user
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const result = await dynamoDB.send(command);
    const items = result.Items || [];
    
    console.log(`   Found ${items.length} items`);
    
    if (items.length > 0) {
      await deleteItemsInBatches(tableName, items);
      console.log(`   ✅ Deleted ${items.length} items from ${tableName}`);
    } else {
      console.log(`   ℹ️  No items to delete`);
    }
    
  } catch (error) {
    console.error(`   ❌ Error cleaning ${tableName}:`, error.message);
  }
}

async function cleanAllData() {
  console.log(`\n🚀 Starting data cleanup for: ${USER_EMAIL}`);
  console.log(`================================================`);
  
  // Get userId
  const userId = await getUserId(USER_EMAIL);
  
  if (!userId) {
    console.log(`\n❌ Cannot proceed without userId`);
    return;
  }
  
  // Clean each table
  for (const table of TABLES) {
    await cleanTable(table, userId);
  }
  
  console.log(`\n================================================`);
  console.log(`✅ Data cleanup completed for user: ${userId}`);
  console.log(`\n✅ Deleted: Shopify Orders only`);
  console.log(`✅ Kept: Products, Customers, Meta Insights, Shipments, Connections`);
  console.log(`\nYou can now re-sync Shopify orders without duplicates.`);
}

// Run the cleanup
cleanAllData().catch(console.error);
