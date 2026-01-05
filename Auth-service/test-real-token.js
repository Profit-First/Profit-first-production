/**
 * Test with REAL Shiprocket token to debug the zero issue
 */

const axios = require('axios');

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';
const REAL_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjg5OTYwOTgsInNvdXJjZSI6InNyLWF1dGgtaW50IiwiZXhwIjoxNzY4MjIxNDM5LCJqdGkiOiI5OTVWYnpwZFE3M2VYVG81IiwiaWF0IjoxNzY3MzU3NDM5LCJpc3MiOiJodHRwczovL3NyLWF1dGguc2hpcHJvY2tldC5pbi9hdXRob3JpemUvdXNlciIsIm5iZiI6MTc2NzM1NzQzOSwiY2lkIjo3Mjg1MzA3LCJ0YyI6MzYwLCJ2ZXJib3NlIjpmYWxzZSwidmVuZG9yX2lkIjowLCJ2ZW5kb3JfY29kZSI6InNob3BpZnkifQ.e9kOK-NPdqb9AxAQ-CgGEuj5QCSuJBOhI-FdivUN2Fw';

async function testRealToken() {
  console.log('🧪 Testing with REAL Shiprocket token...\n');

  try {
    // Test 1: Orders API
    console.log('1️⃣ Testing Orders API...');
    await testOrdersAPI();
    
    // Test 2: Shipments API
    console.log('\n2️⃣ Testing Shipments API...');
    await testShipmentsAPI();
    
    // Test 3: Test our dashboard controller with real token
    console.log('\n3️⃣ Testing Dashboard Controller with real token...');
    await testDashboardController();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testOrdersAPI() {
  try {
    // Test without date filters first
    console.log('   📦 Testing Orders API (no date filter)...');
    
    const response = await axios.get(`${SHIPROCKET_API_BASE}/orders`, {
      headers: {
        'Authorization': `Bearer ${REAL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        per_page: 50,
        page: 1
      }
    });
    
    const orders = response.data?.data || [];
    console.log(`   ✅ Orders found: ${orders.length}`);
    
    if (orders.length > 0) {
      console.log(`   📋 First order sample:`, {
        id: orders[0].id,
        orderId: orders[0].channel_order_id,
        total: orders[0].total,
        status: orders[0].status,
        statusCode: orders[0].status_code,
        date: orders[0].channel_created_at || orders[0].created_at,
        shipments: orders[0].shipments?.length || 0
      });
      
      // Count by status
      const statusCounts = {};
      orders.forEach(order => {
        const status = order.status || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      console.log(`   📊 Status breakdown:`, statusCounts);
      
      // Check delivered count
      const delivered = orders.filter(order => {
        const status = (order.status || '').toLowerCase();
        const statusCode = order.status_code;
        return status === 'delivered' || status.includes('delivered') || 
               statusCode === 6 || statusCode === 7 || statusCode === 8;
      }).length;
      
      console.log(`   🎯 Delivered orders: ${delivered}/${orders.length}`);
      
      // Calculate total revenue
      const totalRevenue = orders
        .filter(order => {
          const status = (order.status || '').toLowerCase();
          const statusCode = order.status_code;
          return status === 'delivered' || status.includes('delivered') || 
                 statusCode === 6 || statusCode === 7 || statusCode === 8;
        })
        .reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
      
      console.log(`   💰 Total revenue from delivered: ₹${totalRevenue}`);
    }
    
  } catch (error) {
    console.error('   ❌ Orders API error:', error.message);
    if (error.response) {
      console.error('      Status:', error.response.status);
      console.error('      Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function testShipmentsAPI() {
  try {
    console.log('   🚚 Testing Shipments API (no date filter)...');
    
    const response = await axios.get(`${SHIPROCKET_API_BASE}/shipments`, {
      headers: {
        'Authorization': `Bearer ${REAL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        per_page: 50,
        page: 1
      }
    });
    
    const shipments = response.data?.data || [];
    console.log(`   ✅ Shipments found: ${shipments.length}`);
    
    if (shipments.length > 0) {
      console.log(`   📋 First shipment sample:`, {
        id: shipments[0].id,
        orderId: shipments[0].order_id,
        awb: shipments[0].awb,
        status: shipments[0].status,
        charges: shipments[0].charges,
        paymentMethod: shipments[0].payment_method,
        date: shipments[0].created_at
      });
      
      // Count by status
      const statusCounts = {};
      shipments.forEach(shipment => {
        const status = shipment.status || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      console.log(`   📊 Status breakdown:`, statusCounts);
      
      // Check delivered count
      const delivered = shipments.filter(shipment => {
        const status = (shipment.status || '').toLowerCase();
        return status === 'delivered' || status.includes('delivered');
      }).length;
      
      console.log(`   🎯 Delivered shipments: ${delivered}/${shipments.length}`);
      
      // Calculate shipping costs
      const totalShippingCost = shipments
        .filter(shipment => {
          const status = (shipment.status || '').toLowerCase();
          return status === 'delivered' || status.includes('delivered');
        })
        .reduce((sum, shipment) => sum + parseFloat(shipment.charges?.freight_charges || 0), 0);
      
      console.log(`   🚚 Total shipping cost: ₹${totalShippingCost}`);
    }
    
  } catch (error) {
    console.error('   ❌ Shipments API error:', error.message);
    if (error.response) {
      console.error('      Status:', error.response.status);
      console.error('      Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function testDashboardController() {
  try {
    // Mock the dashboard controller with real token
    const shiprocketDashboardController = require('./controllers/shiprocket-dashboard.controller');
    
    const mockReq = {
      user: {
        userId: 'real-test-user'
      },
      query: {
        startDate: '2024-01-01',
        endDate: '2025-12-31'
      }
    };

    const mockRes = {
      json: (data) => {
        console.log('   ✅ Dashboard controller response:');
        console.log('      Summary cards:', data.summary?.length || 0);
        console.log('      Performance data points:', data.performanceChartData?.length || 0);
        console.log('      Financial breakdown items:', data.financialsBreakdownData?.pieData?.length || 0);
        
        if (data.summary && data.summary.length > 0) {
          console.log('   📈 Key metrics:');
          const keyMetrics = ['Delivered Orders', 'Total Revenue', 'Total Shipments', 'Delivered', 'In Transit', 'NDR Pending', 'RTO'];
          data.summary.forEach(card => {
            if (keyMetrics.includes(card.title)) {
              console.log(`      ${card.title}: ${card.value}`);
            }
          });
        }
        
        console.log('   📦 Metadata:', data.metadata);
        return data;
      },
      status: (code) => ({
        json: (data) => {
          console.log(`   ❌ Error response (${code}):`, data);
          return data;
        }
      })
    };

    // Mock the database call to return our real token
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
    const { dynamoDB } = require('./config/aws.config');
    
    const originalSend = dynamoDB.send;
    dynamoDB.send = async (command) => {
      if (command.input?.TableName === 'shipping_connections') {
        return {
          Items: [{
            userId: 'real-test-user',
            token: REAL_TOKEN,
            connectionType: 'shiprocket'
          }]
        };
      }
      return { Items: [] };
    };
    
    await shiprocketDashboardController.getShiprocketDashboardData(mockReq, mockRes);
    
    // Restore original function
    dynamoDB.send = originalSend;
    
  } catch (error) {
    console.error('   ❌ Dashboard controller error:', error.message);
  }
}

// Run the test
testRealToken().catch(console.error);