/**
 * Shopify Data Sync Service
 * 
 * Handles initial sync and daily updates of Shopify data
 * Caches products, orders, and customers in DynamoDB for fast access
 */

const { PutCommand, BatchWriteCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');
const axios = require('axios');

// Table names
const PRODUCTS_TABLE = process.env.SHOPIFY_PRODUCTS_TABLE || 'shopify_products';
const ORDERS_TABLE = process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders';
const CUSTOMERS_TABLE = process.env.SHOPIFY_CUSTOMERS_TABLE || 'shopify_customers';
const CONNECTIONS_TABLE = process.env.SHOPIFY_CONNECTIONS_TABLE || 'shopify_connections';
const ABANDONED_CARTS_TABLE = process.env.SHOPIFY_ABANDONED_CARTS_TABLE || 'shopify_abandoned_carts';

// In-memory sync status storage (for real-time progress tracking)
const syncStatusMap = new Map();

class ShopifySyncService {
  
  /**
   * Get sync status for a user
   */
  getSyncStatus(userId) {
    return syncStatusMap.get(userId) || null;
  }
  
  /**
   * Update sync status for a user
   */
  updateSyncStatus(userId, status) {
    syncStatusMap.set(userId, {
      ...status,
      updatedAt: new Date().toISOString()
    });
  }
  
  /**
   * Clear sync status for a user
   */
  clearSyncStatus(userId) {
    syncStatusMap.delete(userId);
  }

  /**
   * Manual Sync - Fetch last 3 months of orders with progress tracking
   * Called when user clicks "Sync Now" button
   * 
   * @param {string} userId - User's unique ID
   * @returns {Promise} - Sync result with order count
   */
  async manualSync(userId) {
    console.log(`\n🔄 Starting manual sync for user: ${userId}`);
    
    // Initialize sync status
    this.updateSyncStatus(userId, {
      status: 'in_progress',
      stage: 'starting',
      ordersCount: 0,
      message: 'Starting sync...'
    });
    
    try {
      // Get connection details
      const connection = await this.getConnection(userId);
      if (!connection) {
        this.updateSyncStatus(userId, {
          status: 'error',
          message: 'No Shopify connection found'
        });
        return { success: false, error: 'No Shopify connection found' };
      }
      
      const { shopUrl, accessToken } = connection;
      console.log(`   Store: ${shopUrl}`);
      
      // Fetch ALL historical orders (no date filter for full sync)
      // This ensures we get all orders, not just last 3 months
      const startDate = null; // null = fetch ALL orders
      
      console.log(`   Fetching ALL historical orders...`);
      
      this.updateSyncStatus(userId, {
        status: 'in_progress',
        stage: 'fetching',
        ordersCount: 0,
        message: 'Fetching all orders from Shopify...'
      });
      
      // Sync orders with progress callback
      const ordersResult = await this.syncOrders(
        userId, 
        shopUrl, 
        accessToken, 
        startDate,
        (progress) => {
          this.updateSyncStatus(userId, {
            status: 'in_progress',
            stage: progress.stage,
            ordersCount: progress.ordersCount,
            page: progress.page,
            message: progress.stage === 'fetching' 
              ? `Fetching orders... (${progress.ordersCount} fetched)`
              : `Saving ${progress.ordersCount} orders to database...`
          });
        }
      );
      
      // Update sync timestamps
      await this.updateConnectionSyncStatus(userId, {
        lastOrderSync: new Date().toISOString(),
        lastManualSync: new Date().toISOString()
      });
      
      // Mark sync as complete
      this.updateSyncStatus(userId, {
        status: 'completed',
        stage: 'done',
        ordersCount: ordersResult.count,
        message: `Successfully synced ${ordersResult.count} orders`
      });
      
      console.log(`\n✅ Manual sync completed! Orders: ${ordersResult.count}`);
      
      return {
        success: true,
        data: {
          orders: ordersResult.count
        }
      };
    } catch (error) {
      console.error(`❌ Manual sync failed:`, error.message);
      
      this.updateSyncStatus(userId, {
        status: 'error',
        message: `Sync failed: ${error.message}`
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Initial Sync - Fetch 3 months of historical data with progress tracking
   * Called after user completes Step 2 (Shopify connection)
   * 
   * @param {string} userId - User's unique ID
   * @param {string} shopUrl - Shopify store URL
   * @param {string} accessToken - Shopify access token
   */
  async initialSync(userId, shopUrl, accessToken) {
    console.log(`\n🔄 Starting initial sync for user: ${userId}`);
    console.log(`   Store: ${shopUrl}`);
    
    // Initialize sync status
    this.updateSyncStatus(userId, {
      status: 'in_progress',
      stage: 'starting',
      ordersCount: 0,
      message: 'Starting initial data sync...'
    });
    
    try {
      // Calculate date 3 months ago
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const startDate = threeMonthsAgo.toISOString();
      
      console.log(`   Fetching data from: ${startDate}`);
      
      // Update status
      this.updateSyncStatus(userId, {
        status: 'in_progress',
        stage: 'fetching_products',
        ordersCount: 0,
        message: 'Fetching products from Shopify...'
      });
      
      // Sync products first (fast)
      const productsResult = await this.syncProducts(userId, shopUrl, accessToken);
      
      // Update status
      this.updateSyncStatus(userId, {
        status: 'in_progress',
        stage: 'fetching_customers',
        ordersCount: 0,
        message: 'Fetching customers from Shopify...'
      });
      
      // Sync customers (fast)
      const customersResult = await this.syncCustomers(userId, shopUrl, accessToken, startDate);
      
      // Update status for orders (slow part)
      this.updateSyncStatus(userId, {
        status: 'in_progress',
        stage: 'fetching_orders',
        ordersCount: 0,
        message: 'Fetching orders from Shopify... This may take several minutes.'
      });
      
      // Sync orders with progress callback (slow part with rate limiting)
      const ordersResult = await this.syncOrders(
        userId, 
        shopUrl, 
        accessToken, 
        startDate,
        (progress) => {
          this.updateSyncStatus(userId, {
            status: 'in_progress',
            stage: progress.stage,
            ordersCount: progress.ordersCount,
            page: progress.page,
            message: progress.message || `Processing orders... (${progress.ordersCount} fetched)`
          });
        }
      );
      
      // Update connection with sync timestamps
      await this.updateConnectionSyncStatus(userId, {
        lastProductSync: new Date().toISOString(),
        lastOrderSync: new Date().toISOString(),
        lastCustomerSync: new Date().toISOString(),
        initialSyncCompleted: true,
        syncCompletedAt: new Date().toISOString()
      });
      
      // Mark sync as complete
      this.updateSyncStatus(userId, {
        status: 'completed',
        stage: 'done',
        ordersCount: ordersResult.count,
        productsCount: productsResult.count,
        customersCount: customersResult.count,
        message: `Sync completed! ${ordersResult.count} orders, ${productsResult.count} products, ${customersResult.count} customers`
      });
      
      console.log(`\n✅ Initial sync completed successfully!`);
      console.log(`   Products: ${productsResult.count}`);
      console.log(`   Orders: ${ordersResult.count}`);
      console.log(`   Customers: ${customersResult.count}\n`);
      
      return {
        success: true,
        data: {
          products: productsResult.count,
          orders: ordersResult.count,
          customers: customersResult.count
        }
      };
    } catch (error) {
      console.error(`❌ Initial sync failed:`, error.message);
      
      // Mark sync as failed
      this.updateSyncStatus(userId, {
        status: 'error',
        stage: 'failed',
        message: `Initial sync failed: ${error.message}`
      });
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Sync Products from Shopify (with pagination to get ALL products)
   */
  async syncProducts(userId, shopUrl, accessToken, updatedSince = null) {
    console.log(`📦 Syncing products...`);
    
    try {
      let allProducts = [];
      let url = `https://${shopUrl}/admin/api/2024-01/products.json?limit=250`;
      if (updatedSince) {
        url += `&updated_at_min=${updatedSince}`;
      }
      
      // Paginate through ALL products
      while (url) {
        const response = await axios.get(url, {
          headers: {
            'X-Shopify-Access-Token': accessToken
          }
        });
        
        const products = response.data.products || [];
        allProducts = allProducts.concat(products);
        
        // Check for next page in Link header
        const linkHeader = response.headers.link || response.headers['link'];
        url = null;
        
        if (linkHeader) {
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextMatch) {
            url = nextMatch[1];
            console.log(`   📄 Fetching next page... (${allProducts.length} products so far)`);
          }
        }
      }
      
      const products = allProducts;
      console.log(`   📦 Total products fetched: ${products.length}`);
      
      // Store products in DynamoDB using batch writes (25 items at a time)
      const batchSize = 25;
      const syncTime = new Date().toISOString();
      
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        const putRequests = batch.map(product => ({
          PutRequest: {
            Item: {
              userId,
              productId: product.id.toString(),
              shopUrl,
              productData: product,
              syncedAt: syncTime,
              updatedAt: product.updated_at
            }
          }
        }));

        await dynamoDB.send(new BatchWriteCommand({
          RequestItems: {
            [PRODUCTS_TABLE]: putRequests
          }
        }));
      }
      
      console.log(`   ✅ Synced ${products.length} products`);
      
      return { success: true, count: products.length };
    } catch (error) {
      console.error(`   ❌ Product sync failed:`, error.message);
      return { success: false, count: 0, error: error.message };
    }
  }
  
  /**
   * Sync Orders from Shopify (with pagination and rate limiting)
   * Includes 2-minute delays between requests to avoid rate limits
   */
  async syncOrders(userId, shopUrl, accessToken, createdSince = null, progressCallback = null) {
    console.log(`📋 Syncing orders...`);
    
    try {
      let allOrders = [];
      let pageCount = 0;
      let url = `https://${shopUrl}/admin/api/2024-01/orders.json?limit=250&status=any`;
      if (createdSince) {
        url += `&created_at_min=${createdSince}`;
      }
      
      // Paginate through ALL orders with 2-minute rate limiting
      while (url) {
        pageCount++;
        
        console.log(`   📄 Fetching page ${pageCount}...`);
        
        try {
          const response = await axios.get(url, {
            headers: {
              'X-Shopify-Access-Token': accessToken
            },
            timeout: 30000 // 30 second timeout
          });
          
          const orders = response.data.orders || [];
          allOrders = allOrders.concat(orders);
          
          console.log(`   📄 Page ${pageCount}: ${orders.length} orders (Total: ${allOrders.length})`);
          
          // Report progress if callback provided
          if (progressCallback) {
            progressCallback({
              stage: 'fetching',
              ordersCount: allOrders.length,
              page: pageCount,
              message: `Fetching page ${pageCount}... (${allOrders.length} orders so far)`
            });
          }
          
          // Check for next page in Link header
          const linkHeader = response.headers.link || response.headers['link'];
          url = null; // Reset URL
          
          if (linkHeader) {
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (nextMatch) {
              url = nextMatch[1];
              
              // Rate limiting: wait 2 minutes between requests to avoid hitting limits
              console.log(`   ⏳ Waiting 2 minutes before next request to avoid rate limits...`);
              if (progressCallback) {
                progressCallback({
                  stage: 'waiting',
                  ordersCount: allOrders.length,
                  page: pageCount,
                  message: `Waiting 2 minutes before fetching page ${pageCount + 1}... (Rate limit protection)`
                });
              }
              
              // Wait 2 minutes (120 seconds)
              await new Promise(resolve => setTimeout(resolve, 120000));
            }
          }
          
        } catch (requestError) {
          // Handle rate limit errors specifically
          if (requestError.response?.status === 429) {
            console.log(`   ⚠️  Rate limit hit, waiting 5 minutes before retry...`);
            if (progressCallback) {
              progressCallback({
                stage: 'rate_limited',
                ordersCount: allOrders.length,
                page: pageCount,
                message: 'Rate limit reached. Waiting 5 minutes before retrying...'
              });
            }
            
            // Wait 5 minutes for rate limit reset
            await new Promise(resolve => setTimeout(resolve, 300000));
            
            // Don't increment pageCount, retry the same page
            continue;
          } else {
            // Other errors, re-throw
            throw requestError;
          }
        }
      }
      
      const orders = allOrders;
      console.log(`   📦 Total orders fetched: ${orders.length} (${pageCount} pages)`);
      
      // Report saving stage
      if (progressCallback) {
        progressCallback({
          stage: 'saving',
          ordersCount: orders.length,
          page: pageCount,
          message: `Saving ${orders.length} orders to database...`
        });
      }
      
      // Store orders in DynamoDB using batch writes (25 items at a time)
      const batchSize = 25;
      const syncTime = new Date().toISOString();
      
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        const putRequests = batch.map(order => ({
          PutRequest: {
            Item: {
              userId,
              orderId: order.id.toString(),
              shopUrl,
              orderData: order,
              syncedAt: syncTime,
              createdAt: order.created_at,
              updatedAt: order.updated_at,
              
              // Revenue fields - store all for accurate calculations
              totalPrice: parseFloat(order.total_price || 0),           // Total including shipping & tax
              subtotalPrice: parseFloat(order.subtotal_price || 0),     // Product revenue only
              totalTax: parseFloat(order.total_tax || 0),               // Tax amount
              totalDiscounts: parseFloat(order.total_discounts || 0),   // Discount amount
              totalShipping: parseFloat(order.total_shipping_price_set?.shop_money?.amount || 0), // Shipping
              
              orderNumber: order.order_number,
              // Extract customer info for easier querying
              customerId: order.customer?.id?.toString() || null,
              customerEmail: order.customer?.email || null,
              // Extract line items for easier access
              lineItems: order.line_items || [],
              // Extract fulfillment and financial status
              fulfillmentStatus: order.fulfillment_status || null,
              financialStatus: order.financial_status || null,
              // Payment status
              confirmed: order.confirmed || false,
              cancelledAt: order.cancelled_at || null
            }
          }
        }));

        await dynamoDB.send(new BatchWriteCommand({
          RequestItems: {
            [ORDERS_TABLE]: putRequests
          }
        }));
        
        // Small delay between batch writes
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`   ✅ Synced ${orders.length} orders`);
      
      return { success: true, count: orders.length };
    } catch (error) {
      console.error(`   ❌ Order sync failed:`, error.message);
      
      // Update sync status with error
      if (progressCallback) {
        progressCallback({
          stage: 'error',
          ordersCount: allOrders?.length || 0,
          message: `Sync failed: ${error.message}`
        });
      }
      
      return { success: false, count: 0, error: error.message };
    }
  }
  
  /**
   * Sync Customers from Shopify (with pagination to get ALL customers)
   */
  async syncCustomers(userId, shopUrl, accessToken, createdSince = null) {
    console.log(`👥 Syncing customers...`);
    
    try {
      let allCustomers = [];
      let url = `https://${shopUrl}/admin/api/2024-01/customers.json?limit=250`;
      if (createdSince) {
        url += `&created_at_min=${createdSince}`;
      }
      
      // Paginate through ALL customers
      while (url) {
        const response = await axios.get(url, {
          headers: {
            'X-Shopify-Access-Token': accessToken
          }
        });
        
        const customers = response.data.customers || [];
        allCustomers = allCustomers.concat(customers);
        
        // Check for next page in Link header
        const linkHeader = response.headers.link || response.headers['link'];
        url = null;
        
        if (linkHeader) {
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextMatch) {
            url = nextMatch[1];
            console.log(`   📄 Fetching next page... (${allCustomers.length} customers so far)`);
          }
        }
      }
      
      const customers = allCustomers;
      console.log(`   👥 Total customers fetched: ${customers.length}`);
      
      // Store customers in DynamoDB using batch writes (25 items at a time)
      const batchSize = 25;
      const syncTime = new Date().toISOString();
      
      for (let i = 0; i < customers.length; i += batchSize) {
        const batch = customers.slice(i, i + batchSize);
        const putRequests = batch.map(customer => ({
          PutRequest: {
            Item: {
              userId,
              customerId: customer.id.toString(),
              shopUrl,
              customerData: customer,
              syncedAt: syncTime,
              createdAt: customer.created_at,
              updatedAt: customer.updated_at,
              email: customer.email,
              totalSpent: parseFloat(customer.total_spent || 0)
            }
          }
        }));

        await dynamoDB.send(new BatchWriteCommand({
          RequestItems: {
            [CUSTOMERS_TABLE]: putRequests
          }
        }));
      }
      
      console.log(`   ✅ Synced ${customers.length} customers`);
      
      return { success: true, count: customers.length };
    } catch (error) {
      console.error(`   ❌ Customer sync failed:`, error.message);
      return { success: false, count: 0, error: error.message };
    }
  }
  
  /**
   * Daily Sync - Update only changed data
   * Called by scheduled job every day
   * 
   * @param {string} userId - User's unique ID
   */
  async dailySync(userId) {
    console.log(`\n🔄 Starting daily sync for user: ${userId}`);
    
    try {
      // Get connection details
      const connection = await this.getConnection(userId);
      if (!connection) {
        console.log(`   ⚠️  No Shopify connection found`);
        return { success: false, error: 'No connection found' };
      }
      
      const { shopUrl, accessToken, lastProductSync, lastOrderSync, lastCustomerSync } = connection;
      
      // Calculate yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const updatedSince = yesterday.toISOString();
      
      console.log(`   Fetching changes since: ${updatedSince}`);
      
      // Sync only updated data (use faster rate limiting for daily sync)
      const [productsResult, ordersResult, customersResult] = await Promise.all([
        this.syncProducts(userId, shopUrl, accessToken, updatedSince),
        this.syncOrdersFast(userId, shopUrl, accessToken, updatedSince), // Use fast sync for daily updates
        this.syncCustomers(userId, shopUrl, accessToken, updatedSince)
      ]);
      
      // Update sync timestamps
      await this.updateConnectionSyncStatus(userId, {
        lastProductSync: new Date().toISOString(),
        lastOrderSync: new Date().toISOString(),
        lastCustomerSync: new Date().toISOString()
      });
      
      console.log(`\n✅ Daily sync completed!`);
      console.log(`   Products updated: ${productsResult.count}`);
      console.log(`   Orders updated: ${ordersResult.count}`);
      console.log(`   Customers updated: ${customersResult.count}\n`);
      
      return {
        success: true,
        data: {
          products: productsResult.count,
          orders: ordersResult.count,
          customers: customersResult.count
        }
      };
    } catch (error) {
      console.error(`❌ Daily sync failed:`, error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get Shopify connection details
   */
  async getConnection(userId) {
    try {
      const command = new QueryCommand({
        TableName: CONNECTIONS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        Limit: 1
      });
      
      const result = await dynamoDB.send(command);
      return result.Items && result.Items.length > 0 ? result.Items[0] : null;
    } catch (error) {
      console.error('Get connection error:', error.message);
      return null;
    }
  }
  
  /**
   * Update connection sync status
   */
  async updateConnectionSyncStatus(userId, updates) {
    try {
      const updateExpressions = [];
      const expressionAttributeValues = {};
      
      Object.keys(updates).forEach((key, index) => {
        updateExpressions.push(`${key} = :val${index}`);
        expressionAttributeValues[`:val${index}`] = updates[key];
      });
      
      await dynamoDB.send(new UpdateCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { userId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues
      }));
      
      return { success: true };
    } catch (error) {
      console.error('Update connection status error:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get cached products for user
   */
  async getCachedProducts(userId) {
    try {
      const command = new QueryCommand({
        TableName: PRODUCTS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });
      
      const result = await dynamoDB.send(command);
      return {
        success: true,
        data: result.Items || []
      };
    } catch (error) {
      console.error('Get cached products error:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get cached orders for user
   */
  async getCachedOrders(userId, startDate = null, endDate = null) {
    try {
      const command = new QueryCommand({
        TableName: ORDERS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });
      
      const result = await dynamoDB.send(command);
      let orders = result.Items || [];
      
      // Filter by date range if provided
      if (startDate || endDate) {
        orders = orders.filter(order => {
          const orderDate = new Date(order.createdAt);
          if (startDate && orderDate < new Date(startDate)) return false;
          if (endDate && orderDate > new Date(endDate)) return false;
          return true;
        });
      }
      
      return {
        success: true,
        data: orders
      };
    } catch (error) {
      console.error('Get cached orders error:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get cached customers for user
   */
  async getCachedCustomers(userId) {
    try {
      const command = new QueryCommand({
        TableName: CUSTOMERS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });
      
      const result = await dynamoDB.send(command);
      return {
        success: true,
        data: result.Items || []
      };
    } catch (error) {
      console.error('Get cached customers error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fast Sync Orders - For daily updates (shorter delays)
   * Used for daily sync when fetching only recent orders
   */
  async syncOrdersFast(userId, shopUrl, accessToken, createdSince = null) {
    console.log(`📋 Fast syncing recent orders...`);
    
    try {
      let allOrders = [];
      let pageCount = 0;
      let url = `https://${shopUrl}/admin/api/2024-01/orders.json?limit=250&status=any`;
      if (createdSince) {
        url += `&created_at_min=${createdSince}`;
      }
      
      // Paginate with faster rate limiting (30 seconds instead of 2 minutes)
      while (url) {
        pageCount++;
        
        console.log(`   📄 Fast fetching page ${pageCount}...`);
        
        try {
          const response = await axios.get(url, {
            headers: {
              'X-Shopify-Access-Token': accessToken
            },
            timeout: 30000
          });
          
          const orders = response.data.orders || [];
          allOrders = allOrders.concat(orders);
          
          console.log(`   📄 Page ${pageCount}: ${orders.length} orders (Total: ${allOrders.length})`);
          
          // Check for next page
          const linkHeader = response.headers.link || response.headers['link'];
          url = null;
          
          if (linkHeader) {
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (nextMatch) {
              url = nextMatch[1];
              
              // Faster rate limiting for daily sync: 30 seconds
              console.log(`   ⏳ Waiting 30 seconds before next request...`);
              await new Promise(resolve => setTimeout(resolve, 30000));
            }
          }
          
        } catch (requestError) {
          if (requestError.response?.status === 429) {
            console.log(`   ⚠️  Rate limit hit, waiting 2 minutes before retry...`);
            await new Promise(resolve => setTimeout(resolve, 120000));
            continue;
          } else {
            throw requestError;
          }
        }
      }
      
      const orders = allOrders;
      console.log(`   📦 Total recent orders fetched: ${orders.length} (${pageCount} pages)`);
      
      // Store orders in DynamoDB
      const batchSize = 25;
      const syncTime = new Date().toISOString();
      
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        const putRequests = batch.map(order => ({
          PutRequest: {
            Item: {
              userId,
              orderId: order.id.toString(),
              shopUrl,
              orderData: order,
              syncedAt: syncTime,
              createdAt: order.created_at,
              updatedAt: order.updated_at,
              
              // Revenue fields
              totalPrice: parseFloat(order.total_price || 0),
              subtotalPrice: parseFloat(order.subtotal_price || 0),
              totalTax: parseFloat(order.total_tax || 0),
              totalDiscounts: parseFloat(order.total_discounts || 0),
              totalShipping: parseFloat(order.total_shipping_price_set?.shop_money?.amount || 0),
              
              orderNumber: order.order_number,
              customerId: order.customer?.id?.toString() || null,
              customerEmail: order.customer?.email || null,
              lineItems: order.line_items || [],
              fulfillmentStatus: order.fulfillment_status || null,
              financialStatus: order.financial_status || null,
              confirmed: order.confirmed || false,
              cancelledAt: order.cancelled_at || null
            }
          }
        }));

        await dynamoDB.send(new BatchWriteCommand({
          RequestItems: {
            [ORDERS_TABLE]: putRequests
          }
        }));
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`   ✅ Fast synced ${orders.length} recent orders`);
      
      return { success: true, count: orders.length };
    } catch (error) {
      console.error(`   ❌ Fast order sync failed:`, error.message);
      return { success: false, count: 0, error: error.message };
    }
  }
}

module.exports = new ShopifySyncService();