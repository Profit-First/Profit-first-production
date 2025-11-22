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

class ShopifySyncService {
  /**
   * Initial Sync - Fetch last 3 months of data
   * Called after user completes Step 3 (product costs)
   * 
   * @param {string} userId - User's unique ID
   * @param {string} shopUrl - Shopify store URL
   * @param {string} accessToken - Shopify access token
   */
  async initialSync(userId, shopUrl, accessToken) {
    console.log(`\n🔄 Starting initial sync for user: ${userId}`);
    console.log(`   Store: ${shopUrl}`);
    
    try {
      // Calculate date 3 months ago
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const startDate = threeMonthsAgo.toISOString();
      
      console.log(`   Fetching data from: ${startDate}`);
      
      // Sync all data in parallel
      const [productsResult, ordersResult, customersResult] = await Promise.all([
        this.syncProducts(userId, shopUrl, accessToken),
        this.syncOrders(userId, shopUrl, accessToken, startDate),
        this.syncCustomers(userId, shopUrl, accessToken, startDate)
      ]);
      
      // Update connection with sync timestamps
      await this.updateConnectionSyncStatus(userId, {
        lastProductSync: new Date().toISOString(),
        lastOrderSync: new Date().toISOString(),
        lastCustomerSync: new Date().toISOString(),
        initialSyncCompleted: true
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
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Sync Products from Shopify
   */
  async syncProducts(userId, shopUrl, accessToken, updatedSince = null) {
    console.log(`📦 Syncing products...`);
    
    try {
      let url = `https://${shopUrl}/admin/api/2024-01/products.json?limit=250`;
      if (updatedSince) {
        url += `&updated_at_min=${updatedSince}`;
      }
      
      const response = await axios.get(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken
        }
      });
      
      const products = response.data.products || [];
      
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
   * Sync Orders from Shopify
   */
  async syncOrders(userId, shopUrl, accessToken, createdSince = null) {
    console.log(`📋 Syncing orders...`);
    
    try {
      let url = `https://${shopUrl}/admin/api/2024-01/orders.json?limit=250&status=any`;
      if (createdSince) {
        url += `&created_at_min=${createdSince}`;
      }
      
      const response = await axios.get(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken
        }
      });
      
      const orders = response.data.orders || [];
      
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
              totalPrice: parseFloat(order.total_price || 0),
              orderNumber: order.order_number,
              // Extract customer info for easier querying
              customerId: order.customer?.id?.toString() || null,
              customerEmail: order.customer?.email || null,
              // Extract line items for easier access
              lineItems: order.line_items || [],
              // Extract fulfillment and financial status
              fulfillmentStatus: order.fulfillment_status || null,
              financialStatus: order.financial_status || null
            }
          }
        }));

        await dynamoDB.send(new BatchWriteCommand({
          RequestItems: {
            [ORDERS_TABLE]: putRequests
          }
        }));
      }
      
      console.log(`   ✅ Synced ${orders.length} orders`);
      
      return { success: true, count: orders.length };
    } catch (error) {
      console.error(`   ❌ Order sync failed:`, error.message);
      return { success: false, count: 0, error: error.message };
    }
  }
  
  /**
   * Sync Customers from Shopify
   */
  async syncCustomers(userId, shopUrl, accessToken, createdSince = null) {
    console.log(`👥 Syncing customers...`);
    
    try {
      let url = `https://${shopUrl}/admin/api/2024-01/customers.json?limit=250`;
      if (createdSince) {
        url += `&created_at_min=${createdSince}`;
      }
      
      const response = await axios.get(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken
        }
      });
      
      const customers = response.data.customers || [];
      
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
      
      // Sync only updated data
      const [productsResult, ordersResult, customersResult] = await Promise.all([
        this.syncProducts(userId, shopUrl, accessToken, updatedSince),
        this.syncOrders(userId, shopUrl, accessToken, updatedSince),
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
}

module.exports = new ShopifySyncService();
