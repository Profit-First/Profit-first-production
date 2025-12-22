/**
 * One-time script to clean up duplicate Meta insights in database
 * Run this once to fix existing duplicate data
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const META_INSIGHTS_TABLE = process.env.META_INSIGHTS_TABLE || 'meta_insights';

async function cleanupDuplicates() {
  console.log('🧹 Starting Meta insights cleanup...');
  
  try {
    // Scan all Meta insights
    const scanCommand = new ScanCommand({
      TableName: META_INSIGHTS_TABLE
    });
    
    const result = await docClient.send(scanCommand);
    const allInsights = result.Items || [];
    
    console.log(`📊 Found ${allInsights.length} total Meta insights`);
    
    // Group by userId and date
    const groupedInsights = new Map();
    
    allInsights.forEach(insight => {
      const key = `${insight.userId}#${insight.date}`;
      
      if (!groupedInsights.has(key)) {
        groupedInsights.set(key, []);
      }
      
      groupedInsights.get(key).push(insight);
    });
    
    console.log(`📊 Found ${groupedInsights.size} unique user-date combinations`);
    
    let duplicatesFound = 0;
    let duplicatesFixed = 0;
    
    // Process each group
    for (const [key, insights] of groupedInsights) {
      if (insights.length > 1) {
        duplicatesFound++;
        console.log(`🔍 Found ${insights.length} duplicates for ${key}`);
        
        // Aggregate all insights for this user-date
        const aggregated = {
          userId: insights[0].userId,
          date: insights[0].date,
          adSpend: 0,
          impressions: 0,
          reach: 0,
          linkClicks: 0,
          metaPurchases: 0,
          metaRevenue: 0,
          cpc: 0,
          cpm: 0,
          ctr: 0,
          frequency: 0,
          adAccounts: [],
          createdAt: insights[0].createdAt,
          updatedAt: new Date().toISOString(),
          source: 'meta_api_cleanup'
        };
        
        let totalImpressions = 0;
        
        // Sum up all metrics
        insights.forEach(insight => {
          aggregated.adSpend += insight.adSpend || 0;
          aggregated.impressions += insight.impressions || 0;
          aggregated.reach = Math.max(aggregated.reach, insight.reach || 0);
          aggregated.linkClicks += insight.linkClicks || 0;
          aggregated.metaPurchases += insight.metaPurchases || 0;
          aggregated.metaRevenue += insight.metaRevenue || 0;
          
          // Weighted averages for CPC, CPM, CTR
          const impressions = insight.impressions || 0;
          if (impressions > 0) {
            aggregated.cpc += (insight.cpc || 0) * impressions;
            aggregated.cpm += (insight.cpm || 0) * impressions;
            aggregated.ctr += (insight.ctr || 0) * impressions;
            totalImpressions += impressions;
          }
          
          aggregated.frequency = Math.max(aggregated.frequency, insight.frequency || 0);
          
          // Collect ad account IDs
          if (insight.adAccountId) {
            aggregated.adAccounts.push(insight.adAccountId);
          }
          if (insight.adAccounts) {
            aggregated.adAccounts.push(...insight.adAccounts);
          }
        });
        
        // Calculate weighted averages
        if (totalImpressions > 0) {
          aggregated.cpc = aggregated.cpc / totalImpressions;
          aggregated.cpm = aggregated.cpm / totalImpressions;
          aggregated.ctr = aggregated.ctr / totalImpressions;
        }
        
        // Remove duplicates from ad accounts
        aggregated.adAccounts = [...new Set(aggregated.adAccounts)];
        
        console.log(`   Aggregated: ₹${aggregated.adSpend.toFixed(2)} spend, ${aggregated.impressions} impressions`);
        
        // Delete all old entries
        for (const insight of insights) {
          // Build the correct key based on the table schema
          const deleteKey = {
            userId: insight.userId,
            date: insight.date
          };
          
          // Add additional key fields if they exist
          if (insight.dateAccount) {
            deleteKey.dateAccount = insight.dateAccount;
          }
          if (insight.adAccountId && !insight.dateAccount) {
            deleteKey.adAccountId = insight.adAccountId;
          }
          
          const deleteCommand = new DeleteCommand({
            TableName: META_INSIGHTS_TABLE,
            Key: deleteKey
          });
          
          try {
            await docClient.send(deleteCommand);
          } catch (error) {
            console.log(`   ⚠️  Could not delete old entry: ${error.message}`);
            // Try with just userId and date
            try {
              const simpleDeleteCommand = new DeleteCommand({
                TableName: META_INSIGHTS_TABLE,
                Key: {
                  userId: insight.userId,
                  date: insight.date
                }
              });
              await docClient.send(simpleDeleteCommand);
            } catch (error2) {
              console.log(`   ⚠️  Could not delete with simple key either: ${error2.message}`);
            }
          }
        }
        
        // Insert aggregated entry
        const putCommand = new PutCommand({
          TableName: META_INSIGHTS_TABLE,
          Item: aggregated
        });
        
        await docClient.send(putCommand);
        duplicatesFixed++;
        
        console.log(`   ✅ Fixed duplicates for ${key}`);
      }
    }
    
    console.log(`\n✅ Cleanup completed!`);
    console.log(`   Duplicates found: ${duplicatesFound}`);
    console.log(`   Duplicates fixed: ${duplicatesFixed}`);
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
}

// Run cleanup if called directly
if (require.main === module) {
  require('dotenv').config();
  cleanupDuplicates();
}

module.exports = { cleanupDuplicates };