/**
 * Debug script to understand the actual Meta table structure
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const META_INSIGHTS_TABLE = process.env.META_INSIGHTS_TABLE || 'meta_insights';

async function debugMetaTable() {
  console.log('🔍 Debugging Meta insights table structure...');
  
  try {
    // First, try to scan without any filter to see if table has data
    const scanCommand = new ScanCommand({
      TableName: META_INSIGHTS_TABLE,
      Limit: 10
    });
    
    const result = await docClient.send(scanCommand);
    const items = result.Items || [];
    
    console.log(`📊 Found ${items.length} total items in table`);
    
    if (items.length > 0) {
      console.log('\n📋 Sample item structure:');
      console.log(JSON.stringify(items[0], null, 2));
      
      console.log('\n🔑 All item keys and values:');
      items.forEach((item, index) => {
        console.log(`\nItem ${index + 1}:`);
        console.log(`  Keys: ${Object.keys(item).join(', ')}`);
        if (item.userId) console.log(`  userId: ${item.userId}`);
        if (item.date) console.log(`  date: ${item.date}`);
        if (item.adSpend) console.log(`  adSpend: ₹${item.adSpend}`);
      });
      
      // Look for our user's data
      const userItems = items.filter(item => 
        item.userId && item.userId.includes('e1c32dea-7001-70ec-4323-41d4e59e589a')
      );
      
      console.log(`\n👤 Found ${userItems.length} items for our user`);
      userItems.forEach(item => {
        console.log(`   ${item.date || 'no-date'}: ₹${item.adSpend || 0}`);
      });
      
    } else {
      console.log('📭 Table appears to be empty');
      
      // Try to describe table structure
      console.log('\n🔧 Attempting to understand table schema...');
      
      // Check if we can at least connect to the table
      try {
        const testScan = new ScanCommand({
          TableName: META_INSIGHTS_TABLE,
          Limit: 1,
          Select: 'COUNT'
        });
        
        const testResult = await docClient.send(testScan);
        console.log(`✅ Table exists and is accessible. Count: ${testResult.Count}`);
        
      } catch (testError) {
        console.error('❌ Table access error:', testError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
    console.error('Full error:', error);
  }
}

// Run debug if called directly
if (require.main === module) {
  require('dotenv').config();
  debugMetaTable();
}

module.exports = { debugMetaTable };