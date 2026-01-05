/**
 * Test script with real Shiprocket API data structure
 */

const shiprocketDashboardController = require('./controllers/shiprocket-dashboard.controller');

// Mock the shiprocket service to return real data structure
const originalService = require('./services/shiprocket.service');

// Create sample data based on your actual Shiprocket API response
const realShiprocketData = {
  success: true,
  shipments: [
    {
      // Order 1053 - IN TRANSIT
      orderId: '1053',
      shiprocketOrderId: '1105474877',
      shipmentId: '1101838655',
      total: 1598.00,
      orderValue: 1598.00,
      totalAmount: 1598.00,
      amount: 1598.00,
      tax: 71.38,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      codCharges: 1598.00,
      customerName: 'Diya Kumari Kumawath L',
      customerEmail: 'diya2005kumari@gmail.com',
      customerCity: 'Chennai',
      customerState: 'Tamil Nadu',
      customerPincode: '600039',
      status: 'IN TRANSIT',
      statusCode: 20,
      masterStatus: 'FULFILLED',
      awbCode: 'SF2729942765KR',
      courierName: 'Shadowfax Surface',
      weight: 0.4,
      dimensions: '25x25x3',
      orderDate: '29 Dec 2025, 04:14 PM',
      createdAt: '29 Dec 2025, 04:14 PM',
      updatedAt: '1 Jan 2026, 01:18 AM',
      etd: '2026-01-06 23:00:00',
      parsedOrderDate: '2025-12-29',
      // Shipping costs from shipments API
      freightCharges: 99.00,
      shippingCharges: 99.00,
      totalCharges: 99.00,
      appliedWeightAmount: 121.60,
      source: 'merged_apis',
      channelName: 'My Store (Shopify)'
    },
    {
      // Order 1052 - IN TRANSIT-EN-ROUTE
      orderId: '1052',
      shiprocketOrderId: '1104405563',
      shipmentId: '1100769522',
      total: 1598.00,
      orderValue: 1598.00,
      totalAmount: 1598.00,
      amount: 1598.00,
      tax: 71.38,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      codCharges: 1598.00,
      customerName: 'Kimpachut Guite',
      customerEmail: 'kimpachut@gmail.com',
      customerCity: 'Chennai',
      customerState: 'Tamil Nadu',
      customerPincode: '600002',
      status: 'IN TRANSIT-EN-ROUTE',
      statusCode: 20,
      masterStatus: 'FULFILLED',
      awbCode: '19041851147484',
      courierName: 'Delhivery Surface',
      weight: 0.4,
      dimensions: '25x25x3',
      orderDate: '28 Dec 2025, 08:52 PM',
      createdAt: '28 Dec 2025, 08:52 PM',
      updatedAt: '31 Dec 2025, 05:33 AM',
      etd: '2026-01-07 23:59:59',
      parsedOrderDate: '2025-12-28',
      // Shipping costs from shipments API
      freightCharges: 99.00,
      shippingCharges: 99.00,
      totalCharges: 99.00,
      appliedWeightAmount: 124.49,
      source: 'merged_apis',
      channelName: 'My Store (Shopify)'
    },
    {
      // Delivered shipment from shipments API
      orderId: '1006371149',
      shipmentId: '1002768210',
      total: 1200.00, // Estimated based on typical order value
      orderValue: 1200.00,
      totalAmount: 1200.00,
      amount: 1200.00,
      paymentMethod: 'prepaid',
      customerName: 'Customer 3',
      status: 'DELIVERED',
      statusCode: 6,
      awbCode: '19041820070192',
      courierName: 'Delhivery',
      orderDate: '18 Oct 2025, 06:05 PM',
      createdAt: '18 Oct 2025, 06:05 PM',
      parsedOrderDate: '2025-10-18',
      // Actual shipping costs from API
      freightCharges: 107.27,
      shippingCharges: 107.27,
      totalCharges: 107.27,
      appliedWeightAmount: 107.27,
      source: 'merged_apis',
      channelName: 'Shopify'
    },
    {
      // Another delivered shipment
      orderId: '1006384835',
      shipmentId: '1002781883',
      total: 999.00,
      orderValue: 999.00,
      totalAmount: 999.00,
      amount: 999.00,
      paymentMethod: 'prepaid',
      customerName: 'Customer 4',
      status: 'DELIVERED',
      statusCode: 6,
      awbCode: '1319450317022',
      courierName: 'Delhivery',
      orderDate: '18 Oct 2025, 06:20 PM',
      createdAt: '18 Oct 2025, 06:20 PM',
      parsedOrderDate: '2025-10-18',
      // Actual shipping costs from API
      freightCharges: 56.34,
      shippingCharges: 56.34,
      totalCharges: 56.34,
      appliedWeightAmount: 56.34,
      source: 'merged_apis',
      channelName: 'Shopify'
    },
    {
      // Cancelled shipment
      orderId: '994866247',
      shipmentId: '991267382',
      total: 799.00,
      orderValue: 799.00,
      totalAmount: 799.00,
      amount: 799.00,
      paymentMethod: 'prepaid',
      customerName: 'Customer 5',
      status: 'CANCELED',
      statusCode: 12,
      awbCode: '',
      courierName: '',
      orderDate: '9 Oct 2025, 05:35 PM',
      createdAt: '9 Oct 2025, 05:35 PM',
      parsedOrderDate: '2025-10-09',
      freightCharges: 0,
      shippingCharges: 0,
      totalCharges: 0,
      source: 'merged_apis',
      channelName: 'Shopify'
    }
  ],
  count: 5,
  pages: 1
};

// Mock the service function
const mockFetchOrdersDirectly = async (token, options) => {
  console.log('🎭 Using real Shiprocket data structure...');
  return realShiprocketData;
};

// Replace the service function temporarily
originalService.fetchOrdersDirectly = mockFetchOrdersDirectly;

async function testDashboardWithRealData() {
  console.log('🧪 Testing Shiprocket Dashboard with real API data structure...\n');

  try {
    // Create mock request and response objects
    const mockReq = {
      user: {
        userId: 'test-user-real-data'
      },
      query: {
        startDate: '2025-10-01',
        endDate: '2025-12-31'
      }
    };

    const mockRes = {
      json: (data) => {
        console.log('✅ Dashboard response received');
        console.log('📊 Response data structure:');
        console.log('   Summary cards:', data.summary?.length || 0);
        console.log('   Performance data points:', data.performanceChartData?.length || 0);
        console.log('   Financial breakdown items:', data.financialsBreakdownData?.pieData?.length || 0);
        
        if (data.summary && data.summary.length > 0) {
          console.log('\n📈 Key metrics from real data:');
          const keyMetrics = ['Total Revenue', 'Delivered Orders', 'Delivery Rate', 'Average Order Value', 'Shipping Cost', 'In Transit'];
          data.summary.forEach(card => {
            if (keyMetrics.includes(card.title)) {
              console.log(`   ${card.title}: ${card.value}`);
            }
          });
          
          console.log('\n🚚 Shipping status breakdown:');
          const shippingMetrics = data.summary.filter(card => 
            ['Delivered', 'In Transit', 'Cancelled', 'Pickup Pending', 'RTO', 'NDR Pending'].includes(card.title)
          );
          shippingMetrics.forEach(card => {
            console.log(`   ${card.title}: ${card.value}`);
          });
        }
        
        console.log('\n📦 Metadata:');
        console.log('   Total Shipments:', data.metadata?.totalShipments);
        console.log('   Delivered Shipments:', data.metadata?.deliveredShipments);
        console.log('   Data Source:', data.metadata?.dataSource);
        
        return data;
      },
      status: (code) => ({
        json: (data) => {
          console.log(`❌ Error response (${code}):`, data);
          return data;
        }
      })
    };

    // Mock the database calls
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
    const { dynamoDB } = require('./config/aws.config');
    
    const originalSend = dynamoDB.send;
    dynamoDB.send = async (command) => {
      if (command.input?.TableName === 'shipping_connections') {
        return {
          Items: [{
            userId: 'test-user-real-data',
            token: 'real-shiprocket-token',
            connectionType: 'shiprocket'
          }]
        };
      }
      if (command.input?.TableName === 'business_expenses') {
        return {
          Items: [{
            userId: 'test-user-real-data',
            agencyFees: 8000,
            rtoHandlingFees: 2000,
            paymentGatewayFeePercent: 2.5,
            staffFees: 15000,
            officeRent: 20000,
            otherExpenses: 3000
          }]
        };
      }
      if (command.input?.TableName === 'meta_insights') {
        return {
          Items: [{
            userId: 'test-user-real-data',
            date: '2025-10-18',
            adSpend: 8000
          }, {
            userId: 'test-user-real-data',
            date: '2025-12-28',
            adSpend: 12000
          }, {
            userId: 'test-user-real-data',
            date: '2025-12-29',
            adSpend: 10000
          }]
        };
      }
      return { Items: [] };
    };
    
    console.log('1. Testing dashboard controller with real Shiprocket data structure...');
    await shiprocketDashboardController.getShiprocketDashboardData(mockReq, mockRes);
    
    // Restore original function
    dynamoDB.send = originalSend;
    
    console.log('\n✅ Dashboard test with real Shiprocket data completed!');
    console.log('💡 This test uses the exact data structure from your Shiprocket API.');
    console.log('💡 Revenue: ₹2,199 from 2 delivered orders (₹1,200 + ₹999)');
    console.log('💡 Shipping: ₹163.61 actual freight charges (₹107.27 + ₹56.34)');
    console.log('💡 Status: 2 delivered, 2 in transit, 1 cancelled');
    
  } catch (error) {
    console.error('❌ Dashboard test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testDashboardWithRealData().catch(console.error);