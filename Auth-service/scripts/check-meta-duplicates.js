/**
 * Script to check and show Meta insights duplicates
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const META_INSIGHTS_TABLE = process.env.META_INSIGHTS_TABLE || 'meta_insights';

async function checkDuplicates() {
  console.log('🔍 Checking Meta insights duplicates...');
  
  try {
    // Scan all Meta insights
    const scanCommand = new ScanCommand({
      TableName: META_INSIGHTS_TABLE,
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': 'e1c32dea-7001-70ec-4323-41d4e59e589a' // Your user ID
      }
    });
    
    const result = await docClient.send(scanCommand);
    const allInsights = result.Items || [];
    
    console.log(`📊 Found ${allInsights.length} Meta insights for your user`);
    
    // Group by date
    const groupedByDate = new Map();
    
    allInsights.forEach(insight => {
      const date = insight.date;
      
      if (!groupedByDate.has(date)) {
        groupedByDate.set(date, []);
      }
      
      groupedByDate.get(date).push(insight);
    });
    
    console.log(`📊 Found ${groupedByDate.size} unique dates`);
    
    // Show duplicates
    let duplicatesFound = 0;
    let totalDuplicateSpend = 0;
    
    for (const [date, insights] of groupedByDate) {
      if (insights.length > 1) {
        duplicatesFound++;
        const totalSpend = insights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
        const correctSpend = insights[0].adSpend || 0; // Assume first one is correct
        
        console.log(`\n📅 ${date}: ${insights.length} duplicates`);
        insights.forEach((insight, index) => {
          console.log(`   ${index + 1}. ₹${insight.adSpend || 0} (${insight.adAccountId || 'no-account'})`);
        });
        console.log(`   Total: ₹${totalSpend.toFixed(2)} (should be ~₹${correctSpend.toFixed(2)})`);
        
        totalDuplicateSpend += totalSpend - correctSpend;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Dates with duplicates: ${duplicatesFound}`);
    console.log(`   Extra spend from duplicates: ₹${totalDuplicateSpend.toFixed(2)}`);
    
    // Show recent dates for debugging
    console.log(`\n📅 Recent dates (Dec 16-22):`);
    const recentDates = ['2025-12-16', '2025-12-17', '2025-12-18', '2025-12-19', '2025-12-20', '2025-12-21', '2025-12-22'];
    
    let recentTotal = 0;
    recentDates.forEach(date => {
      const insights = groupedByDate.get(date) || [];
      const totalSpend = insights.reduce((sum, insight) => sum + (insight.adSpend || 0), 0);
      recentTotal += totalSpend;
      
      if (insights.length > 0) {
        console.log(`   ${date}: ₹${totalSpend.toFixed(2)} (${insights.length} entries)`);
      }
    });
    
    console.log(`   Recent total: ₹${recentTotal.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Check error:', error);
  }
}

// Run check if called directly
if (require.main === module) {
  require('dotenv').config();
  checkDuplicates();
}

module.exports = { checkDuplicates };