/**
 * Onboarding Controller
 * 
 * Handles onboarding-related HTTP requests
 */

const onboardingService = require('../services/onboarding.service');
const shopifySyncService = require('../services/shopify-sync.service');
const { getCache, setCache, deleteCache } = require('../config/redis.config');

class OnboardingController {
  /**
   * Get Current Onboarding Step
   * 
   * @route GET /api/onboard/step
   * @access Protected
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
   * Update Onboarding Step
   * 
   * @route POST /api/onboard/step
   * @access Protected
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

      // Trigger initial Shopify sync after Step 3 (product costs completed)
      if (step === 3 && data.storeUrl && data.accessToken) {
        console.log(`\n🚀 Step 3 completed - Triggering initial Shopify sync...`);
        
        // Run sync in background (don't wait for it)
        shopifySyncService.initialSync(userId, data.storeUrl, data.accessToken)
          .then(syncResult => {
            if (syncResult.success) {
              console.log(`✅ Initial sync completed for user: ${userId}`);
            } else {
              console.error(`❌ Initial sync failed for user: ${userId}`, syncResult.error);
            }
          })
          .catch(error => {
            console.error(`❌ Initial sync error for user: ${userId}`, error.message);
          });
      }

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
   * Complete Onboarding
   * 
   * @route POST /api/onboard/complete
   * @access Protected
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
   * Get Onboarding Data
   * 
   * @route GET /api/onboard/data
   * @access Protected
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
   * Save product costs
   * 
   * @route POST /api/onboard/modifyprice
   * @access Protected
   */
  async modifyPrice(req, res) {
    try {
      const userId = req.user.userId;
      const updates = req.body; // Array of { productId, cost }

      console.log(`\n💰 Saving product costs for user: ${userId}`);
      console.log(`   ${updates.length} products to update`);

      // Update product costs in DynamoDB
      const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
      const { dynamoDB } = require('../config/aws.config');
      const productsTable = process.env.SHOPIFY_PRODUCTS_TABLE || 'shopify_products';

      for (const update of updates) {
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
   * Background sync of orders and customers (last 3 months)
   * 
   * @route POST /api/onboard/background-sync
   * @access Protected
   */
  async backgroundSync(req, res) {
    try {
      const userId = req.user.userId;
      
      console.log(`\n🔄 Starting background sync for user: ${userId}`);
      
      // Send immediate response so user doesn't wait
      res.json({
        success: true,
        message: 'Background sync started'
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
        console.error(`❌ No Shopify connection for background sync`);
        return;
      }

      const { shopUrl, accessToken } = result.Item;
      
      // Calculate date 3 months ago
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const createdAtMin = threeMonthsAgo.toISOString();

      console.log(`   Syncing data from: ${createdAtMin}`);

      // Sync orders and customers in background
      const axios = require('axios');
      
      // Fetch orders
      console.log(`📦 Fetching orders...`);
      const ordersResponse = await axios.get(
        `https://${shopUrl}/admin/api/2023-10/orders.json`,
        {
          headers: { 'X-Shopify-Access-Token': accessToken },
          params: { 
            limit: 250,
            created_at_min: createdAtMin,
            status: 'any'
          }
        }
      );

      // Fetch customers
      console.log(`👥 Fetching customers...`);
      const customersResponse = await axios.get(
        `https://${shopUrl}/admin/api/2023-10/customers.json`,
        {
          headers: { 'X-Shopify-Access-Token': accessToken },
          params: { 
            limit: 250,
            created_at_min: createdAtMin
          }
        }
      );

      const orders = ordersResponse.data.orders || [];
      const customers = customersResponse.data.customers || [];

      console.log(`✅ Fetched ${orders.length} orders and ${customers.length} customers`);

      // Store orders in DynamoDB
      const { PutCommand } = require('@aws-sdk/lib-dynamodb');
      const ordersTable = process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders';
      const customersTable = process.env.SHOPIFY_CUSTOMERS_TABLE || 'shopify_customers';

      console.log(`💾 Storing orders in ${ordersTable}...`);
      for (const order of orders) {
        const orderCommand = new PutCommand({
          TableName: ordersTable,
          Item: {
            userId,
            orderId: order.id.toString(),
            orderNumber: order.order_number,
            email: order.email,
            totalPrice: order.total_price,
            currency: order.currency,
            financialStatus: order.financial_status,
            fulfillmentStatus: order.fulfillment_status,
            createdAt: order.created_at,
            lineItems: order.line_items,
            customer: order.customer,
            shippingAddress: order.shipping_address,
            syncedAt: new Date().toISOString()
          }
        });
        await dynamoDB.send(orderCommand);
      }

      console.log(`💾 Storing customers in ${customersTable}...`);
      for (const customer of customers) {
        const customerCommand = new PutCommand({
          TableName: customersTable,
          Item: {
            userId,
            customerId: customer.id.toString(),
            email: customer.email,
            firstName: customer.first_name,
            lastName: customer.last_name,
            ordersCount: customer.orders_count,
            totalSpent: customer.total_spent,
            createdAt: customer.created_at,
            updatedAt: customer.updated_at,
            syncedAt: new Date().toISOString()
          }
        });
        await dynamoDB.send(customerCommand);
      }

      console.log(`✅ Stored ${orders.length} orders and ${customers.length} customers`);
      console.log(`✅ Background sync completed for user: ${userId}\n`);

    } catch (error) {
      console.error('❌ Background sync error:', error.message);
      // Don't throw error - this is background process
    }
  }

  /**
   * Fetch products from Shopify
   * 
   * @route GET /api/onboard/fetchproduct
   * @access Protected
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

      // Fetch products from Shopify
      const axios = require('axios');
      const response = await axios.get(
        `https://${shopUrl}/admin/api/2023-10/products.json`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken
          },
          params: {
            limit: 250 // Max products per request
          }
        }
      );

      const products = response.data.products || [];
      console.log(`✅ Fetched ${products.length} products from Shopify`);

      // Store products in DynamoDB
      const { PutCommand } = require('@aws-sdk/lib-dynamodb');
      const productsTable = process.env.SHOPIFY_PRODUCTS_TABLE || 'shopify_products';

      console.log(`💾 Storing products in ${productsTable}...`);
      for (const product of products) {
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
        await dynamoDB.send(productCommand);
      }

      console.log(`✅ Stored ${products.length} products in database`);

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
      res.status(500).json({ 
        error: 'Failed to fetch products',
        message: error.message 
      });
    }
  }

  /**
   * Proxy to get Shopify access token from external service
   * 
   * @route GET /api/onboard/proxy/token
   * @access Protected
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
   * Connect Shipping Platform (Step 5)
   * 
   * @route POST /api/onboard/step5
   * @access Protected
   */
  async connectShipping(req, res) {
    try {
      const userId = req.user.userId;
      const { platform, email, password, access_token, secret_key } = req.body;

      console.log(`\n🚚 Step 5: Connecting ${platform} for user: ${userId}`);

      // Forward to shipping controller
      const shippingController = require('./shipping.controller');
      const axios = require('axios');
      
      // Make internal API call to shipping endpoint
      const token = req.headers.authorization;
      
      const response = await axios.post(
        `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/shipping/connect`,
        { platform, email, password, access_token, secret_key },
        { headers: { 'Authorization': token } }
      );

      console.log(`✅ ${platform} connected successfully`);

      res.json({
        success: true,
        message: `${platform} connected successfully`,
        platform: response.data.platform
      });

    } catch (error) {
      console.error('❌ Step 5 shipping connection error:', error.message);
      res.status(500).json({ 
        error: 'Failed to connect shipping platform',
        message: error.response?.data?.message || error.message 
      });
    }
  }
}

module.exports = new OnboardingController();
