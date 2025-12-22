/**
 * Check what Meta data we have for Dec 16-22
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const META_INSIGHTS_TABLE = process.env.META_INSIGHTS_TABLE || 'meta_insights';

async function checkDecData() {
  const userId = 'e1c32dea-7001-70ec-4323-41d4e59e589a';
  
  console.log('🔍 Checking Meta data for Dec 16-22...\n');
  
  try {
    const scanCommand = new ScanCommand({
      TableName: META_INSIGHTS_TABLE,
      FilterExpression: 'userId = :userId AND #date BETWEEN :startDate AND :endDate',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':startDate': '2025-12-16',
        ':endDate': '2025-12-22'
      },
      ExpressionAttributeNames: {
        '#date': 'date'
      }
    });
    
    const result = await docClient.send(scanCommand);
    const items = result.Items || [];
    
    console.log(`📊 Found ${items.length} records for Dec 16-22\n`);
    
    // Group by date and account
    const byDate = {};
    let totalSpend = 0;
    
    items.forEach(item => {
      const date = item.date;
      const accountId = item.adAccountId;
      const spend = item.adSpend || 0;
      
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push({ accountId, spend });
      totalSpend += spend;
    });
    
    // Print by date
    Object.keys(byDate).sort().forEach(date => {
      console.log(`📅 ${date}:`);
      byDate[date].forEach(entry => {
        console.log(`   Account ${entry.accountId}: ₹${entry.spend.toFixed(2)}`);
      });
    });
    
    console.log(`\n💰 Total Ad Spend (Dec 16-22): ₹${totalSpend.toFixed(2)}`);
    console.log(`📊 Expected from Meta Ads Manager: ₹28,502`);
    console.log(`📊 Difference: ₹${(28502 - totalSpend).toFixed(2)}`);
    
    // Check which accounts have data
    const accounts = new Set();
    items.forEach(item => accounts.add(item.adAccountId));
    console.log(`\n🏢 Ad Accounts with data: ${Array.from(accounts).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config();
  checkDecData();
}

module.exports = { checkDecData };