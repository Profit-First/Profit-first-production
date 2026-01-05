/**
 * Shopify Background Sync Service
 * 
 * Simple, robust background sync that:
 * 1. Fetches 250 orders at a time
 * 2. Waits 2 minutes between requests (respects Shopify rate limits)
 * 3. Runs in background while user completes onboarding
 * 4. Provides real-time progress updates
 */

const axios = require('axios');
const { PutCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');

// Table names
const ORDERS_TABLE = process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders';
const CONNECTIONS_TABLE = process.env.SHOPIFY_CONNECTIONS_TABLE || 'shopify_connections';
const SYNC_STATUS_TABLE = process.env.SYNC_STATUS_TABLE || 'sync_status';

// Shopify API version
const SHOPIFY_API_VERSION = '2025-10';

// Rate limiting: 2 calls per minute max
const RATE_LIMIT_DELAY = 120000; // 2 minutes in milliseconds

class ShopifyBackgroundSyncService {
  constructor() {
    // In-memory sync status for real-time updates
    this.syncStatuses = new Map();
  }

  /**
   * Start background sync when user connects Shopify (ONBOARDING)
   * This runs immediately after Shopify connection is established
   * Fetches only last 3 months of orders
   */
  async startBackgroundSync(userId, shopUrl, accessToken) {
    console.log(`\n🚀 Starting ONBOARDING sync for user: ${userId}`);
    console.log(`   Shop: ${shopUrl}`);
    console.log(`   📅 Fetching last 3 months of orders only`);
    
    // Calculate 3 months ago date
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const createdAtMin = threeMonthsAgo.toISOString();
    
    console.log(`   📅 Date filter: ${createdAtMin} to now`);
    
    // Initialize sync status
    await this.updateSyncStatus(userId, {
      status: 'starting',
      stage: 'initializing',
      totalOrders: 0,
      processedOrders: 0,
      currentPage: 0,
      syncType: 'onboarding',
      dateFilter: createdAtMin,
      message: 'Initializing Shopify onboarding sync (last 3 months)...',
      startedAt: new Date().toISOString()
    });

    // Run sync in background (don't await - let it run independently)
    this.performBackgroundSync(userId, shopUrl, accessToken, createdAtMin, 'onboarding')
      .then(() => {
        console.log(`✅ Onboarding sync completed for user: ${userId}`);
      })
      .catch((error) => {
        console.error(`❌ Onboarding sync failed for user: ${userId}`, error.message);
      });

    return { success: true, message: 'Onboarding sync started' };
  }

  /**
   * Perform the actual background sync with rate limiting
   * @param {string} userId - User ID
   * @param {string} shopUrl - Shopify shop URL
   * @param {string} accessToken - Shopify access token
   * @param {string} createdAtMin - Optional date filter (ISO string)
   * @param {string} syncType - 'onboarding' or 'daily'
   */
  async performBackgroundSync(userId, shopUrl, accessToken, createdAtMin = null, syncType = 'onboarding') {
    try {
      console.log(`📊 Starting ${syncType} data collection for user: ${userId}`);
      if (createdAtMin) {
        console.log(`   📅 Date filter: Orders from ${createdAtMin}`);
      }
      
      // Step 1: Get total order count first
      await this.updateSyncStatus(userId, {
        status: 'in_progress',
        stage: 'counting',
        syncType: syncType,
        dateFilter: createdAtMin,
        message: `Counting total orders for ${syncType} sync...`
      });

      const totalCount = await this.getTotalOrderCount(shopUrl, accessToken, createdAtMin);
      console.log(`   Total orders to sync: ${totalCount}`);

      await this.updateSyncStatus(userId, {
        status: 'in_progress',
        stage: 'syncing',
        totalOrders: totalCount,
        processedOrders: 0,
        currentPage: 0,
        syncType: syncType,
        dateFilter: createdAtMin,
        message: `Found ${totalCount} orders. Starting ${syncType} sync...`
      });

      // Step 2: Fetch orders in batches of 250 with 2-minute delays
      let processedOrders = 0;
      let currentPage = 1;
      let hasMorePages = true;
      
      // Build initial URL with date filter if provided
      let nextPageUrl = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/orders.json?limit=250&status=any`;
      if (createdAtMin) {
        nextPageUrl += `&created_at_min=${encodeURIComponent(createdAtMin)}`;
      }

      while (hasMorePages) {
        console.log(`\n📦 Fetching page ${currentPage} (${processedOrders}/${totalCount} orders processed)`);
        
        // Update status before each request
        await this.updateSyncStatus(userId, {
          status: 'in_progress',
          stage: 'syncing',
          totalOrders: totalCount,
          processedOrders: processedOrders,
          currentPage: currentPage,
          syncType: syncType,
          dateFilter: createdAtMin,
          message: `Syncing page ${currentPage}... (${processedOrders}/${totalCount} orders)`
        });

        try {
          // Fetch orders from Shopify
          const response = await axios.get(nextPageUrl, {
            headers: {
              'X-Shopify-Access-Token': accessToken
            },
            timeout: 30000 // 30 second timeout
          });

          const orders = response.data.orders || [];
          console.log(`   📋 Received ${orders.length} orders from page ${currentPage}`);

          // Store orders in database
          if (orders.length > 0) {
            await this.storeOrdersBatch(userId, shopUrl, orders);
            processedOrders += orders.length;
            console.log(`   💾 Stored ${orders.length} orders (Total: ${processedOrders})`);
          }

          // Check for next page
          const linkHeader = response.headers.link || response.headers['link'];
          hasMorePages = false;
          nextPageUrl = null;

          if (linkHeader) {
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (nextMatch) {
              nextPageUrl = nextMatch[1];
              hasMorePages = true;
            }
          }

          // If no more pages or no orders, we're done
          if (!hasMorePages || orders.length === 0) {
            console.log(`✅ All pages processed. Total orders synced: ${processedOrders}`);
            break;
          }

          // Rate limiting: Wait 2 minutes before next request
          console.log(`   ⏳ Waiting 2 minutes before next request (Shopify rate limit protection)...`);
          
          await this.updateSyncStatus(userId, {
            status: 'in_progress',
            stage: 'waiting',
            totalOrders: totalCount,
            processedOrders: processedOrders,
            currentPage: currentPage,
            syncType: syncType,
            dateFilter: createdAtMin,
            message: `Waiting 2 minutes before fetching page ${currentPage + 1}... (Rate limit protection)`
          });

          // Wait 2 minutes
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
          
          currentPage++;

        } catch (requestError) {
          // Handle rate limit errors
          if (requestError.response?.status === 429) {
            console.log(`   ⚠️  Rate limit hit on page ${currentPage}, waiting 5 minutes...`);
            
            await this.updateSyncStatus(userId, {
              status: 'in_progress',
              stage: 'rate_limited',
              totalOrders: totalCount,
              processedOrders: processedOrders,
              currentPage: currentPage,
              syncType: syncType,
              dateFilter: createdAtMin,
              message: 'Rate limit reached. Waiting 5 minutes before retrying...'
            });

            // Wait 5 minutes for rate limit reset
            await new Promise(resolve => setTimeout(resolve, 300000));
            
            // Don't increment page, retry the same page
            continue;
          } else {
            // Other errors, log and continue
            console.error(`   ❌ Error fetching page ${currentPage}:`, requestError.message);
            
            // Try to continue with next page
            currentPage++;
            if (currentPage > 100) { // Safety limit
              console.error(`   🛑 Too many pages, stopping sync`);
              break;
            }
          }
        }
      }

      // Step 3: Mark sync as completed and update last sync timestamp
      const completedAt = new Date().toISOString();
      
      await this.updateSyncStatus(userId, {
        status: 'completed',
        stage: 'finished',
        totalOrders: totalCount,
        processedOrders: processedOrders,
        currentPage: currentPage,
        syncType: syncType,
        dateFilter: createdAtMin,
        message: `${syncType} sync completed! ${processedOrders} orders synced successfully.`,
        completedAt: completedAt
      });

      // Update connection with sync completion and last sync timestamp
      await this.markConnectionSynced(userId, syncType, completedAt);

      console.log(`\n🎉 ${syncType} sync completed successfully!`);
      console.log(`   User: ${userId}`);
      console.log(`   Total orders synced: ${processedOrders}`);
      console.log(`   Pages processed: ${currentPage}`);
      console.log(`   ✅ ${syncType === 'onboarding' ? 'Onboarding' : 'Daily'} sync completed for user: ${userId}\n`);

    } catch (error) {
      console.error(`❌ ${syncType} sync failed for user ${userId}:`, error.message);
      
      await this.updateSyncStatus(userId, {
        status: 'error',
        stage: 'failed',
        syncType: syncType,
        dateFilter: createdAtMin,
        message: `${syncType} sync failed: ${error.message}`,
        errorAt: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Get total order count from Shopify (for progress tracking)
   * @param {string} shopUrl - Shopify shop URL
   * @param {string} accessToken - Shopify access token
   * @param {string} createdAtMin - Optional date filter
   */
  async getTotalOrderCount(shopUrl, accessToken, createdAtMin = null) {
    try {
      let countUrl = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/orders/count.json?status=any`;
      
      if (createdAtMin) {
        countUrl += `&created_at_min=${encodeURIComponent(createdAtMin)}`;
      }
      
      const response = await axios.get(countUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken
        },
        timeout: 10000
      });

      return response.data.count || 0;
    } catch (error) {
      console.warn(`⚠️  Could not get order count, using estimate:`, error.message);
      return 1000; // Fallback estimate
    }
  }

  /**
   * Store a batch of orders in DynamoDB
   */
  async storeOrdersBatch(userId, shopUrl, orders) {
    const syncTime = new Date().toISOString();
    
    // Store orders one by one (more reliable than batch write)
    for (const order of orders) {
      try {
        const command = new PutCommand({
          TableName: ORDERS_TABLE,
          Item: {
            userId,
            orderId: order.id.toString(),
            shopUrl,
            orderData: order,
            syncedAt: syncTime,
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            
            // Extract key fields for easy querying
            orderNumber: order.order_number,
            totalPrice: parseFloat(order.total_price || 0),
            subtotalPrice: parseFloat(order.subtotal_price || 0),
            totalTax: parseFloat(order.total_tax || 0),
            totalDiscounts: parseFloat(order.total_discounts || 0),
            currency: order.currency,
            
            // Customer info
            customerId: order.customer?.id?.toString() || null,
            customerEmail: order.customer?.email || null,
            
            // Status fields
            financialStatus: order.financial_status || null,
            fulfillmentStatus: order.fulfillment_status || null,
            
            // Line items
            lineItems: order.line_items || [],
            
            // Addresses
            shippingAddress: order.shipping_address || null,
            billingAddress: order.billing_address || null
          }
        });

        await dynamoDB.send(command);
      } catch (error) {
        console.error(`   ❌ Error storing order ${order.id}:`, error.message);
        // Continue with other orders
      }
    }
  }

  /**
   * Update sync status in both memory and database
   */
  async updateSyncStatus(userId, status) {
    const fullStatus = {
      userId,
      ...status,
      updatedAt: new Date().toISOString()
    };

    // Update in-memory status for real-time access
    this.syncStatuses.set(userId, fullStatus);

    // Store in database for persistence
    try {
      const command = new PutCommand({
        TableName: SYNC_STATUS_TABLE,
        Item: fullStatus
      });
      
      await dynamoDB.send(command);
    } catch (error) {
      console.error(`Error updating sync status in DB:`, error.message);
      // Don't throw - in-memory status is still available
    }
  }

  /**
   * Get current sync status for a user
   */
  async getSyncStatus(userId) {
    // Try in-memory first (fastest)
    const memoryStatus = this.syncStatuses.get(userId);
    if (memoryStatus) {
      return memoryStatus;
    }

    // Fallback to database
    try {
      const command = new GetCommand({
        TableName: SYNC_STATUS_TABLE,
        Key: { userId }
      });
      
      const result = await dynamoDB.send(command);
      return result.Item || null;
    } catch (error) {
      console.error(`Error getting sync status from DB:`, error.message);
      return null;
    }
  }

  /**
   * Mark Shopify connection as synced and update last sync timestamp
   * @param {string} userId - User ID
   * @param {string} syncType - 'onboarding' or 'daily'
   * @param {string} completedAt - ISO timestamp
   */
  async markConnectionSynced(userId, syncType, completedAt) {
    try {
      let updateExpression = 'SET lastSyncAt = :timestamp';
      let expressionValues = {
        ':timestamp': completedAt
      };

      // Mark onboarding sync as completed
      if (syncType === 'onboarding') {
        updateExpression += ', initialSyncCompleted = :completed, syncCompletedAt = :timestamp';
        expressionValues[':completed'] = true;
      }

      const command = new UpdateCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { userId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionValues
      });

      await dynamoDB.send(command);
      console.log(`✅ Connection updated: ${syncType} sync completed at ${completedAt}`);
    } catch (error) {
      console.error(`Error marking connection as synced:`, error.message);
    }
  }

  /**
   * Check if user's Shopify data is fully synced
   */
  async isDataSynced(userId) {
    try {
      const command = new GetCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { userId }
      });
      
      const result = await dynamoDB.send(command);
      return result.Item?.initialSyncCompleted === true;
    } catch (error) {
      console.error(`Error checking sync status:`, error.message);
      return false;
    }
  }

  /**
   * Daily sync method for compatibility with sync scheduler
   * Fetches only NEW and UPDATED orders since last sync
   */
  async dailySync(userId) {
    console.log(`\n🔄 Daily sync for user: ${userId}`);
    
    try {
      // Get Shopify connection and last sync timestamp
      const command = new GetCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { userId }
      });
      
      const result = await dynamoDB.send(command);
      
      if (!result.Item || !result.Item.accessToken) {
        console.log(`   ⚠️  No Shopify connection found for user: ${userId}`);
        return { success: false, error: 'No connection found' };
      }
      
      const { shopUrl, accessToken, lastSyncAt } = result.Item;
      
      // Calculate date filter for incremental sync
      let createdAtMin;
      if (lastSyncAt) {
        // Fetch orders created/updated since last sync (with 1 hour buffer for safety)
        const lastSync = new Date(lastSyncAt);
        lastSync.setHours(lastSync.getHours() - 1); // 1 hour buffer
        createdAtMin = lastSync.toISOString();
        console.log(`   📅 Incremental sync: Orders since ${createdAtMin}`);
      } else {
        // Fallback: Last 24 hours if no previous sync timestamp
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        createdAtMin = yesterday.toISOString();
        console.log(`   📅 Fallback sync: Orders from last 24 hours (${createdAtMin})`);
      }
      
      // Start incremental sync
      await this.startIncrementalSync(userId, shopUrl, accessToken, createdAtMin);
      
      return { success: true, message: 'Daily incremental sync started' };
    } catch (error) {
      console.error(`❌ Daily sync failed for user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start incremental sync for daily updates
   * Fetches only new/updated orders since last sync
   */
  async startIncrementalSync(userId, shopUrl, accessToken, createdAtMin) {
    console.log(`\n🔄 Starting DAILY incremental sync for user: ${userId}`);
    console.log(`   Shop: ${shopUrl}`);
    console.log(`   📅 Fetching orders since: ${createdAtMin}`);
    
    // Initialize sync status
    await this.updateSyncStatus(userId, {
      status: 'starting',
      stage: 'initializing',
      totalOrders: 0,
      processedOrders: 0,
      currentPage: 0,
      syncType: 'daily',
      dateFilter: createdAtMin,
      message: 'Initializing daily incremental sync...',
      startedAt: new Date().toISOString()
    });

    // Run sync in background
    this.performIncrementalSync(userId, shopUrl, accessToken, createdAtMin)
      .then(() => {
        console.log(`✅ Daily incremental sync completed for user: ${userId}`);
      })
      .catch((error) => {
        console.error(`❌ Daily incremental sync failed for user: ${userId}`, error.message);
      });

    return { success: true, message: 'Daily incremental sync started' };
  }

  /**
   * Perform incremental sync (for daily updates)
   * Fetches orders with both created_at_min AND updated_at_min filters
   */
  async performIncrementalSync(userId, shopUrl, accessToken, sinceDate) {
    try {
      console.log(`📊 Starting daily incremental sync for user: ${userId}`);
      console.log(`   📅 Fetching orders created/updated since: ${sinceDate}`);
      
      // Step 1: Get count of new/updated orders
      await this.updateSyncStatus(userId, {
        status: 'in_progress',
        stage: 'counting',
        syncType: 'daily',
        dateFilter: sinceDate,
        message: 'Counting new/updated orders...'
      });

      // Get count with both created_at_min and updated_at_min
      const createdCount = await this.getTotalOrderCount(shopUrl, accessToken, sinceDate);
      const updatedCount = await this.getUpdatedOrderCount(shopUrl, accessToken, sinceDate);
      const totalEstimate = Math.max(createdCount, updatedCount); // Use higher estimate
      
      console.log(`   📊 Estimated orders to sync: ${totalEstimate} (${createdCount} new, ${updatedCount} updated)`);

      await this.updateSyncStatus(userId, {
        status: 'in_progress',
        stage: 'syncing',
        totalOrders: totalEstimate,
        processedOrders: 0,
        currentPage: 0,
        syncType: 'daily',
        dateFilter: sinceDate,
        message: `Found ~${totalEstimate} new/updated orders. Starting daily sync...`
      });

      // Step 2: Fetch new orders (created since last sync)
      let totalProcessed = 0;
      
      console.log(`\n📦 Fetching NEW orders (created since ${sinceDate})...`);
      const newOrders = await this.fetchOrdersWithFilter(userId, shopUrl, accessToken, sinceDate, 'created_at_min');
      totalProcessed += newOrders;
      
      console.log(`\n🔄 Fetching UPDATED orders (updated since ${sinceDate})...`);
      const updatedOrders = await this.fetchOrdersWithFilter(userId, shopUrl, accessToken, sinceDate, 'updated_at_min');
      totalProcessed += updatedOrders;

      // Step 3: Mark sync as completed
      const completedAt = new Date().toISOString();
      
      await this.updateSyncStatus(userId, {
        status: 'completed',
        stage: 'finished',
        totalOrders: totalEstimate,
        processedOrders: totalProcessed,
        syncType: 'daily',
        dateFilter: sinceDate,
        message: `Daily sync completed! ${totalProcessed} orders processed (new + updated).`,
        completedAt: completedAt
      });

      // Update last sync timestamp
      await this.markConnectionSynced(userId, 'daily', completedAt);

      console.log(`\n🎉 Daily incremental sync completed successfully!`);
      console.log(`   User: ${userId}`);
      console.log(`   Total orders processed: ${totalProcessed}`);
      console.log(`   ✅ Daily sync completed for user: ${userId}\n`);

    } catch (error) {
      console.error(`❌ Daily incremental sync failed for user ${userId}:`, error.message);
      
      await this.updateSyncStatus(userId, {
        status: 'error',
        stage: 'failed',
        syncType: 'daily',
        dateFilter: sinceDate,
        message: `Daily sync failed: ${error.message}`,
        errorAt: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Fetch orders with specific date filter (created_at_min or updated_at_min)
   */
  async fetchOrdersWithFilter(userId, shopUrl, accessToken, sinceDate, filterType) {
    let processedOrders = 0;
    let currentPage = 1;
    let hasMorePages = true;
    
    // Build URL with appropriate filter
    let nextPageUrl = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/orders.json?limit=250&status=any&${filterType}=${encodeURIComponent(sinceDate)}`;

    while (hasMorePages) {
      console.log(`   📦 Fetching ${filterType} page ${currentPage}...`);
      
      try {
        const response = await axios.get(nextPageUrl, {
          headers: {
            'X-Shopify-Access-Token': accessToken
          },
          timeout: 30000
        });

        const orders = response.data.orders || [];
        console.log(`   📋 Received ${orders.length} orders from ${filterType} page ${currentPage}`);

        if (orders.length > 0) {
          await this.storeOrdersBatch(userId, shopUrl, orders);
          processedOrders += orders.length;
          console.log(`   💾 Stored ${orders.length} orders (${filterType} total: ${processedOrders})`);
        }

        // Check for next page
        const linkHeader = response.headers.link || response.headers['link'];
        hasMorePages = false;
        nextPageUrl = null;

        if (linkHeader) {
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextMatch) {
            nextPageUrl = nextMatch[1];
            hasMorePages = true;
          }
        }

        if (!hasMorePages || orders.length === 0) {
          console.log(`   ✅ ${filterType} sync completed: ${processedOrders} orders`);
          break;
        }

        // Short delay for daily sync (30 seconds instead of 2 minutes)
        console.log(`   ⏳ Waiting 30 seconds before next ${filterType} request...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        currentPage++;

      } catch (error) {
        console.error(`   ❌ Error fetching ${filterType} page ${currentPage}:`, error.message);
        break;
      }
    }

    return processedOrders;
  }

  /**
   * Get count of updated orders since date
   */
  async getUpdatedOrderCount(shopUrl, accessToken, updatedAtMin) {
    try {
      const countUrl = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/orders/count.json?status=any&updated_at_min=${encodeURIComponent(updatedAtMin)}`;
      
      const response = await axios.get(countUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken
        },
        timeout: 10000
      });

      return response.data.count || 0;
    } catch (error) {
      console.warn(`⚠️  Could not get updated order count:`, error.message);
      return 0;
    }
  }

  /**
   * Clear sync status (cleanup)
   */
  clearSyncStatus(userId) {
    this.syncStatuses.delete(userId);
  }
}

module.exports = new ShopifyBackgroundSyncService();