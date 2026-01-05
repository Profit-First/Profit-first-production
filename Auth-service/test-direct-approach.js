/**
 * Test the new DIRECT approach - no database middleman
 */

const shiprocketDashboardController = require('./controllers/shiprocket-dashboard.controller');

async function testDirectApproach() {
  console.log('🧪 Testing DIRECT Shiprocket Dashboard approach...\n');

  try {
    // Create mock request and response objects
    const mockReq = {
      user: {
        userId: 'test-direct-user'
      },
      query: {
        startDate: '2025-12-01',
        endDate: '2025-12-31'
      }
    };

    const mockRes = {
      json: (data) => {
        console.log('✅ Direct dashboard response received');
        console.log('📊 Response structure:');
        console.log('   Summary cards:', data.summary?.length || 0);
        console.log('   Performance data points:', data.performanceChartData?.length || 0);
        console.log('   Financial breakdown items:', data.financialsBreakdownData?.pieData?.length || 0);
        console.log('   Metadata:', data.metadata);
        
        if (data.summary && data.summary.length > 0) {
          console.log('\n📈 Sample metrics:');
          data.summary.slice(0, 6).forEach(card => {
            console.log(`   ${card.title}: ${card.value}`);
          });
        }
        
        return data;
      },
      status: (code) => ({
        json: (data) => {
          console.log(`❌ Error response (${code}):`, data);
          return data;
        }
      })
    };

    // Mock the database call for Shiprocket token
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
    const { dynamoDB } = require('./config/aws.config');
    
    const originalSend = dynamoDB.send;
    dynamoDB.send = async (command) => {
      if (command.input?.TableName === 'shipping_connections') {
        // Simulate no connection for this test
        return { Items: [] };
      }
      return { Items: [] };
    };
    
    console.log('1. Testing with NO Shiprocket connection (should show empty state)...');
    await shiprocketDashboardController.getShiprocketDashboardData(mockReq, mockRes);
    
    // Restore original function
    dynamoDB.send = originalSend;
    
    console.log('\n✅ Direct approach test completed!');
    console.log('💡 This shows the simplified direct approach working.');
    console.log('💡 Next: Connect real Shiprocket account to see actual data.');
    
  } catch (error) {
    console.error('❌ Direct approach test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testDirectApproach().catch(console.error);