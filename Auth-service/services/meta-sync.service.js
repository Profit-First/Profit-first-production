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
   * Save insight data to database with proper deduplication
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

    try {
      // Use the EXACT same structure as the existing data we saw in debug
      // Each record gets its own unique userId (not composite key)
      const recordUserId = userId; // Use the actual user ID
      const dateAccount = `${date}#${adAccountId}`;

      // Create the item exactly like the existing structure
      const item = {
        userId: recordUserId,  // Simple userId as primary key
        date,
        adAccountId,
        dateAccount,  // This field exists in existing data

        // Meta Ad Metrics (exact same fields as existing data)
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

        // Timestamps (exact same format as existing data)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),

        // Source
        source: 'meta_api'
      };

      console.log(`   ✅ Creating Meta insight for ${date} (${adAccountId})`);

      const command = new PutCommand({
        TableName: META_INSIGHTS_TABLE,
        Item: item
      });

      await dynamoDB.send(command);

    } catch (error) {
      console.error(`Error saving Meta insight for ${date}:`, error.message);
      console.error(`Full error:`, error);
      // Don't throw - continue with other insights
    }
  }


  /**
   * 🚀 HYBRID SYNC: The "Best" Approach
   * 1. Updates UI immediately with 30-day snapshot.
   * 2. Triggers heavy bulk export in background.
   */
  async startHybridSync(userId, accountId, accessToken) {
    console.log(`\n🚀 Starting Hybrid Sync for Account: ${accountId}`);

    try {
      // Step 1: Instant Gratification (Last 30 Days)
      // This ensures the user sees charts IMMEDIATELY.
      console.log(`   ⚡ Phase 1: Quick fetch (30 days)...`);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const since = startDate.toISOString().split('T')[0];
      const until = endDate.toISOString().split('T')[0];

      // Standard sync fetch (reusing your existing logic but scoped)
      await this.fetchAndStoreStandard(userId, accountId, accessToken, since, until);
      console.log(`   ✅ Quick fetch complete.`);

      // Step 2: The Heavy Lifting (Async Report for 1 Year)
      console.log(`   🏗️ Phase 2: Starting Async Bulk Export (1 Year)...`);
      await this.triggerAsyncBulkExport(userId, accountId, accessToken);

    } catch (error) {
      console.error(`❌ Hybrid Sync Error:`, error.message);
    }
  }

  /**
   * Standard synchronous fetch for small date ranges (Phase 1)
   */
  async fetchAndStoreStandard(userId, accountId, accessToken, since, until) {
    const response = await axios.get(
      `https://graph.facebook.com/${FB_API_VERSION}/${accountId}/insights`,
      {
        params: {
          access_token: accessToken,
          level: 'account',
          time_range: JSON.stringify({ since, until }),
          time_increment: 1,
          fields: 'date_start,date_stop,spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,actions,action_values',
          limit: 100
        }
      }
    );

    const insights = response.data.data || [];
    const numericAccountId = accountId.replace('act_', '');

    for (const item of insights) {
      await this.saveInsightData(userId, numericAccountId, item);
    }
  }

  /**
   * Phase 2: Async Reporting API (The "Gold Standard")
   */
  async triggerAsyncBulkExport(userId, accountId, accessToken) {
    // 1 Year Lookback
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    const since = startDate.toISOString().split('T')[0];
    const until = endDate.toISOString().split('T')[0];

    // 1. Trigger the Report
    console.log(`   📡 Requesting Async Report...`);
    const response = await axios.post(
      `https://graph.facebook.com/${FB_API_VERSION}/${accountId}/insights`,
      null,
      {
        params: {
          access_token: accessToken,
          level: 'account', // Can change to 'ad' or 'campaign' for granular data
          time_range: JSON.stringify({ since, until }),
          time_increment: 1,
          fields: 'date_start,date_stop,spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,actions,action_values',
          is_async_export: true // <--- THE MAGIC FLAG
        }
      }
    );

    const reportRunId = response.data.report_run_id;
    console.log(`   🆔 Report Job ID: ${reportRunId}`);

    // 2. Poll for Completion
    this.pollAsyncReport(userId, accountId, reportRunId, accessToken);
  }

  /**
   * Polls the Async Report Job until complete
   */
  async pollAsyncReport(userId, accountId, reportRunId, accessToken) {
    const MAX_RETRIES = 120; // 10 minutes (5s interval)
    let attempts = 0;

    const numericAccountId = accountId.replace('act_', '');

    const poller = setInterval(async () => {
      attempts++;
      try {
        const response = await axios.get(
          `https://graph.facebook.com/${FB_API_VERSION}/${reportRunId}`,
          { params: { access_token: accessToken } }
        );

        const status = response.data.async_status; // "Job Completed", "Job Failed", "Job Started"
        const percent = response.data.async_percent_completion;

        console.log(`   ⏳ Report Status: ${status} (${percent}%)`);

        if (status === 'Job Completed') {
          clearInterval(poller);
          console.log(`   ✅ Report Ready! Downloading...`);

          // Meta returns a pagination ID for the finished report usually, or we query the insights edge again with the ID? 
          // Actually simplified: When async is done, we fetch the results from the report_run_id/insights edge

          await this.processAsyncResults(userId, numericAccountId, reportRunId, accessToken);
        } else if (status === 'Job Failed' || status === 'Job Skipped') {
          clearInterval(poller);
          console.error(`   ❌ Report Failed`);
        } else if (attempts >= MAX_RETRIES) {
          clearInterval(poller);
          console.error(`   ❌ Report Polling Timed Out`);
        }

      } catch (e) {
        console.error(`Error polling: ${e.message}`);
      }
    }, 5000);
  }

  async processAsyncResults(userId, numericAccountId, reportRunId, accessToken) {
    // Page through the results map
    let nextUrl = `https://graph.facebook.com/${FB_API_VERSION}/${reportRunId}/insights?access_token=${accessToken}&limit=500`;

    let total = 0;
    while (nextUrl) {
      const res = await axios.get(nextUrl);
      const data = res.data.data || [];

      // Batch Save
      await Promise.all(data.map(item => this.saveInsightData(userId, numericAccountId, item)));
      total += data.length;

      nextUrl = res.data.paging?.next;
    }
    console.log(`   🎉 Async Bulk Sync Complete. Processed ${total} records.`);
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
