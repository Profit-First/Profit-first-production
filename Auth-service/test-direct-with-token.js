/**
 * Test the DIRECT approach with mock Shiprocket token
 */

const shiprocketDashboardController = require('./controllers/shiprocket-dashboard.controller');

// Mock axios to simulate Shiprocket API responses
const axios = require('axios');

// Create mock Shiprocket API responses
const mockOrdersResponse = {
  data: {
    data: [
      {
        id: 1105474877,
        channel_order_id: "1053",
        total: "1598.00",
        status: "DELIVERED",
        status_code: 6,
        payment_method: "cod",
        customer_name: "Test Customer 1",
        channel_created_at: "29 Dec 2025, 04:14 PM",
        shipments: [{
          id: 1101838655,
          awb: "SF2729942765KR",
          courier: "Shadowfax Surface"
        }]
      },
      {
        id: 1104405563,
        channel_order_id: "1052",
        total: "1598.00",
        status: "IN TRANSIT",
        status_code: 20,
        payment_method: "cod",
        customer_name: "Test Customer 2",
        channel_created_at: "28 Dec 2025, 08:52 PM",
        shipments: [{
          id: 1100769522,
          awb: "19041851147484",
          courier: "Delhivery Surface"
        }]
      },
      {
        id: 1103000000,
        channel_order_id: "1051",
        total: "2200.00",
        status: "DELIVERED",
        status_code: 6,
        payment_method: "prepaid",
        customer_name: "Test Customer 3",
        channel_created_at: "27 Dec 2025, 02:30 PM",
        shipments: [{
          id: 1099000000,
          awb: "DEL123456789",
          courier: "Delhivery"
        }]
      }
    ]
  }
};

const mockShipmentsResponse = {
  data: {
    data: [
      {
        id: 1101838655,
        order_id: 1105474877,
        awb: "SF2729942765KR",
        status: "DELIVERED",
        charges: {
          freight_charges: "99.00",
          cod_charges: "53.10"
        },
        payment_method: "cod",
        created_at: "29 Dec 2025, 04:14 PM"
      },
      {
        id: 1100769522,
        order_id: 1104405563,
        awb: "19041851147484",
        status: "IN TRANSIT",
        charges: {
          freight_charges: "124.49",
          cod_charges: "52.73"
        },
        payment_method: "cod",
        created_at: "28 Dec 2025, 08:52 PM"
      },
      {
        id: 1099000000,
        order_id: 1103000000,
        awb: "DEL123456789",
        status: "DELIVERED",
        charges: {
          freight_charges: "85.00",
          cod_charges: "0.00"
        },
        payment_method: "prepaid",
        created_at: "27 Dec 2025, 02:30 PM"
      }
    ]
  }
};

// Mock axios.get
const originalAxiosGet = axios.get;
axios.get = async (url, config) => {
  console.log(`🎭 Mock API call: ${url}`);
  
  if (url.includes('/orders')) {
    console.log(`   📦 Returning mock orders data (${mockOrdersResponse.data.data.length} orders)`);
    return mockOrdersResponse;
  } else if (url.includes('/shipments')) {
    console.log(`   🚚 Returning mock shipments data (${mockShipmentsResponse.data.data.length} shipments)`);
    return mockShipmentsResponse;
  }
  
  // Fallback to original axios for other calls
  return originalAxiosGet(url, config);
};

async function testDirectWithToken() {
  console.log('🧪 Testing DIRECT approach with mock Shiprocket token...\n');

  try {
    // Create mock request and response objects
    const mockReq = {
      user: {
        userId: 'test-direct-with-token'
      },
      query: {
        startDate: '2025-12-01',
        endDate: '2025-12-31'
      }
    };

    const mockRes = {
      json: (data) => {
        console.log('✅ Direct dashboard with token response received');
        console.log('📊 Response structure:');
        console.log('   Summary cards:', data.summary?.length || 0);
        console.log('   Performance data points:', data.performanceChartData?.length || 0);
        console.log('   Financial breakdown items:', data.financialsBreakdownData?.pieData?.length || 0);
        
        if (data.summary && data.summary.length > 0) {
          console.log('\n📈 Key metrics with mock data:');
          const keyMetrics = ['Delivered Orders', 'Total Revenue', 'Delivery Rate', 'Average Order Value', 'Shipping Cost', 'Total Shipments'];
          data.summary.forEach(card => {
            if (keyMetrics.includes(card.title)) {
              console.log(`   ${card.title}: ${card.value}`);
            }
          });
          
          console.log('\n🚚 Status breakdown:');
          const statusMetrics = data.summary.filter(card => 
            ['Delivered', 'In Transit', 'Cancelled', 'Pending'].includes(card.title)
          );
          statusMetrics.forEach(card => {
            console.log(`   ${card.title}: ${card.value}`);
          });
        }
        
        console.log('\n📦 Metadata:');
        console.log('   Total Shipments:', data.metadata?.totalShipments);
        console.log('   Delivered Shipments:', data.metadata?.deliveredShipments);
        console.log('   Data Source:', data.metadata?.dataSource);
        console.log('   Fetch Time:', data.metadata?.fetchTime + 'ms');
        
        return data;
      },
      status: (code) => ({
        json: (data) => {
          console.log(`❌ Error response (${code}):`, data);
          return data;
        }
      })
    };

    // Mock the database call to return a Shiprocket token
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
    const { dynamoDB } = require('./config/aws.config');
    
    const originalSend = dynamoDB.send;
    dynamoDB.send = async (command) => {
      if (command.input?.TableName === 'shipping_connections') {
        return {
          Items: [{
            userId: 'test-direct-with-token',
            token: 'mock-shiprocket-token-12345',
            connectionType: 'shiprocket'
          }]
        };
      }
      return { Items: [] };
    };
    
    console.log('1. Testing with mock Shiprocket token and API data...');
    await shiprocketDashboardController.getShiprocketDashboardData(mockReq, mockRes);
    
    // Restore original functions
    dynamoDB.send = originalSend;
    axios.get = originalAxiosGet;
    
    console.log('\n✅ Direct approach with token test completed!');
    console.log('💡 Expected results from mock data:');
    console.log('   - 2 delivered orders (₹1,598 + ₹2,200 = ₹3,798 revenue)');
    console.log('   - 1 in-transit order');
    console.log('   - 66.67% delivery rate (2/3)');
    console.log('   - ₹184 shipping costs (₹99 + ₹85)');
    
  } catch (error) {
    console.error('❌ Direct approach with token test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testDirectWithToken().catch(console.error);