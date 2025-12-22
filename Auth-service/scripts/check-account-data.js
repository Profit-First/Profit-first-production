/**
 * Check Meta data for account 889786217551799 (Nov 23 - Dec 22)
 */
require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function checkAccountData() {
  const userId = 'e1c32dea-7001-70ec-4323-41d4e59e589a';
  const targetAccount = '889786217551799';
  
  console.log(`🔍 Checking Meta data for account ${targetAccount}`);
  console.log(`   Date range: 2024-11-23 to 2024-12-22\n`);
  
  try {
    // Scan ALL data for this user
    const scanCommand = new ScanCommand({
      TableName: process.env.META_INSIGHTS_TABLE || 'meta_insights',
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const result = await docClient.send(scanCommand);
    const items = result.Items || [];
    
    console.log(`📊 Total records in DB: ${items.length}\n`);
    
    // Group by account
    const byAccount = {};
    items.forEach(item => {
      const acc = item.adAccountId || 'unknown';
      if (!byAccount[acc]) byAccount[acc] = [];
      byAccount[acc].push(item);
    });
    
    console.log('📊 Records by Ad Account:');
    Object.keys(byAccount).forEach(acc => {
      console.log(`   ${acc}: ${byAccount[acc].length} records`);
    });
    
    // Show all dates we have
    console.log('\n📅 All dates in DB:');
    const allDates = [...new Set(items.map(i => i.date))].sort();
    console.log(`   ${allDates.join(', ')}`);
    
    // Filter for target account and date range (2025)
    const targetData = items.filter(item => {
      const isTargetAccount = item.adAccountId === targetAccount;
      const date = item.date;
      const inRange = date >= '2025-11-23' && date <= '2025-12-22';
      return isTargetAccount && inRange;
    });
    
    console.log(`\n📊 Account ${targetAccount} data (Nov 23 - Dec 22):`);
    console.log(`   Records found: ${targetData.length}`);
    
    if (targetData.length > 0) {
      // Sort by date
      targetData.sort((a, b) => a.date.localeCompare(b.date));
      
      let totalSpend = 0;
      targetData.forEach(item => {
        const spend = item.adSpend || 0;
        totalSpend += spend;
        console.log(`   ${item.date}: ₹${spend.toFixed(2)}`);
      });
      
      console.log(`\n💰 Total Ad Spend: ₹${totalSpend.toFixed(2)}`);
      console.log(`📊 Expected: ₹102,505`);
      console.log(`📊 Difference: ₹${(102505 - totalSpend).toFixed(2)}`);
    }
    
    // Also check what dates we have for ALL accounts in range
    console.log(`\n📊 ALL accounts data (Nov 23 - Dec 22, 2025):`);
    const allInRange = items.filter(item => {
      const date = item.date;
      return date >= '2025-11-23' && date <= '2025-12-22';
    });
    
    let grandTotal = 0;
    const byDateAccount = {};
    allInRange.forEach(item => {
      const key = `${item.date}|${item.adAccountId}`;
      byDateAccount[key] = item.adSpend || 0;
      grandTotal += item.adSpend || 0;
    });
    
    console.log(`   Total records: ${allInRange.length}`);
    console.log(`   Grand total spend: ₹${grandTotal.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAccountData();
