/**
 * Test script to verify Shiprocket API connection
 */

const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('./config/aws.config');
const shiprocketService = require('./services/shiprocket.service');

async function testShiprocketAPI() {
  console.log('🧪 Testing Shiprocket API connection...\n');

  try {
    // Test user ID (you can change this to a real user ID)
    const testUserId = 'test-user-123';
    
    console.log('1. Testing database connection...');
    
    // Try to get shipping connection from database
    const command = new QueryCommand({
      TableName: 'shipping_connections',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': testUserId
      }
    });

    const result = await dynamoDB.send(command);
    const shippingConnection = result.Items?.[0];
    
    if (!shippingConnection) {
      console.log('❌ No Shiprocket connection found for test user');
      console.log('💡 To test with real data, you need to:');
      console.log('   1. Connect a Shiprocket account in the dashboard');
      console.log('   2. Update testUserId in this script to a real user ID');
      return;
    }
    
    console.log('✅ Shiprocket connection found');
    console.log('   Token exists:', !!shippingConnection.token);
    
    if (!shippingConnection.token) {
      console.log('❌ No Shiprocket token found');
      return;
    }
    
    console.log('\n2. Testing Shiprocket API...');
    
    // Test API call
    const apiResult = await shiprocketService.fetchOrdersDirectly(shippingConnection.token, {
      maxPages: 1,
      perPage: 5
    });
    
    console.log('✅ Shiprocket API call successful');
    console.log('   Orders fetched:', apiResult.shipments?.length || 0);
    
    if (apiResult.shipments && apiResult.shipments.length > 0) {
      const firstOrder = apiResult.shipments[0];
      console.log('   Sample order data:');
      console.log('     Order ID:', firstOrder.orderId);
      console.log('     Status:', firstOrder.status);
      console.log('     Revenue:', firstOrder.total || firstOrder.orderValue || 'N/A');
      console.log('     Date:', firstOrder.orderDate);
    }
    
    console.log('\n✅ Shiprocket API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Shiprocket API test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

// Run the test
testShiprocketAPI().catch(console.error);