/**
 * Test script to verify Shiprocket dashboard with mock data
 */

const shiprocketDashboardController = require('./controllers/shiprocket-dashboard.controller');

async function testDashboardWithMockData() {
  console.log('🧪 Testing Shiprocket Dashboard with mock data...\n');

  try {
    // Create mock request and response objects
    const mockReq = {
      user: {
        userId: 'test-user-123'
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
        console.log('   Metadata:', data.metadata);
        
        if (data.summary && data.summary.length > 0) {
          console.log('\n📈 Sample metrics:');
          data.summary.slice(0, 5).forEach(card => {
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

    console.log('1. Testing dashboard controller...');
    await shiprocketDashboardController.getShiprocketDashboardData(mockReq, mockRes);
    
    console.log('\n✅ Dashboard test completed!');
    console.log('💡 If you see "No Shiprocket connection found", that\'s expected for mock data.');
    console.log('💡 Connect a real Shiprocket account to see actual data.');
    
  } catch (error) {
    console.error('❌ Dashboard test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testDashboardWithMockData().catch(console.error);