/**
 * Debug script to check Shiprocket connection and data
 * Run this to troubleshoot why dashboard shows zeros
 */

const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('./config/aws.config');
const shiprocketService = require('./services/shiprocket.service');

async function debugShiprocketConnection() {
  console.log('🔍 Debugging Shiprocket Connection...\n');

  try {
    // Get user ID from command line or use default
    const userId = process.argv[2] || 'your-user-id-here';
    console.log(`👤 Checking for user: ${userId}`);
    
    // Step 1: Check if shipping connection exists
    console.log('\n1️⃣ Checking shipping connection...');
    const command = new QueryCommand({
      TableName: 'shipping_connections',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await dynamoDB.send(command);
    const shippingConnection = result.Items?.[0];
    
    if (!shippingConnection) {
      console.log('❌ No shipping connection found');
      console.log('💡 Solution: Connect Shiprocket account in dashboard settings');
      return;
    }
    
    console.log('✅ Shipping connection found');
    console.log('   Connection type:', shippingConnection.connectionType);
    console.log('   Has token:', !!shippingConnection.token);
    console.log('   Token length:', shippingConnection.token?.length || 0);
    
    if (!shippingConnection.token) {
      console.log('❌ No Shiprocket token found');
      console.log('💡 Solution: Re-connect Shiprocket account with valid API token');
      return;
    }
    
    // Step 2: Test Shiprocket API connection
    console.log('\n2️⃣ Testing Shiprocket API connection...');
    
    try {
      const testResult = await shiprocketService.fetchOrdersDirectly(shippingConnection.token, {
        maxPages: 1,
        perPage: 5 // Just test with 5 records
      });
      
      console.log('✅ Shiprocket API connection successful');
      console.log('   Records fetched:', testResult.shipments?.length || 0);
      
      if (testResult.shipments && testResult.shipments.length > 0) {
        const sample = testResult.shipments[0];
        console.log('   Sample record:');
        console.log('     Order ID:', sample.orderId);
        console.log('     Total:', sample.total);
        console.log('     Status:', sample.status);
        console.log('     Status Code:', sample.statusCode);
        console.log('     Date:', sample.orderDate);
        console.log('     Shipping Cost:', sample.shippingCharges);
      } else {
        console.log('⚠️  No orders found in API response');
        console.log('💡 Possible reasons:');
        console.log('   - No orders exist in Shiprocket account');
        console.log('   - Date range is too narrow');
        console.log('   - Orders are outside the default date range');
      }
      
    } catch (apiError) {
      console.log('❌ Shiprocket API connection failed');
      console.log('   Error:', apiError.message);
      
      if (apiError.response) {
        console.log('   Status:', apiError.response.status);
        console.log('   Response:', apiError.response.data);
        
        if (apiError.response.status === 401) {
          console.log('💡 Solution: Token is invalid, re-connect Shiprocket account');
        } else if (apiError.response.status === 429) {
          console.log('💡 Solution: Rate limited, try again later');
        }
      }
      return;
    }
    
    // Step 3: Check date range
    console.log('\n3️⃣ Testing with different date ranges...');
    
    const dateRanges = [
      { name: 'Last 7 days', startDate: getDateString(-7), endDate: getDateString(0) },
      { name: 'Last 30 days', startDate: getDateString(-30), endDate: getDateString(0) },
      { name: 'Last 90 days', startDate: getDateString(-90), endDate: getDateString(0) }
    ];
    
    for (const range of dateRanges) {
      console.log(`   Testing ${range.name} (${range.startDate} to ${range.endDate})...`);
      
      try {
        const rangeResult = await shiprocketService.fetchOrdersDirectly(shippingConnection.token, {
          startDate: range.startDate,
          endDate: range.endDate,
          maxPages: 1,
          perPage: 10
        });
        
        const delivered = rangeResult.shipments?.filter(s => 
          s.statusCode === 6 || s.statusCode === 7 || s.statusCode === 8
        ).length || 0;
        
        console.log(`     Total: ${rangeResult.shipments?.length || 0}, Delivered: ${delivered}`);
        
      } catch (error) {
        console.log(`     Error: ${error.message}`);
      }
    }
    
    console.log('\n✅ Debug completed!');
    console.log('\n📋 Summary:');
    console.log('   - If API connection works but dashboard shows zeros:');
    console.log('     → Try expanding the date range');
    console.log('     → Check if orders have status codes 6, 7, or 8 (delivered)');
    console.log('   - If API connection fails:');
    console.log('     → Re-connect Shiprocket account with valid token');
    console.log('   - If no orders found:');
    console.log('     → Check if orders exist in your Shiprocket account');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

function getDateString(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

// Run the debug
console.log('Usage: node debug-shiprocket-connection.js [userId]');
console.log('Example: node debug-shiprocket-connection.js user123\n');

debugShiprocketConnection().catch(console.error);