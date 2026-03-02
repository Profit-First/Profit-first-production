/**
 * Onboarding Controller
 * 
 * Handles onboarding-related HTTP requests
 */

const onboardingService = require('../services/onboarding.service');
const shopifyBackgroundSync = require('../services/shopify-background-sync.service');
const { getCache, setCache, deleteCache } = require('../config/redis.config');

class OnboardingController {
  /**
   * Get Current Onboarding Step.
   * Retrieves the current progress of the user's onboarding process.
   *
   * @route GET /api/onboard/step
   * @access Protected
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  async getCurrentStep(req, res) {
    try {
      const userId = req.user.userId;

      const result = await onboardingService.getOnboardingStatus(userId);

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      res.status(200).json({
        step: result.data.currentStep,
        isCompleted: result.data.isCompleted
      });
    } catch (error) {
      console.error('Get current step error:', error);
      res.status(500).json({ error: 'Failed to get onboarding step' });
    }
  }

  /**
   * Update Onboarding Step.
   * Saves the user's progress and data for a specific onboarding step.
   * Ensures data persistence and invalidates cache.
   *
   * @route POST /api/onboard/step
   * @access Protected
   * @param {object} req - Express request (body: { step, data }).
   * @param {object} res - Express response.
   */
  async updateStep(req, res) {
    try {
      const userId = req.user.userId;
      const { step, data } = req.body;

      if (!step || step < 1 || step > 5) {
        return res.status(400).json({ error: 'Invalid step number' });
      }

      const result = await onboardingService.updateOnboardingStep(userId, step, data);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Invalidate onboarding cache when data is updated
      const cacheKey = `onboarding:${userId}`;
      await deleteCache(cacheKey);
      console.log(`🗑️  Cache invalidated: ${cacheKey}`);

      // DON'T trigger sync at Step 2 - prevents 401 errors during onboarding
      // Sync will happen later after user completes onboarding

      res.status(200).json({
        message: 'Onboarding step updated successfully',
        currentStep: result.data.currentStep,
        data: result.data
      });
    } catch (error) {
      console.error('Update step error:', error);
      res.status(500).json({ error: 'Failed to update onboarding step' });
    }
  }

  /**
   * Complete Onboarding.
   * Marks the onboarding process as finished for the user.
   * Invalidates cache to reflect completion status immediately.
   *
   * @route POST /api/onboard/complete
   * @access Protected
   * @param {object} req - Express request.
   * @param {object} res - Express response.
   */
  async completeOnboarding(req, res) {
    try {
      const userId = req.user.userId;
      const { data } = req.body;

      const result = await onboardingService.completeOnboarding(userId, data);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Invalidate onboarding cache when completed
      const cacheKey = `onboarding:${userId}`;
      await deleteCache(cacheKey);
      console.log(`🗑️  Cache invalidated: ${cacheKey}`);

      res.status(200).json({
        message: 'Onboarding completed successfully',
        data: result.data
      });
    } catch (error) {
      console.error('Complete onboarding error:', error);
      res.status(500).json({ error: 'Failed to complete onboarding' });
    }
  }

  /**
   * Get Onboarding Data.
   * Retrieves all data collected during the onboarding process.
   * Uses Redis caching to improve performance for frequent access.
   *
   * @route GET /api/onboard/data
   * @access Protected
   * @param {object} req - Express request.
   * @param {object} res - Express response.
   */
  async getOnboardingData(req, res) {
    try {
      const userId = req.user.userId;
      const cacheKey = `onboarding:${userId}`;

      // Check cache first
      const cachedData = await getCache(cacheKey);
      if (cachedData) {
        console.log(`⚡ Redis cache HIT: ${cacheKey}`);
        return res.status(200).json(cachedData);
      }

      const result = await onboardingService.getOnboardingData(userId);

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      // Cache for 10 minutes (onboarding data doesn't change frequently)
      await setCache(cacheKey, result.data, 600);
      console.log(`💾 Redis cache SET: ${cacheKey}`);

      res.status(200).json(result.data);
    } catch (error) {
      console.error('Get onboarding data error:', error);
      res.status(500).json({ error: 'Failed to get onboarding data' });
    }
  }

  /**
   * Save product costs.
   * Updates manufacturing costs for specific products in DynamoDB.
   * Used when user manually enters Cost of Goods Sold during onboarding.
   *
   * @route POST /api/onboard/modifyprice
   * @access Protected
   * @param {object} req - Express request (body: array of { productId, cost }).
   * @param {object} res - Express response.
   */
  async modifyPrice(req, res) {
    try {
      const userId = req.user.userId;
      const updates = req.body; // Array of { productId, cost }

      console.log(`\n💰 Saving product costs for user: ${userId}`);
      console.log(`   ${updates.length} products to update`);

      // Update product costs in DynamoDB (Parallel Batch Processing)
      const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
      const { dynamoDB } = require('../config/aws.config');
      const productsTable = process.env.SHOPIFY_PRODUCTS_TABLE || 'shopify_products';

      const BATCH_SIZE = 20;
      let processedCount = 0;

      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (update) => {
          console.log(`   Product ${update.productId}: ₹${update.cost}`);

          const command = new UpdateCommand({
            TableName: productsTable,
            Key: {
              userId,
              productId: update.productId.toString()
            },
            UpdateExpression: 'SET manufacturingCost = :cost, costUpdatedAt = :timestamp',
            ExpressionAttributeValues: {
              ':cost': update.cost,
              ':timestamp': new Date().toISOString()
            }
          });

          await dynamoDB.send(command);
        }));

        processedCount += batch.length;
      }

      console.log(`✅ Product costs saved successfully in database\n`);

      res.json({
        success: true,
        message: 'Product costs saved successfully',
        count: updates.length
      });

    } catch (error) {
      console.error('❌ Modify price error:', error.message);
      res.status(500).json({
        error: 'Failed to save product costs',
        message: error.message
      });
    }
  }

  /**
   * Background sync of orders and customers.
   * Triggers the comprehensive background sync service.
   *
   * @route POST /api/onboard/background-sync
   * @access Protected
   * @param {object} req - Express request.
   * @param {object} res - Express response.
   */
  async backgroundSync(req, res) {
    try {
      const userId = req.user.userId;

      console.log(`\n🔄 Starting onboarding background sync for user: ${userId}`);
      console.log(`   📅 Fetching last 3 months of data only`);

      // Send immediate response so user doesn't wait
      res.json({
        success: true,
        message: 'Onboarding background sync started (last 3 months)'
      });

      // Get Shopify connection
      const { GetCommand } = require('@aws-sdk/lib-dynamodb');
      const { dynamoDB } = require('../config/aws.config');

      const command = new GetCommand({
        TableName: process.env.SHOPIFY_CONNECTIONS_TABLE || 'shopify_connections',
        Key: { userId }
      });

      const result = await dynamoDB.send(command);

      if (!result.Item) {
        console.error(`❌ No Shopify connection for onboarding background sync`);
        return;
      }

      const { shopUrl, accessToken } = result.Item;

      console.log(`   ✅ Connection found: ${shopUrl}`);
      console.log(`   🚀 Triggering unified background sync service...`);

      // Use the proper service for full history sync
      // This handles pagination, rate limiting, and status updates correctly
      await shopifyBackgroundSync.startBackgroundSync(userId, shopUrl, accessToken);


    } catch (error) {
      console.error('❌ Onboarding background sync error:', error.message);
      // Don't throw error - this is background process
    }
  }

  /**
   * Fetch products from Shopify.
   * Retrieves products from user's Shopify store and caches them.
   * Used to populate the product selection list for COGS entry.
   *
   * @route GET /api/onboard/fetchproduct
   * @access Protected
   * @param {object} req - Express request.
   * @param {object} res - Express response.
   */
  async fetchProducts(req, res) {
    try {
      const userId = req.user.userId;
      const cacheKey = `products:${userId}`;

      // Check cache first (5 minute TTL for products)
      const cachedProducts = await getCache(cacheKey);
      if (cachedProducts) {
        console.log(`⚡ Redis cache HIT: ${cacheKey} (${cachedProducts.count} products)`);
        return res.json(cachedProducts);
      }

      console.log(`\n📦 Fetching Shopify products for user: ${userId}`);

      // Get Shopify connection from database
      const { GetCommand } = require('@aws-sdk/lib-dynamodb');
      const { dynamoDB } = require('../config/aws.config');

      const command = new GetCommand({
        TableName: process.env.SHOPIFY_CONNECTIONS_TABLE || 'shopify_connections',
        Key: { userId }
      });

      const result = await dynamoDB.send(command);

      if (!result.Item) {
        console.error(`❌ No Shopify connection found for user: ${userId}`);
        return res.status(404).json({
          error: 'No Shopify connection found',
          message: 'Please connect your Shopify store first'
        });
      }

      const { shopUrl, accessToken } = result.Item;
      console.log(`   Shop: ${shopUrl}`);
      console.log(`   Access Token: ${accessToken ? accessToken.substring(0, 20) + '...' : 'MISSING'}`);

      if (!accessToken) {
        console.error(`❌ No access token in connection for user: ${userId}`);
        return res.status(401).json({
          error: 'No access token found',
          message: 'Please reconnect your Shopify store'
        });
      }

      // Fetch products from Shopify
      const axios = require('axios');

      console.log(`   📡 Calling Shopify API: https://${shopUrl}/admin/api/2024-10/products.json`);

      let nextPageUrl = `https://${shopUrl}/admin/api/2024-10/products.json?limit=250`;
      let allProducts = [];
      let pageCount = 0;
      let hasMore = true;

      // DynamoDB helper
      const { PutCommand } = require('@aws-sdk/lib-dynamodb');
      const productsTable = process.env.SHOPIFY_PRODUCTS_TABLE || 'shopify_products';

      while (hasMore) {
        pageCount++;
        console.log(`   📦 Fetching page ${pageCount}...`);

        const response = await axios.get(nextPageUrl, {
          headers: { 'X-Shopify-Access-Token': accessToken },
          timeout: 20000
        });

        const products = response.data.products || [];
        console.log(`   ✅ Received ${products.length} products`);
        allProducts = allProducts.concat(products);

        // Save this batch to DynamoDB in parallel
        if (products.length > 0) {
          console.log(`   💾 Saving batch ${pageCount} to DynamoDB...`);
          const BATCH_SIZE = 25;
          for (let i = 0; i < products.length; i += BATCH_SIZE) {
            const chunk = products.slice(i, i + BATCH_SIZE);
            await Promise.all(chunk.map(product => {
              const productCommand = new PutCommand({
                TableName: productsTable,
                Item: {
                  userId,
                  productId: product.id.toString(),
                  title: product.title,
                  vendor: product.vendor,
                  productType: product.product_type,
                  variants: product.variants,
                  images: product.images,
                  status: product.status,
                  createdAt: product.created_at,
                  updatedAt: product.updated_at,
                  syncedAt: new Date().toISOString()
                }
              });
              return dynamoDB.send(productCommand).catch(err =>
                console.error(`Failed to save product ${product.id}:`, err.message)
              );
            }));
          }
        }

        // Check for next page
        const linkHeader = response.headers.link || response.headers['link'];
        hasMore = false;

        if (linkHeader) {
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextMatch) {
            nextPageUrl = nextMatch[1];
            hasMore = true;
          }
        }

        // Rate limiting (Shopify leaky bucket) - small delay
        if (hasMore) await new Promise(r => setTimeout(r, 500));
      }

      console.log(`✅ Fetched and stored ${allProducts.length} total products`);
      const products = allProducts; // Keep variable name for response consistency

      const responseData = {
        success: true,
        products: products,
        count: products.length
      };

      // Cache for 5 minutes
      await setCache(cacheKey, responseData, 300);
      console.log(`💾 Redis cache SET: ${cacheKey}`);

      res.json(responseData);

    } catch (error) {
      console.error('❌ Fetch products error:', error.message);
      console.error('❌ Error stack:', error.stack);

      // Detailed error logging
      if (error.response) {
        console.error('❌ Shopify API error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });

        return res.status(error.response.status).json({
          error: 'Shopify API error',
          message: error.response.data?.errors || error.message,
          details: error.response.data
        });
      }

      res.status(500).json({
        error: 'Failed to fetch products',
        message: error.message
      });
    }
  }

  /**
   * Proxy to get Shopify access token from external service.
   * Securely exchanges shop parameters for an access token via a proxy.
   *
   * @route GET /api/onboard/proxy/token
   * @access Protected
   * @param {object} req - Express request (query: { shop, password }).
   * @param {object} res - Express response.
   */
  async getProxyToken(req, res) {
    try {
      const { shop, password } = req.query;

      if (!shop || !password) {
        return res.status(400).json({
          error: 'Missing required parameters',
          message: 'shop and password are required'
        });
      }

      console.log(`\n🔗 Fetching Shopify token for shop: ${shop}`);

      // Call external proxy service to get access token
      const axios = require('axios');
      const proxyResponse = await axios.get('https://profitfirst.co.in/token', {
        params: { shop, password }
      });

      if (proxyResponse.data && proxyResponse.data.accessToken) {
        console.log(`✅ Access token received for shop: ${shop}`);

        res.json({
          success: true,
          accessToken: proxyResponse.data.accessToken,
          shop: shop
        });
      } else {
        console.error(`❌ No access token in response for shop: ${shop}`);
        res.status(400).json({
          error: 'Failed to get access token',
          message: 'External service did not return an access token'
        });
      }
    } catch (error) {
      console.error('Proxy token error:', error.message);

      if (error.response) {
        return res.status(error.response.status).json({
          error: 'External service error',
          message: error.response.data?.message || error.message
        });
      }

      res.status(500).json({
        error: 'Failed to fetch token',
        message: error.message
      });
    }
  }

  /**
   * Connect Shipping Platform (Step 5).
   * Verifies credentials and establishes connection with shipping providers (Shiprocket).
   *
   * @route POST /api/onboard/step5
   * @access Protected
   * @param {object} req - Express request (body: credentials).
   * @param {object} res - Express response.
   */
  async connectShipping(req, res) {
    try {
      const userId = req.user.userId;
      const { platform, email, password, access_token, secret_key } = req.body;

      console.log(`\n🚚 Step 5: Connecting ${platform} for user: ${userId}`);

      // Call shipping controller directly to reuse logic
      const shippingController = require('./shipping.controller');

      // Create a mock request object
      const mockReq = {
        user: { userId },
        body: { platform, email, password, access_token, secret_key }
      };

      // Create a robust mock response object that captures the result
      const mockRes = {
        statusCode: 200,
        responseData: null,
        status: function (code) {
          this.statusCode = code;
          return this;
        },
        json: function (data) {
          this.responseData = data;
          return this;
        }
      };

      // Call the controller method
      // We await it assuming it returns a Promise (standard for async controllers)
      await shippingController.connectPlatform(mockReq, mockRes);

      // Check the result captured in mockRes
      if (mockRes.statusCode >= 400 || !mockRes.responseData?.success) {
        throw new Error(mockRes.responseData?.message || mockRes.responseData?.error || 'Connection failed');
      }

      console.log(`✅ ${platform} connected successfully via Onboarding Step 5`);

      res.json({
        success: true,
        message: `${platform} connected successfully`,
        platform: mockRes.responseData.platform || platform,
        data: mockRes.responseData
      });

    } catch (error) {
      console.error('❌ Step 5 shipping connection error:', error.message);
      res.status(500).json({
        error: 'Failed to connect shipping platform',
        message: error.message
      });
    }
  }

  /**
   * Manual Sync - Trigger background sync.
   * Allows user to manually restart the data synchronization process.
   *
   * @route POST /api/onboard/manual-sync
   * @access Protected
   * @param {object} req - Express request.
   * @param {object} res - Express response.
   */
  async manualSync(req, res) {
    try {
      const userId = req.user.userId;

      console.log(`\n🔄 Manual sync triggered for user: ${userId}`);

      // Check if sync is already in progress
      const currentStatus = await shopifyBackgroundSync.getSyncStatus(userId);
      if (currentStatus && currentStatus.status === 'in_progress') {
        return res.json({
          success: true,
          message: 'Sync already in progress',
          status: currentStatus
        });
      }

      // Get Shopify connection
      const { GetCommand } = require('@aws-sdk/lib-dynamodb');
      const { dynamoDB } = require('../config/aws.config');

      const command = new GetCommand({
        TableName: process.env.SHOPIFY_CONNECTIONS_TABLE || 'shopify_connections',
        Key: { userId }
      });

      const result = await dynamoDB.send(command);

      if (!result.Item || !result.Item.accessToken) {
        return res.status(404).json({
          success: false,
          error: 'No Shopify connection found'
        });
      }

      const { shopUrl, accessToken } = result.Item;

      // Start background sync
      await shopifyBackgroundSync.startBackgroundSync(userId, shopUrl, accessToken);

      // Return immediately with initial status
      res.json({
        success: true,
        message: 'Manual sync started',
        status: {
          status: 'starting',
          stage: 'initializing',
          message: 'Starting manual sync...'
        }
      });

    } catch (error) {
      console.error('Manual sync error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start sync',
        message: error.message
      });
    }
  }

  /**
   * Get Sync Status - Check progress of ongoing sync.
   * Returns real-time status details (processed orders, current stage).
   *
   * @route GET /api/onboard/sync-status
   * @access Protected
   * @param {object} req - Express request.
   * @param {object} res - Express response.
   */
  async getSyncStatus(req, res) {
    try {
      const userId = req.user.userId;

      const status = await shopifyBackgroundSync.getSyncStatus(userId);

      if (!status) {
        return res.json({
          success: true,
          status: {
            status: 'idle',
            message: 'No sync in progress'
          }
        });
      }

      res.json({
        success: true,
        status
      });

    } catch (error) {
      console.error('Get sync status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get sync status',
        message: error.message
      });
    }
  }

  /**
   * Check if Shopify data sync is complete.
   * Returns simple boolean status for frontend checks.
   *
   * @route GET /api/onboard/data-ready
   * @access Protected
   * @param {object} req - Express request.
   * @param {object} res - Express response.
   */
  async isDataReady(req, res) {
    try {
      const userId = req.user.userId;

      // Check if data sync is complete
      const isReady = await shopifyBackgroundSync.isDataSynced(userId);

      if (isReady) {
        res.json({
          success: true,
          dataReady: true,
          message: 'Your Shopify data is ready!'
        });
      } else {
        // Get current sync status for progress info
        const syncStatus = await shopifyBackgroundSync.getSyncStatus(userId);

        res.json({
          success: true,
          dataReady: false,
          message: 'We are still syncing your Shopify data. Please wait...',
          syncStatus: syncStatus || {
            status: 'pending',
            message: 'Data sync will start shortly'
          }
        });
      }

    } catch (error) {
      console.error('Check data ready error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check data status',
        message: error.message
      });
    }
  }
}

module.exports = new OnboardingController();
