/**
 * Full Meta sync with pagination for account 889786217551799
 */
require('dotenv').config();
const axios = require('axios');
const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');

const FB_API_VERSION = 'v23.0';
const META_INSIGHTS_TABLE = process.env.META_INSIGHTS_TABLE || 'meta_insights';

async function fullMetaSync() {
  const userId = 'e1c32dea-7001-70ec-4323-41d4e59e589a';
  const targetAccountId = '889786217551799';
  
  console.log(`🔄 Full Meta sync for account ${targetAccountId}`);
  console.log(`   Date range: Nov 23 - Dec 22, 2025\n`);
  
  try {
    // Get access token
    const command = new GetCommand({
      TableName: process.env.META_CONNECTIONS_TABLE || 'meta_connections',
      Key: { userId }
    });
    
    const result = await dynamoDB.send(command);
    const connection = result.Item;
    
    if (!connection || !connection.accessToken) {
      console.log('❌ No Meta connection found');
      return;
    }
    
    // Fetch with pagination
    const accountId = `act_${targetAccountId}`;
    const since = '2025-11-23';
    const until = '2025-12-22';
    
    let allInsights = [];
    let nextUrl = null;
    
    // First request
    console.log('📊 Fetching from Meta API (with pagination)...');
    const response = await axios.get(
      `https://graph.facebook.com/${FB_API_VERSION}/${accountId}/insights`,
      {
        params: {
          access_token: connection.accessToken,
          fields: 'date_start,date_stop,spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,actions,action_values',
          time_range: JSON.stringify({ since, until }),
          time_increment: 1,
          level: 'account',
          limit: 500
        }
      }
    );
    
    allInsights = response.data.data || [];
    nextUrl = response.data.paging?.next;
    console.log(`   Page 1: ${allInsights.length} records`);
    
    // Fetch all pages
    let pageNum = 2;
    while (nextUrl) {
      const nextResponse = await axios.get(nextUrl);
      const nextData = nextResponse.data.data || [];
      allInsights = allInsights.concat(nextData);
      nextUrl = nextResponse.data.paging?.next;
      console.log(`   Page ${pageNum}: ${nextData.length} records`);
      pageNum++;
    }
    
    console.log(`\n✅ Total fetched: ${allInsights.length} days\n`);
    
    // Save to database
    let totalSpend = 0;
    for (const insight of allInsights) {
      const date = insight.date_start;
      const spend = parseFloat(insight.spend || 0);
      totalSpend += spend;
      
      // Extract actions
      const actions = insight.actions || [];
      const linkClicks = actions.find(a => a.action_type === 'link_click')?.value || '0';
      const purchases = actions.find(a => a.action_type === 'purchase')?.value || '0';
      const actionValues = insight.action_values || [];
      const purchaseValue = actionValues.find(a => a.action_type === 'purchase')?.value || '0';
      
      const item = {
        userId,
        date,
        adAccountId: targetAccountId,
        dateAccount: `${date}#${targetAccountId}`,
        adSpend: spend,
        impressions: parseInt(insight.impressions || 0),
        reach: parseInt(insight.reach || 0),
        linkClicks: parseInt(linkClicks),
        cpc: parseFloat(insight.cpc || 0),
        cpm: parseFloat(insight.cpm || 0),
        ctr: parseFloat(insight.ctr || 0),
        frequency: parseFloat(insight.frequency || 0),
        metaPurchases: parseInt(purchases),
        metaRevenue: parseFloat(purchaseValue),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'meta_api'
      };
      
      await dynamoDB.send(new PutCommand({
        TableName: META_INSIGHTS_TABLE,
        Item: item
      }));
      
      console.log(`   ✅ ${date}: ₹${spend.toFixed(2)}`);
    }
    
    console.log(`\n💰 Total Ad Spend synced: ₹${totalSpend.toFixed(2)}`);
    console.log(`📊 Expected: ₹102,505`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

fullMetaSync();
