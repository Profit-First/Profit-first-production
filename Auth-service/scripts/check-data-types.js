/**
 * Check data types in meta_insights table
 */
require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function checkDataTypes() {
  const userId = 'e1c32dea-7001-70ec-4323-41d4e59e589a';
  
  try {
    const scanCommand = new ScanCommand({
      TableName: process.env.META_INSIGHTS_TABLE || 'meta_insights',
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Limit: 5
    });
    
    const result = await docClient.send(scanCommand);
    const items = result.Items || [];
    
    console.log('📊 Sample records:\n');
    items.forEach((item, i) => {
      console.log(`Record ${i + 1}:`);
      console.log(`   adAccountId: "${item.adAccountId}" (type: ${typeof item.adAccountId})`);
      console.log(`   date: "${item.date}"`);
      console.log(`   adSpend: ${item.adSpend}`);
      console.log('');
    });
    
    // Test filter with string
    console.log('\n🔍 Testing filter with string "889786217551799"...');
    const testCommand = new ScanCommand({
      TableName: process.env.META_INSIGHTS_TABLE || 'meta_insights',
      FilterExpression: 'userId = :userId AND adAccountId = :adAccountId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':adAccountId': '889786217551799'
      }
    });
    
    const testResult = await docClient.send(testCommand);
    console.log(`   Found: ${testResult.Items?.length || 0} records`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDataTypes();
