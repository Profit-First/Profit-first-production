/**
 * Meta Sync Service
 * 
 * Handles automatic daily sync of Meta/Facebook Ads data
 * Fetches latest insights and updates database
 */

const axios = require('axios');
const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');

const META_CONNECTIONS_TABLE = process.env.META_CONNECTIONS_TABLE || 'meta_connections';
const META_INSIGHTS_TABLE = process.env.META_INSIGHTS_TABLE || 'meta_insights';
const FB_API_VERSION = 'v23.0';

class MetaSyncService {
  /**
   * Daily sync for a user
   * Fetches yesterday's data from Meta API
   */
  async dailySync(userId) {
    console.log(`🔄 Starting Meta sync for user: ${userId}`);
    
    try {
      // Get Meta connection
      const connection = await this.getConnection(userId);
      
      if (!connection) {
        console.log(`   ⚠️  No Meta connection found`);
        return { success: false, reason: 'no_connection' };
      }
      
      if (!connection.accessToken) {
        console.log(`   ⚠️  No access token found`);
        return { success: false, reason: 'no_token' };
      }
      
      if (!connection.adAccounts || connection.adAccounts.length === 0) {
        console.log(`   ⚠️  No ad accounts found`);
        return { success: false, reason: 'no_accounts' };
      }
      
      // Calculate yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      
      console.log(`   📅 Syncing data for: ${dateStr}`);
      console.log(`   📊 Ad accounts: ${connection.adAccounts.length}`);
      
      let totalRecords = 0;
      
      // Sync each ad account
      for (const account of connection.adAccounts) {
        const accountId = account.id || `act_${account.accountId}`;
        const numericAccountId = account.accountId || account.account_id;
        
        try {
          console.log(`   🔍 Fetching: ${account.name || numericAccountId}`);
          
          // Fetch yesterday's insights
          const insights = await this.fetchDailyInsights(
            connection.accessToken,
            accountId,
            dateStr
          );
          
          if (insights) {
            await this.saveInsightData(userId, numericAccountId, insights);
            totalRecords++;
            console.log(`   ✅ Synced: ${account.name || numericAccountId}`);
          } else {
            console.log(`   ⚠️  No data: ${account.name || numericAccountId}`);
          }
          
        } catch (error) {
          console.error(`   ❌ Error syncing ${numericAccountId}:`, error.message);
          // Continue with next account
        }
      }
      
      console.log(`✅ Meta sync completed!`);
      console.log(`   Records synced: ${totalRecords}\n`);
      
      return {
        success: true,
        recordsSynced: totalRecords,
        accountsProcessed: connection.adAccounts.length
      };
      
    } catch (error) {
      console.error(`❌ Meta sync error for ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Fetch 3 months of historical data (for initial setup)
   */
  async fetch3MonthsData(userId) {
    console.log(`📊 Fetching 3 months of Meta data for user: ${userId}`);
    
    try {
      const connection = await this.getConnection(userId);
      
      if (!connection || !connection.accessToken || !connection.adAccounts) {
        throw new Error('Invalid Meta connection');
      }
      
      // Calculate date range (last 3 months)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
      
      const since = startDate.toISOString().split('T')[0];
      const until = endDate.toISOString().split('T')[0];
      
      console.log(`   📅 Date range: ${since} to ${until}`);
      
      let totalRecords = 0;
      
      // Fetch for each ad account
      for (const account of connection.adAccounts) {
        const accountId = account.id || `act_${account.accountId}`;
        const numericAccountId = account.accountId || account.account_id;
        
        console.log(`   🔍 Fetching: ${account.name || numericAccountId}`);
        
        try {
          // Fetch daily insights for 3 months
          const insightsResponse = await axios.get(
            `https://graph.facebook.com/${FB_API_VERSION}/${accountId}/insights`,
            {
              params: {
                access_token: connection.accessToken,
                fields: 'date_start,date_stop,spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,actions,action_values',
                time_range: JSON.stringify({ since, until }),
                time_increment: 1, // Daily breakdown
                level: 'account'
              }
            }
          );
          
          const insights = insightsResponse.data.data || [];
          console.log(`   ✅ Fetched ${insights.length} days of data`);
          
          // Store each day's insights
          for (const dayInsight of insights) {
            await this.saveInsightData(userId, numericAccountId, dayInsight);
            totalRecords++;
          }
          
        } catch (error) {
          console.error(`   ⚠️  Error fetching ${numericAccountId}:`, error.message);
          if (error.response?.data?.error) {
            console.error(`   Meta API Error:`, error.response.data.error);
          }
        }
      }
      
      console.log(`✅ 3 months data fetched: ${totalRecords} records\n`);
      
      return {
        success: true,
        recordsSynced: totalRecords,
        accountsProcessed: connection.adAccounts.length
      };
      
    } catch (error) {
      console.error(`❌ 3 months fetch error:`, error.message);
      throw error;
    }
  }
  
  /**
   * Fetch daily insights from Meta API
   */
  async fetchDailyInsights(accessToken, accountId, date) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/${FB_API_VERSION}/${accountId}/insights`,
        {
          params: {
            access_token: accessToken,
            fields: 'date_start,date_stop,spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,actions,action_values',
            time_range: JSON.stringify({ since: date, until: date }),
            level: 'account'
          }
        }
      );
      
      const data = response.data.data || [];
      return data.length > 0 ? data[0] : null;
      
    } catch (error) {
      if (error.response?.status === 400) {
        // No data for this date - normal for new accounts
        return null;
      }
      throw error;
    }
  }
  
  /**
   * Save insight data to database
   */
  async saveInsightData(userId, adAccountId, insight) {
    // Extract actions data
    const actions = insight.actions || [];
    const linkClicks = actions.find(a => a.action_type === 'link_click')?.value || '0';
    const purchases = actions.find(a => a.action_type === 'purchase')?.value || '0';
    
    // Extract action values (revenue)
    const actionValues = insight.action_values || [];
    const purchaseValue = actionValues.find(a => a.action_type === 'purchase')?.value || '0';
    
    const date = insight.date_start;
    const dateAccount = `${date}#${adAccountId}`;
    
    const item = {
      userId,
      adAccountId,
      date,
      dateAccount,
      
      // Meta Ad Metrics
      adSpend: parseFloat(insight.spend || 0),
      impressions: parseInt(insight.impressions || 0),
      reach: parseInt(insight.reach || 0),
      linkClicks: parseInt(linkClicks),
      cpc: parseFloat(insight.cpc || 0),
      cpm: parseFloat(insight.cpm || 0),
      ctr: parseFloat(insight.ctr || 0),
      frequency: parseFloat(insight.frequency || 0),
      
      // Conversion Metrics
      metaPurchases: parseInt(purchases),
      metaRevenue: parseFloat(purchaseValue),
      
      // Timestamps
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // Source
      source: 'meta_api'
    };
    
    const command = new PutCommand({
      TableName: META_INSIGHTS_TABLE,
      Item: item
    });
    
    await dynamoDB.send(command);
  }
  
  /**
   * Get Meta connection from database
   */
  async getConnection(userId) {
    try {
      const command = new GetCommand({
        TableName: META_CONNECTIONS_TABLE,
        Key: { userId }
      });
      
      const result = await dynamoDB.send(command);
      return result.Item || null;
      
    } catch (error) {
      console.error('Get Meta connection error:', error.message);
      return null;
    }
  }
}

module.exports = new MetaSyncService();
