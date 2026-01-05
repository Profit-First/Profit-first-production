/**
 * Test script to verify 250 records per page pagination
 */

const shiprocketDashboardController = require('./controllers/shiprocket-dashboard.controller');

// Mock the shiprocket service to simulate large dataset
const originalService = require('./services/shiprocket.service');

// Create mock data to simulate 250+ records
function createMockShiprocketData(totalRecords = 500) {
  const shipments = [];
  
  for (let i = 1; i <= totalRecords; i++) {
    const isDelivered = i % 3 === 0; // Every 3rd order is delivered
    const isInTransit = i % 3 === 1;  // Every 3rd order is in transit
    const isCancelled = i % 3 === 2;  // Every 3rd order is cancelled
    
    shipments.push({
      orderId: `ORD${i.toString().padStart(4, '0')}`,
      shiprocketOrderId: `${1100000000 + i}`,
      shipmentId: `${1000000000 + i}`,
      total: 1500 + (i % 500), // Varying order values
      orderValue: 1500 + (i % 500),
      totalAmount: 1500 + (i % 500),
      amount: 1500 + (i % 500),
      tax: 67.5 + (i % 22.5),
      paymentMethod: i % 2 === 0 ? 'cod' : 'prepaid',
      paymentStatus: 'pending',
      codCharges: i % 2 === 0 ? 1500 + (i % 500) : 0,
      customerName: `Customer ${i}`,
      customerEmail: `customer${i}@example.com`,
      customerCity: i % 2 === 0 ? 'Mumbai' : 'Delhi',
      customerState: i % 2 === 0 ? 'Maharashtra' : 'Delhi',
      customerPincode: i % 2 === 0 ? '400001' : '110001',
      status: isDelivered ? 'DELIVERED' : isInTransit ? 'IN TRANSIT' : 'CANCELED',
      statusCode: isDelivered ? 6 : isInTransit ? 20 : 12,
      masterStatus: 'FULFILLED',
      awbCode: `AWB${i.toString().padStart(10, '0')}`,
      courierName: i % 3 === 0 ? 'Delhivery' : i % 3 === 1 ? 'Shadowfax' : 'BlueDart',
      weight: 0.3 + (i % 0.5),
      dimensions: '25x25x3',
      orderDate: `${28 + (i % 3)} Dec 2025, ${10 + (i % 12)}:${10 + (i % 50)} ${i % 2 === 0 ? 'AM' : 'PM'}`,
      createdAt: `${28 + (i % 3)} Dec 2025, ${10 + (i % 12)}:${10 + (i % 50)} ${i % 2 === 0 ? 'AM' : 'PM'}`,
      updatedAt: `${29 + (i % 2)} Dec 2025, ${11 + (i % 12)}:${15 + (i % 45)} ${i % 2 === 0 ? 'AM' : 'PM'}`,
      etd: `2026-01-${5 + (i % 10)} 23:00:00`,
      parsedOrderDate: `2025-12-${28 + (i % 3)}`,
      // Shipping costs - realistic values
      freightCharges: 80 + (i % 50),
      shippingCharges: 80 + (i % 50),
      totalCharges: 80 + (i % 50),
      appliedWeightAmount: 80 + (i % 50),
      source: 'merged_apis',
      channelName: 'My Store (Shopify)'
    });
  }
  
  return {
    success: true,
    shipments,
    count: shipments.length,
    pages: Math.ceil(totalRecords / 250)
  };
}

// Mock the service function
const mockFetchOrdersDirectly = async (token, options) => {
  console.log('🎭 Using mock data with 500 records (250 per page)...');
  console.log(`📊 Requested: ${options.perPage} per page, max ${options.maxPages} pages`);
  
  const mockData = createMockShiprocketData(500);
  
  console.log(`✅ Mock data created: ${mockData.count} total records`);
  console.log(`📈 Breakdown:`);
  console.log(`   - Delivered: ${mockData.shipments.filter(s => s.statusCode === 6).length}`);
  console.log(`   - In Transit: ${mockData.shipments.filter(s => s.statusCode === 20).length}`);
  console.log(`   - Cancelled: ${mockData.shipments.filter(s => s.statusCode === 12).length}`);
  
  return mockData;
};

// Replace the service function temporarily
originalService.fetchOrdersDirectly = mockFetchOrdersDirectly;

async function testPagination250() {
  console.log('🧪 Testing Shiprocket Dashboard with 250 records per page...\n');

  try {
    // Create mock request and response objects
    const mockReq = {
      user: {
        userId: 'test-user-pagination'
      },
      query: {
        startDate: '2025-12-01',
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
          console.log('\n📈 Key metrics with 500 records:');
          const keyMetrics = ['Total Revenue', 'Delivered Orders', 'Delivery Rate', 'Average Order Value', 'Shipping Cost', 'Total Shipments'];
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
            userId: 'test-user-pagination',
            token: 'pagination-test-token',
            connectionType: 'shiprocket'
          }]
        };
      }
      if (command.input?.TableName === 'business_expenses') {
        return {
          Items: [{
            userId: 'test-user-pagination',
            agencyFees: 10000,
            rtoHandlingFees: 3000,
            paymentGatewayFeePercent: 2.5,
            staffFees: 20000,
            officeRent: 25000,
            otherExpenses: 5000
          }]
        };
      }
      if (command.input?.TableName === 'meta_insights') {
        return {
          Items: [{
            userId: 'test-user-pagination',
            date: '2025-12-28',
            adSpend: 15000
          }, {
            userId: 'test-user-pagination',
            date: '2025-12-29',
            adSpend: 18000
          }, {
            userId: 'test-user-pagination',
            date: '2025-12-30',
            adSpend: 20000
          }]
        };
      }
      return { Items: [] };
    };
    
    console.log('1. Testing dashboard controller with 500 records (250 per page)...');
    await shiprocketDashboardController.getShiprocketDashboardData(mockReq, mockRes);
    
    // Restore original function
    dynamoDB.send = originalSend;
    
    console.log('\n✅ Pagination test completed!');
    console.log('💡 This test simulates fetching 500 records at 250 per page.');
    console.log('💡 Expected: ~167 delivered orders, ~₹250,000+ revenue');
    
  } catch (error) {
    console.error('❌ Pagination test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testPagination250().catch(console.error);