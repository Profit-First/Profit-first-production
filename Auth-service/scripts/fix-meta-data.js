/**
 * Script to completely fix Meta data by deleting and re-syncing
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const META_INSIGHTS_TABLE = process.env.META_INSIGHTS_TABLE || 'meta_insights';

async function fixMetaData() {
  const userId = 'e1c32dea-7001-70ec-4323-41d4e59e589a'; // Your user ID
  
  console.log('🧹 Step 1: Deleting all existing Meta insights for your user...');
  
  try {
    // Scan all Meta insights for this user
    const scanCommand = new ScanCommand({
      TableName: META_INSIGHTS_TABLE,
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const result = await docClient.send(scanCommand);
    const allInsights = result.Items || [];
    
    console.log(`📊 Found ${allInsights.length} Meta insights to delete`);
    
    // Delete each one
    let deleted = 0;
    for (const insight of allInsights) {
      try {
        // Try to delete with all possible key combinations
        const keys = [
          { userId: insight.userId, date: insight.date },
          { userId: insight.userId, dateAccount: insight.dateAccount },
          { userId: insight.userId, date: insight.date, dateAccount: insight.dateAccount }
        ];
        
        for (const key of keys) {
          try {
            const deleteCommand = new DeleteCommand({
              TableName: META_INSIGHTS_TABLE,
              Key: key
            });
            await docClient.send(deleteCommand);
            deleted++;
            console.log(`   ✅ Deleted: ${insight.date}`);
            break; // Success, move to next insight
          } catch (error) {
            // Try next key combination
            continue;
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Could not delete ${insight.date}: ${error.message}`);
      }
    }
    
    console.log(`✅ Deleted ${deleted} Meta insights`);
    
    console.log('\n🔄 Step 2: Re-syncing fresh data from Meta API...');
    
    // Import and run Meta sync
    const metaSyncService = require('../services/meta-sync.service');
    const result2 = await metaSyncService.fetch3MonthsData(userId);
    
    if (result2.success) {
      console.log(`✅ Re-synced ${result2.recordsSynced} records from Meta API`);
      console.log(`\n✅ Meta data fixed! Please refresh your dashboard.`);
    } else {
      console.log(`❌ Re-sync failed: ${result2.error}`);
    }
    
  } catch (error) {
    console.error('❌ Fix error:', error);
  }
}

// Run fix if called directly
if (require.main === module) {
  require('dotenv').config();
  fixMetaData();
}

module.exports = { fixMetaData };