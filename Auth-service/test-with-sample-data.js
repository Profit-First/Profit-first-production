/**
 * Test script with sample Shiprocket data to verify dashboard calculations
 */

const shiprocketDashboardController = require('./controllers/shiprocket-dashboard.controller');

// Mock the shiprocket service to return sample data
const originalService = require('./services/shiprocket.service');

// Create sample Shiprocket data
const sampleShiprocketData = {
  success: true,
  shipments: [
    {
      orderId: 'ORD001',
      orderTotal: 1500,
      paymentMethod: 'cod',
      customerName: 'John Doe',
      status: 'Delivered',
      statusCode: 6,
      orderDate: '2024-01-15T10:30:00Z',
      total: 1500,
      orderValue: 1500,
      totalAmount: 1500,
      codCharges: 1500,
      shippingCharges: 70,
      totalCharges: 70
    },
    {
      orderId: 'ORD002',
      orderTotal: 2000,
      paymentMethod: 'prepaid',
      customerName: 'Jane Smith',
      status: 'Delivered',
      statusCode: 6,
      orderDate: '2024-01-16T14:20:00Z',
      total: 2000,
      orderValue: 2000,
      totalAmount: 2000,
      codCharges: 0,
      shippingCharges: 80,
      totalCharges: 80
    },
    {
      orderId: 'ORD003',
      orderTotal: 1200,
      paymentMethod: 'cod',
      customerName: 'Bob Johnson',
      status: 'In Transit',
      statusCode: 3,
      orderDate: '2024-01-17T09:15:00Z',
      total: 1200,
      orderValue: 1200,
      totalAmount: 1200,
      codCharges: 1200,
      shippingCharges: 65,
      totalCharges: 65
    }
  ],
  count: 3,
  pages: 1
};

// Mock the service function
const mockFetchOrdersDirectly = async (token, options) => {
  console.log('🎭 Using mock Shiprocket data...');
  return sampleShiprocketData;
};

// Replace the service function temporarily
originalService.fetchOrdersDirectly = mockFetchOrdersDirectly;

async function testDashboardWithSampleData() {
  console.log('🧪 Testing Shiprocket Dashboard with sample data...\n');

  try {
    // Create mock request and response objects
    const mockReq = {
      user: {
        userId: 'test-user-with-connection'
      },
      query: {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
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
          console.log('\n📈 Key metrics:');
          const keyMetrics = ['Total Revenue', 'Delivered Orders', 'Delivery Rate', 'Average Order Value', 'Gross Profit', 'Net Profit'];
          data.summary.forEach(card => {
            if (keyMetrics.includes(card.title)) {
              console.log(`   ${card.title}: ${card.value}`);
            }
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

    // Mock the getShippingConnection function to return a connection
    const originalController = require('./controllers/shiprocket-dashboard.controller');
    
    // We need to mock the internal functions, but since they're not exported,
    // we'll modify the service to simulate having a connection
    console.log('1. Testing dashboard controller with sample data...');
    
    // For this test, we'll modify the controller temporarily
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
    const { dynamoDB } = require('./config/aws.config');
    
    // Mock DynamoDB response for shipping connection
    const originalSend = dynamoDB.send;
    dynamoDB.send = async (command) => {
      if (command.input?.TableName === 'shipping_connections') {
        return {
          Items: [{
            userId: 'test-user-with-connection',
            token: 'mock-shiprocket-token',
            connectionType: 'shiprocket'
          }]
        };
      }
      if (command.input?.TableName === 'business_expenses') {
        return {
          Items: [{
            userId: 'test-user-with-connection',
            agencyFees: 5000,
            rtoHandlingFees: 1000,
            paymentGatewayFeePercent: 2.5,
            staffFees: 10000,
            officeRent: 15000,
            otherExpenses: 2000
          }]
        };
      }
      if (command.input?.TableName === 'meta_insights') {
        return {
          Items: [{
            userId: 'test-user-with-connection',
            date: '2024-01-15',
            adSpend: 5000
          }, {
            userId: 'test-user-with-connection',
            date: '2024-01-16',
            adSpend: 6000
          }]
        };
      }
      return { Items: [] };
    };
    
    await originalController.getShiprocketDashboardData(mockReq, mockRes);
    
    // Restore original function
    dynamoDB.send = originalSend;
    
    console.log('\n✅ Dashboard test with sample data completed!');
    console.log('💡 This test shows how the dashboard works with real Shiprocket data.');
    
  } catch (error) {
    console.error('❌ Dashboard test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testDashboardWithSampleData().catch(console.error);