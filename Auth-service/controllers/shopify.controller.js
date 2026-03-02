/**
 * Shopify Controller
 * 
 * Handles Shopify connection via external OAuth service
 * Uses https://www.profitfirst.co.in/connect for OAuth flow
 */

const axios = require('axios');
const { PutCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');

const CONNECTIONS_TABLE = process.env.SHOPIFY_CONNECTIONS_TABLE || 'shopify_connections';
const SHOPIFY_API_VERSION = '2024-10';
const EXTERNAL_OAUTH_URL = 'https://www.profitfirst.co.in/connect';

class ShopifyController {
  /**
   * Initiate Shopify Connection via External OAuth Service
   * 
   * @route POST /api/shopify/connect
   * @access Protected
   */
  async initiateOAuth(req, res) {
    try {
      const { storeUrl } = req.body;
      const userId = req.user.userId;

      if (!storeUrl) {
        return res.status(400).json({
          error: 'Store URL is required',
          message: 'Please enter your Shopify store URL'
        });
      }

      // Validate and format store URL
      let shopUrl = storeUrl.trim().toLowerCase();
      if (!shopUrl.endsWith('.myshopify.com')) {
        if (!shopUrl.includes('.')) {
          shopUrl = `${shopUrl}.myshopify.com`;
        } else {
          return res.status(400).json({
            error: 'Invalid store URL',
            message: 'Store URL must be in format: storename.myshopify.com'
          });
        }
      }

      console.log(`\n🔗 Initiating Shopify connection for user: ${userId}`);
      console.log(`   Store: ${shopUrl}`);

      // Store pending connection info (for callback verification)
      global.shopifyPendingConnections = global.shopifyPendingConnections || {};
      global.shopifyPendingConnections[userId] = {
        shopUrl,
        timestamp: Date.now()
      };

      // Build external OAuth service URL with callback
      const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/shopify/callback`;
      const authUrl = `${EXTERNAL_OAUTH_URL}?shop=${encodeURIComponent(shopUrl)}&userId=${userId}&callbackUrl=${encodeURIComponent(callbackUrl)}`;

      console.log(`✅ Redirect URL generated`);
      console.log(`   Callback URL: ${callbackUrl}`);

      res.json({
        success: true,
        authUrl,
        shopUrl,
        message: 'Redirect user to external OAuth service'
      });
    } catch (error) {
      console.error('❌ Connection initiation error:', error);
      res.status(500).json({
        error: 'Failed to initiate connection',
        message: error.message
      });
    }
  }

  /**
   * Handle Callback from External OAuth Service
   * Receives access token from external service after successful OAuth
   * 
   * @route POST /api/shopify/callback
   * @access Public (called by external service)
   */
  async handleCallback(req, res) {
    try {
      // Get access token from header
      const accessToken = req.headers['x-shopify-access-token'];

      // Get userId from JWT (preferred) or body (fallback)
      const userId = req.user?.userId || req.body.userId;

      // Get other data from body
      const { shopUrl, storeName, storeEmail, storeDomain } = req.body;

      console.log(`\n📥 Shopify callback received`);
      console.log(`   🔐 JWT Auth: ${req.user ? 'Present' : 'Missing'}`);
      console.log(`   👤 User ID (from ${req.user?.userId ? 'JWT' : 'body'}): ${userId}`);
      console.log(`   🏪 Shop: ${shopUrl}`);
      console.log(`   🔑 Access Token present: ${!!accessToken}`);
      if (accessToken) {
        console.log(`   🔑 Token preview: ${accessToken.substring(0, 20)}...`);
      }
      console.log(`   📦 Body keys: ${Object.keys(req.body).join(', ')}`);
      console.log(`   📋 Headers: Authorization=${!!req.headers.authorization}, X-Shopify-Access-Token=${!!req.headers['x-shopify-access-token']}`);

      // Validate required parameters
      if (!userId || !shopUrl || !accessToken) {
        console.error(`❌ Missing required parameters:`, {
          userId: !!userId,
          shopUrl: !!shopUrl,
          accessToken: !!accessToken,
          jwtPresent: !!req.user,
          bodyUserId: !!req.body.userId
        });
        return res.status(400).json({
          error: 'Missing required parameters',
          message: 'userId, shopUrl and accessToken (in header X-Shopify-Access-Token) are required',
          received: {
            userId: !!userId,
            shopUrl: !!shopUrl,
            accessToken: !!accessToken,
            jwtAuth: !!req.user
          }
        });
      }

      // Verify this connection was initiated by us
      global.shopifyPendingConnections = global.shopifyPendingConnections || {};
      const pendingConnection = global.shopifyPendingConnections[userId];

      if (!pendingConnection) {
        console.warn(`⚠️  No pending connection found for user: ${userId}`);
        // Still allow it, but log warning
      } else if (pendingConnection.shopUrl !== shopUrl) {
        console.warn(`⚠️  Shop URL mismatch for user: ${userId}`);
        console.warn(`   Expected: ${pendingConnection.shopUrl}`);
        console.warn(`   Received: ${shopUrl}`);
      }

      // Verify the access token by making a test API call
      let storeInfo = {
        name: storeName || shopUrl.split('.')[0],
        email: storeEmail || '',
        domain: storeDomain || shopUrl,
        currency: 'USD',
        timezone: '',
        plan: ''
      };

      try {
        console.log(`🔍 Verifying access token with Shopify API...`);
        const response = await axios.get(
          `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
          {
            headers: {
              'X-Shopify-Access-Token': accessToken
            },
            timeout: 5000 // 5 second timeout
          }
        );

        const shopData = response.data.shop;
        storeInfo = {
          name: shopData.name,
          email: shopData.email,
          domain: shopData.domain,
          currency: shopData.currency,
          timezone: shopData.timezone,
          plan: shopData.plan_name
        };

        console.log(`✅ Access token verified successfully`);
        console.log(`   Store Name: ${storeInfo.name}`);
        console.log(`   Store Email: ${storeInfo.email}`);
      } catch (error) {
        console.error('❌ Token verification FAILED:', error.message);
        if (error.response) {
          console.error(`   Status: ${error.response.status}`);
          console.error(`   Error: ${JSON.stringify(error.response.data)}`);
        }

        // CRITICAL: If token verification fails, don't save the connection
        return res.status(401).json({
          error: 'Invalid access token',
          message: 'The access token provided is invalid or expired. Please try connecting again.',
          details: error.response?.data || error.message
        });
      }

      // Save connection to database
      console.log(`💾 Saving connection to database...`);
      console.log(`   🔑 Full Access Token Length: ${accessToken.length} characters`);
      console.log(`   🔑 Access Token: ${accessToken}`);

      const command = new PutCommand({
        TableName: CONNECTIONS_TABLE,
        Item: {
          userId,
          shopUrl,
          accessToken,
          storeName: storeInfo.name,
          storeEmail: storeInfo.email,
          storeDomain: storeInfo.domain,
          currency: storeInfo.currency,
          timezone: storeInfo.timezone,
          plan: storeInfo.plan,
          status: 'active',
          connectedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          apiVersion: SHOPIFY_API_VERSION,
          scopes: 'read_products,read_orders,read_customers,read_inventory'
        }
      });

      await dynamoDB.send(command);

      // Verify what was saved by reading it back
      console.log(`🔍 Verifying saved token...`);
      const verifyCommand = new GetCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { userId }
      });
      const verifyResult = await dynamoDB.send(verifyCommand);
      console.log(`   ✅ Token in DB Length: ${verifyResult.Item?.accessToken?.length || 0} characters`);
      console.log(`   ✅ Token in DB: ${verifyResult.Item?.accessToken || 'NOT FOUND'}`);
      console.log(`   ✅ Tokens Match: ${verifyResult.Item?.accessToken === accessToken}`);

      // Clean up pending connection
      if (pendingConnection) {
        delete global.shopifyPendingConnections[userId];
      }

      console.log(`✅ Shopify connection saved successfully to DynamoDB`);
      console.log(`   Table: shopify_connections`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Shop URL: ${shopUrl}`);
      console.log(`   🔑 Access Token: ${accessToken.substring(0, 20)}...`);
      console.log(`   Status: active\n`);

      res.json({
        success: true,
        message: 'Shopify store connected successfully',
        connection: {
          userId,
          shopUrl,
          storeName: storeInfo.name,
          storeEmail: storeInfo.email,
          storeDomain: storeInfo.domain,
          connectedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Callback error:', error);
      res.status(500).json({
        error: 'Failed to save connection',
        message: error.message
      });
    }
  }

  /**
   * Get Shopify Connection Status
   * 
   * @route GET /api/shopify/connection
   * @access Protected
   */
  async getConnection(req, res) {
    try {
      const userId = req.user.userId;
      console.log(`🔍 Checking Shopify connection for user: ${userId}`);

      const command = new GetCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { userId }
      });

      const result = await dynamoDB.send(command);

      if (!result.Item) {
        console.log(`❌ No connection found for user: ${userId}`);
        return res.status(404).json({
          connected: false,
          message: 'No Shopify connection found'
        });
      }

      console.log(`✅ Connection found for user: ${userId}, Shop: ${result.Item.shopUrl}`);

      // Don't expose access token
      const { accessToken, ...safeConnection } = result.Item;

      res.json({
        connected: true,
        connection: safeConnection
      });
    } catch (error) {
      console.error('❌ Get connection error:', error.message);
      console.error('   Stack:', error.stack);
      res.status(500).json({ error: 'Failed to get connection' });
    }
  }

  /**
   * Disconnect Shopify Store
   * 
   * @route DELETE /api/shopify/connection
   * @access Protected
   */
  async disconnect(req, res) {
    try {
      const userId = req.user.userId;

      const command = new UpdateCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { userId },
        UpdateExpression: 'SET #status = :status, disconnectedAt = :timestamp',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'disconnected',
          ':timestamp': new Date().toISOString()
        }
      });

      await dynamoDB.send(command);

      console.log(`🔌 Shopify disconnected for user: ${userId}`);

      res.json({
        success: true,
        message: 'Shopify store disconnected successfully'
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      res.status(500).json({ error: 'Failed to disconnect store' });
    }
  }

  /**
   * Get Abandoned Cart Checkouts
   * 
   * @route GET /api/shopify/abandoned-carts
   * @access Protected
   */
  async getAbandonedCarts(req, res) {
    try {
      const userId = req.user.userId;
      console.log(`🛒 Fetching abandoned carts for user: ${userId}`);

      // Get Shopify connection
      const command = new GetCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { userId }
      });

      const result = await dynamoDB.send(command);

      if (!result.Item || result.Item.status !== 'active') {
        return res.status(404).json({
          error: 'No active Shopify connection found',
          message: 'Please connect your Shopify store first'
        });
      }

      const { shopUrl, accessToken } = result.Item;
      console.log(`🔗 Using connection: ${shopUrl}`);

      // Fetch ALL abandoned checkouts from Shopify with pagination
      let allCheckouts = [];
      let sinceId = 0;
      let hasMore = true;
      let page = 1;

      console.log(`🛒 Fetching abandoned carts (pagination enabled)...`);

      while (hasMore) {
        console.log(`   📄 Fetching page ${page}...`);

        try {
          const response = await axios.get(
            `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/checkouts.json`,
            {
              headers: {
                'X-Shopify-Access-Token': accessToken
              },
              params: {
                status: 'open',
                limit: 250,
                since_id: sinceId
              },
              timeout: 20000
            }
          );

          const checkouts = response.data.checkouts || [];
          allCheckouts = allCheckouts.concat(checkouts);

          console.log(`   ✅ Received ${checkouts.length} checkouts`);

          if (checkouts.length < 250) {
            hasMore = false;
          } else {
            // Use the last ID for the next page
            sinceId = checkouts[checkouts.length - 1].id;
            page++;
            // Small delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (err) {
          console.error(`   ❌ Error fetching page ${page}:`, err.message);
          // If one page fails, we try to return what we have so far
          hasMore = false;
        }
      }

      console.log(`📦 Found ${allCheckouts.length} total abandoned checkouts`);

      // Transform data for frontend
      const abandonedCarts = allCheckouts.map(checkout => ({
        id: checkout.id,
        customerName: checkout.customer ?
          `${checkout.customer.first_name || ''} ${checkout.customer.last_name || ''}`.trim() ||
          checkout.email?.split('@')[0] || 'Unknown Customer' :
          checkout.email?.split('@')[0] || 'Unknown Customer',
        email: checkout.email,
        phone: checkout.customer?.phone || checkout.billing_address?.phone || checkout.shipping_address?.phone || null,
        cartValue: checkout.total_price ? `₹${parseFloat(checkout.total_price).toLocaleString('en-IN')}` : '₹0',
        currency: checkout.currency || 'INR',
        createdAt: checkout.created_at,
        updatedAt: checkout.updated_at,
        abandonedCheckoutUrl: checkout.abandoned_checkout_url,
        lineItems: checkout.line_items?.map(item => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          variant_title: item.variant_title
        })) || [],
        totalItems: checkout.line_items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
        billingAddress: checkout.billing_address,
        shippingAddress: checkout.shipping_address,
        note: checkout.note,
        source: checkout.source_name,
        gateway: checkout.gateway
      }));

      // Sort by most recent first
      abandonedCarts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      console.log(`✅ Returning ${abandonedCarts.length} abandoned carts`);

      res.json({
        success: true,
        abandonedCarts,
        total: abandonedCarts.length,
        metadata: {
          shopUrl,
          fetchedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Get abandoned carts error:', error);

      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Error: ${JSON.stringify(error.response.data)}`);

        if (error.response.status === 401) {
          return res.status(401).json({
            error: 'Shopify authentication failed',
            message: 'Your Shopify connection has expired. Please reconnect your store.'
          });
        }
      }

      res.status(500).json({
        error: 'Failed to fetch abandoned carts',
        message: error.message
      });
    }
  }

  // Helper Methods

  /**
   * Get store information from Shopify
   */
  async getStoreInfo(shop, accessToken) {
    try {
      const response = await axios.get(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken
          }
        }
      );

      const shopData = response.data.shop;

      return {
        name: shopData.name,
        email: shopData.email,
        domain: shopData.domain,
        currency: shopData.currency,
        timezone: shopData.timezone,
        plan: shopData.plan_name
      };
    } catch (error) {
      console.error('Get store info error:', error);
      throw error;
    }
  }

  /**
   * Save Shopify connection to database
   */
  async saveConnection(userId, shopUrl, accessToken, storeInfo) {
    const command = new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        userId,
        shopUrl,
        accessToken,
        storeName: storeInfo.name,
        storeEmail: storeInfo.email,
        storeDomain: storeInfo.domain,
        currency: storeInfo.currency,
        timezone: storeInfo.timezone,
        plan: storeInfo.plan,
        status: 'active',
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        apiVersion: SHOPIFY_API_VERSION,
        scopes: SHOPIFY_SCOPES
      }
    });

    await dynamoDB.send(command);
  }
}

module.exports = new ShopifyController();
