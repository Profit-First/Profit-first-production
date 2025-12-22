/**
 * Direct fetch from Meta API for account 889786217551799
 */
require('dotenv').config();
const axios = require('axios');
const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');

const FB_API_VERSION = 'v23.0';

async function directMetaFetch() {
  const userId = 'e1c32dea-7001-70ec-4323-41d4e59e589a';
  const targetAccountId = '889786217551799';
  
  console.log(`🔍 Direct Meta API fetch for account ${targetAccountId}`);
  console.log(`   Date range: Nov 23 - Dec 22, 2025\n`);
  
  try {
    // Get access token from meta_connections
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
    
    console.log('✅ Found Meta connection');
    console.log(`   Ad accounts: ${connection.adAccounts?.length || 0}`);
    
    // Find the target account
    const targetAccount = connection.adAccounts?.find(a => 
      a.accountId === targetAccountId || a.account_id === targetAccountId
    );
    
    if (targetAccount) {
      console.log(`   Target account: ${targetAccount.name} (${targetAccountId})`);
    }
    
    // Fetch directly from Meta API
    const accountId = `act_${targetAccountId}`;
    const since = '2025-11-23';
    const until = '2025-12-22';
    
    console.log(`\n📊 Fetching from Meta API...`);
    console.log(`   Account: ${accountId}`);
    console.log(`   Range: ${since} to ${until}`);
    
    const response = await axios.get(
      `https://graph.facebook.com/${FB_API_VERSION}/${accountId}/insights`,
      {
        params: {
          access_token: connection.accessToken,
          fields: 'date_start,date_stop,spend,impressions,reach,clicks',
          time_range: JSON.stringify({ since, until }),
          time_increment: 1,
          level: 'account'
        }
      }
    );
    
    const insights = response.data.data || [];
    console.log(`\n✅ Meta API returned ${insights.length} days of data\n`);
    
    let totalSpend = 0;
    insights.forEach(day => {
      const spend = parseFloat(day.spend || 0);
      totalSpend += spend;
      console.log(`   ${day.date_start}: ₹${spend.toFixed(2)}`);
    });
    
    console.log(`\n💰 Total from Meta API: ₹${totalSpend.toFixed(2)}`);
    console.log(`📊 Expected: ₹102,505`);
    console.log(`📊 Difference: ₹${(102505 - totalSpend).toFixed(2)}`);
    
    // Check if there's pagination
    if (response.data.paging?.next) {
      console.log(`\n⚠️  There's more data (pagination)!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

directMetaFetch();
