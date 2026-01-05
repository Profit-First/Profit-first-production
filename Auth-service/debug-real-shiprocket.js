/**
 * Debug script to check what's actually happening with real Shiprocket API
 */

const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('./config/aws.config');
const axios = require('axios');

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';

async function debugRealShiprocket() {
  console.log('🔍 Debugging REAL Shiprocket API calls...\n');

  try {
    // Get user ID from command line or use default
    const userId = process.argv[2] || 'your-user-id-here';
    console.log(`👤 Debugging for user: ${userId}`);
    
    // Step 1: Get Shiprocket token
    console.log('\n1️⃣ Getting Shiprocket token...');
    const command = new QueryCommand({
      TableName: 'shipping_connections',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await dynamoDB.send(command);
    const connection = result.Items?.[0];
    
    if (!connection || !connection.token) {
      console.log('❌ No Shiprocket token found');
      console.log('💡 Please connect your Shiprocket account first');
      return;
    }
    
    console.log('✅ Token found:', connection.token.substring(0, 20) + '...');
    
    // Step 2: Test different date ranges
    const dateRanges = [
      { name: 'Last 7 days', days: 7 },
      { name: 'Last 30 days', days: 30 },
      { name: 'Last 90 days', days: 90 },
      { name: 'No date filter', days: null }
    ];
    
    for (const range of dateRanges) {
      console.log(`\n2️⃣ Testing ${range.name}...`);
      
      let startDate = null;
      let endDate = null;
      
      if (range.days) {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - range.days);
        
        startDate = start.toISOString().split('T')[0];
        endDate = end.toISOString().split('T')[0];
        
        console.log(`   📅 Date range: ${startDate} to ${endDate}`);
      }
      
      // Test Orders API
      await testOrdersAPI(connection.token, startDate, endDate);
      
      // Test Shipments API
      await testShipmentsAPI(connection.token, startDate, endDate);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function testOrdersAPI(token, startDate, endDate) {
  console.log('   📦 Testing Orders API...');
  
  try {
    const params = {
      per_page: 50,
      page: 1
    };
    
    // Add date filters if provided
    if (startDate && endDate) {
      // Convert YYYY-MM-DD to DD-MM-YYYY for Shiprocket API
      const [startYear, startMonth, startDay] = startDate.split('-');
      const [endYear, endMonth, endDay] = endDate.split('-');
      
      params.created_after = `${startDay}-${startMonth}-${startYear}`;
      params.created_before = `${endDay}-${endMonth}-${endYear}`;
      
      console.log(`      📅 API date params:`, params.created_after, 'to', params.created_before);
    }
    
    const response = await axios.get(`${SHIPROCKET_API_BASE}/orders`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params
    });
    
    const orders = response.data?.data || [];
    console.log(`      ✅ Orders found: ${orders.length}`);
    
    if (orders.length > 0) {
      const sample = orders[0];
      console.log(`      📋 Sample order:`, {
        id: sample.id,
        orderId: sample.channel_order_id,
        total: sample.total,
        status: sample.status,
        statusCode: sample.status_code,
        date: sample.channel_created_at || sample.created_at,
        shipments: sample.shipments?.length || 0
      });
      
      // Count by status
      const statusCounts = {};
      orders.forEach(order => {
        const status = order.status || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      console.log(`      📊 Status breakdown:`, statusCounts);
    }
    
  } catch (error) {
    console.log(`      ❌ Orders API error: ${error.message}`);
    if (error.response) {
      console.log(`         Status: ${error.response.status}`);
      console.log(`         Data:`, JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function testShipmentsAPI(token, startDate, endDate) {
  console.log('   🚚 Testing Shipments API...');
  
  try {
    const params = {
      per_page: 50,
      page: 1
    };
    
    // Add date filters if provided
    if (startDate && endDate) {
      params.start_date = startDate;
      params.end_date = endDate;
      console.log(`      📅 API date params:`, params.start_date, 'to', params.end_date);
    }
    
    const response = await axios.get(`${SHIPROCKET_API_BASE}/shipments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params
    });
    
    const shipments = response.data?.data || [];
    console.log(`      ✅ Shipments found: ${shipments.length}`);
    
    if (shipments.length > 0) {
      const sample = shipments[0];
      console.log(`      📋 Sample shipment:`, {
        id: sample.id,
        orderId: sample.order_id,
        awb: sample.awb,
        status: sample.status,
        charges: sample.charges,
        paymentMethod: sample.payment_method,
        date: sample.created_at
      });
      
      // Count by status
      const statusCounts = {};
      shipments.forEach(shipment => {
        const status = shipment.status || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      console.log(`      📊 Status breakdown:`, statusCounts);
      
      // Count delivered
      const delivered = shipments.filter(s => {
        const status = (s.status || '').toLowerCase();
        return status === 'delivered' || status.includes('delivered');
      }).length;
      
      console.log(`      🎯 Delivered count: ${delivered}/${shipments.length}`);
    }
    
  } catch (error) {
    console.log(`      ❌ Shipments API error: ${error.message}`);
    if (error.response) {
      console.log(`         Status: ${error.response.status}`);
      console.log(`         Data:`, JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the debug
console.log('Usage: node debug-real-shiprocket.js [userId]');
console.log('Example: node debug-real-shiprocket.js user123\n');

debugRealShiprocket().catch(console.error);