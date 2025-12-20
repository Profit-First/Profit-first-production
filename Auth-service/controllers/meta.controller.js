/**
 * Meta/Facebook Ads Controller
 * Handles Facebook OAuth and ad account connection
 */

const axios = require('axios');
const crypto = require('crypto');
const { PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');
const metaSyncService = require('../services/meta-sync.service');

const META_CONNECTIONS_TABLE = process.env.META_CONNECTIONS_TABLE || 'meta_connections';
const FB_APP_ID = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;
const FB_REDIRECT_URI = process.env.FB_REDIRECT_URI;
const FB_API_VERSION = 'v23.0';

class MetaController {
  /**
   * Initiate Meta OAuth Flow
   * @route POST /api/meta/connect
   * @access Protected
   */
  async initiateOAuth(req, res) {
    try {
      const userId = req.user.userId;

      console.log(`\n🔗 Initiating Meta OAuth for user: ${userId}`);

      // Generate CSRF token
      const state = crypto.randomBytes(16).toString('hex');

      // Store state in session for verification
      global.metaOAuthSessions = global.metaOAuthSessions || {};
      global.metaOAuthSessions[state] = {
        userId,
        timestamp: Date.now()
      };

      // Build OAuth URL with required scopes
      const scopes = [
        'public_profile',
        'email',
        'ads_read',
        'ads_management',
        'business_management'
      ].join(',');

      const authUrl = `https://www.facebook.com/${FB_API_VERSION}/dialog/oauth?` +
        `client_id=${FB_APP_ID}&` +
        `redirect_uri=${encodeURIComponent(FB_REDIRECT_URI)}&` +
        `state=${state}&` +
        `scope=${encodeURIComponent(scopes)}`;

      console.log(`✅ OAuth URL generated`);

      res.json({
        success: true,
        authUrl,
        message: 'Redirect user to Facebook OAuth'
      });
    } catch (error) {
      console.error('❌ Meta OAuth initiation error:', error);
      res.status(500).json({ 
        error: 'Failed to initiate OAuth', 
        message: error.message 
      });
    }
  }

  /**
   * Handle OAuth Callback
   * @route GET /api/meta/callback
   * @access Public
   */
  async handleCallback(req, res) {
    try {
      const { code, state, error, error_description } = req.query;

      console.log(`\n📥 Meta OAuth callback received`);

      // Check for OAuth errors
      if (error) {
        console.error(`❌ OAuth error: ${error} - ${error_description}`);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/onboarding?meta=error&message=${encodeURIComponent(error_description || error)}`);
      }

      // Validate state
      global.metaOAuthSessions = global.metaOAuthSessions || {};
      const session = global.metaOAuthSessions[state];

      if (!session) {
        console.error('❌ Invalid or expired state');
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/onboarding?meta=error&message=Invalid session`);
      }

      const { userId } = session;
      console.log(`   User ID: ${userId}`);

      // Exchange code for access token
      console.log(`🔄 Exchanging code for access token...`);
      const tokenResponse = await axios.get(
        `https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token`,
        {
          params: {
            client_id: FB_APP_ID,
            redirect_uri: FB_REDIRECT_URI,
            client_secret: FB_APP_SECRET,
            code
          }
        }
      );

      const shortLivedToken = tokenResponse.data.access_token;
      console.log(`✅ Short-lived token obtained`);

      // Exchange for long-lived token
      console.log(`🔄 Exchanging for long-lived token...`);
      const longLivedResponse = await axios.get(
        `https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: FB_APP_ID,
            client_secret: FB_APP_SECRET,
            fb_exchange_token: shortLivedToken
          }
        }
      );

      const accessToken = longLivedResponse.data.access_token;
      const expiresIn = longLivedResponse.data.expires_in;
      console.log(`✅ Long-lived token obtained (expires in ${expiresIn}s)`);

      // Get user profile
      const profileResponse = await axios.get(
        `https://graph.facebook.com/${FB_API_VERSION}/me`,
        {
          params: {
            access_token: accessToken,
            fields: 'id,name,email'
          }
        }
      );

      const profile = profileResponse.data;
      console.log(`✅ User profile: ${profile.name} (${profile.email})`);

      // Get ad accounts
      const adAccountsResponse = await axios.get(
        `https://graph.facebook.com/${FB_API_VERSION}/me/adaccounts`,
        {
          params: {
            access_token: accessToken,
            fields: 'id,account_id,name,currency'
          }
        }
      );

      const adAccounts = adAccountsResponse.data.data || [];
      console.log(`✅ Found ${adAccounts.length} ad account(s)`);

      // Save connection to database
      await saveConnection(userId, accessToken, profile, adAccounts, expiresIn);

      // Clean up session
      delete global.metaOAuthSessions[state];

      console.log(`✅ Meta connection saved successfully\n`);

      // Redirect to frontend
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/onboarding?meta=connected&accounts=${adAccounts.length}`);

    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/onboarding?meta=error&message=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * Get Meta Connection Status
   * @route GET /api/meta/connection
   * @access Protected
   */
  async getConnection(req, res) {
    try {
      const userId = req.user.userId;

      const command = new GetCommand({
        TableName: META_CONNECTIONS_TABLE,
        Key: { userId }
      });

      const result = await dynamoDB.send(command);

      if (!result.Item) {
        return res.status(404).json({ 
          connected: false,
          message: 'No Meta connection found' 
        });
      }

      // Don't expose access token
      const { accessToken, ...safeConnection } = result.Item;

      res.json({
        connected: true,
        connection: safeConnection
      });
    } catch (error) {
      console.error('Get Meta connection error:', error);
      res.status(500).json({ error: 'Failed to get connection' });
    }
  }

  /**
   * Update selected ad account
   * @route POST /api/meta/select-account
   * @access Protected
   */
  async selectAdAccount(req, res) {
    try {
      const userId = req.user.userId;
      const { adAccountId } = req.body;

      console.log(`\n💾 Selecting ad account for user: ${userId}`);
      console.log(`   Ad Account ID: ${adAccountId}`);

      if (!adAccountId) {
        return res.status(400).json({ 
          error: 'Ad account ID is required' 
        });
      }

      // Get existing connection
      const getCommand = new GetCommand({
        TableName: META_CONNECTIONS_TABLE,
        Key: { userId }
      });

      const result = await dynamoDB.send(getCommand);

      if (!result.Item) {
        return res.status(404).json({ 
          error: 'No Meta connection found. Please connect first.' 
        });
      }

      const connection = result.Item;

      // Verify ad account exists in user's accounts
      const selectedAccount = connection.adAccounts.find(
        acc => acc.accountId === adAccountId || acc.id === `act_${adAccountId}`
      );

      if (!selectedAccount) {
        return res.status(400).json({ 
          error: 'Invalid ad account ID. Account not found in your connected accounts.' 
        });
      }

      // Update connection with selected account
      const updateCommand = new PutCommand({
        TableName: META_CONNECTIONS_TABLE,
        Item: {
          ...connection,
          selectedAdAccountId: adAccountId,
          selectedAdAccount: selectedAccount,
          updatedAt: new Date().toISOString()
        }
      });

      await dynamoDB.send(updateCommand);

      console.log(`✅ Ad account selected successfully`);

      // Fetch 3 months of insights data for the selected ad account
      console.log(`📊 Fetching 3 months of insights data...`);
      await metaSyncService.fetch3MonthsData(userId);

      console.log(`✅ Meta setup completed\n`);

      res.json({
        success: true,
        message: 'Ad account selected successfully',
        selectedAccount
      });
    } catch (error) {
      console.error('❌ Select ad account error:', error);
      res.status(500).json({ 
        error: 'Failed to select ad account',
        message: error.message 
      });
    }
  }

  /**
   * Manually sync 3 months data for existing connection
   * @route POST /api/meta/sync-data
   * @access Protected
   */
  async syncData(req, res) {
    try {
      const userId = req.user.userId;

      console.log(`\n🔄 Manual data sync initiated for user: ${userId}`);

      // Get connection from database
      const command = new GetCommand({
        TableName: META_CONNECTIONS_TABLE,
        Key: { userId }
      });

      const result = await dynamoDB.send(command);

      if (!result.Item) {
        return res.status(404).json({ 
          error: 'No Meta connection found. Please add Meta credentials to database first.' 
        });
      }

      const connection = result.Item;
      
      if (!connection.accessToken) {
        return res.status(400).json({ 
          error: 'Access token not found in connection. Please update database with valid accessToken.' 
        });
      }

      if (!connection.adAccounts || connection.adAccounts.length === 0) {
        return res.status(400).json({ 
          error: 'No ad accounts found. Please update database with adAccounts array.' 
        });
      }

      console.log(`   Found ${connection.adAccounts.length} ad account(s)`);
      console.log(`   📊 Fetching 3 months of insights data...`);

      // Use the sync service to fetch 3 months data
      const syncResult = await metaSyncService.fetch3MonthsData(userId);

      res.json({
        success: true,
        message: '3 months of Meta insights data synced successfully',
        ...syncResult
      });

    } catch (error) {
      console.error('❌ Manual sync error:', error);
      res.status(500).json({ 
        error: 'Failed to sync data',
        message: error.message 
      });
    }
  }

  /**
   * Get ad account data with access token
   * @route GET /api/meta/ad-account/:accountId
   * @access Protected
   */
  async getAdAccountData(req, res) {
    try {
      const userId = req.user.userId;
      const { accountId } = req.params;

      console.log(`\n📊 Fetching ad account data for user: ${userId}`);
      console.log(`   Account ID: ${accountId}`);

      // Get connection with access token
      const command = new GetCommand({
        TableName: META_CONNECTIONS_TABLE,
        Key: { userId }
      });

      const result = await dynamoDB.send(command);

      if (!result.Item) {
        return res.status(404).json({ 
          error: 'No Meta connection found' 
        });
      }

      const connection = result.Item;
      const accessToken = connection.accessToken;

      // Fetch ad account insights from Facebook API
      const adAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
      
      const insightsResponse = await axios.get(
        `https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/insights`,
        {
          params: {
            access_token: accessToken,
            fields: 'spend,impressions,clicks,cpc,cpm,ctr,reach',
            time_range: JSON.stringify({
              since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              until: new Date().toISOString().split('T')[0]
            })
          }
        }
      );

      const insights = insightsResponse.data.data[0] || {};

      console.log(`✅ Ad account data fetched successfully\n`);

      res.json({
        success: true,
        accountId,
        insights,
        currency: connection.selectedAdAccount?.currency || 'USD'
      });
    } catch (error) {
      console.error('❌ Get ad account data error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch ad account data',
        message: error.message 
      });
    }
  }

}

/**
 * Save Meta connection to database (standalone function)
 */
async function saveConnection(userId, accessToken, profile, adAccounts, expiresIn) {
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const command = new PutCommand({
    TableName: META_CONNECTIONS_TABLE,
    Item: {
      userId,
      accessToken,
      facebookId: profile.id,
      name: profile.name,
      email: profile.email,
      adAccounts: adAccounts.map(acc => ({
        id: acc.id,
        accountId: acc.account_id,
        name: acc.name,
        currency: acc.currency
      })),
      status: 'active',
      connectedAt: new Date().toISOString(),
      expiresAt,
      apiVersion: FB_API_VERSION
    }
  });

  await dynamoDB.send(command);
}

module.exports = new MetaController();
