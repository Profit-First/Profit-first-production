/**
 * Improved Shopify Data Sync Service
 * 
 * Features:
 * - Checkpoint system for resumable syncs
 * - Retry logic with exponential backoff
 * - Failed batch recovery
 * - Better error reporting
 * - Progress persistence in DynamoDB
 */

const { PutCommand, BatchWriteCommand, QueryCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');
const axios = require('axios');

// Table names
const PRODUCTS_TABLE = process.env.SHOPIFY_PRODUCTS_TABLE || 'shopify_products';
const ORDERS_TABLE = process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders';
const CUSTOMERS_TABLE = process.env.SHOPIFY_CUSTOMERS_TABLE || 'shopify_customers';
const CONNECTIONS_TABLE = process.env.SHOPIFY_CONNECTIONS_TABLE || 'shopify_connections';
const SYNC_CHECKPOINTS_TABLE = process.env.SYNC_CHECKPOINTS_TABLE || 'sync_checkpoints';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 1 minute

// In-memory sync status storage
const syncStatusMap = new Map();

class ImprovedShopifySyncService {
  
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
   * Save checkpoint to DynamoDB for resume capability
   */
  async saveCheckpoint(userId, syncType, checkpoint) {
    try {
      await dynamoDB.send(new PutCommand({
        TableName: SYNC_CHECKPOINTS_TABLE,
        Item: {
          userId,
          syncType, // 'initial', 'manual', 'daily'
          checkpoint: {
            ...checkpoint,
            lastUpdated: new Date().toISOString()
          },
          ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days TTL
        }
      }));
      console.log(`   💾 Checkpoint saved: ${syncType} - Page ${checkpoint.currentPage}`);
    } catch (error) {
      console.error(`   ⚠️  Failed to save checkpoint:`, error.message);
    }
  }

  /**
   * Load checkpoint from DynamoDB
   */
  async loadCheckpoint(userId, syncType) {
    try {
      const result = await dynamoDB.send(new GetCommand({
        TableName: SYNC_CHECKPOINTS_TABLE,
        Key: { userId, syncType }
      }));
      
      if (result.Item) {
        console.log(`   📂 Checkpoint loaded: ${syncType} - Resuming from page ${result.Item.checkpoint.currentPage}`);
        return result.Item.checkpoint;
      }
      return null;
    } catch (error) {
      console.error(`   ⚠️  Failed to load checkpoint:`, error.message);
      return null;
    }
  }

  /**
   * Clear checkpoint after successful sync
   */
  async clearCheckpoint(userId, syncType) {
    try {
      await dynamoDB.send(new UpdateCommand({
        TableName: SYNC_CHECKPOINTS_TABLE,
        Key: { userId, syncType },
        UpdateExpression: 'REMOVE checkpoint'
      }));
      console.log(`   🗑️  Checkpoint cleared: ${syncType}`);
    } catch (error) {
      console.error(`   ⚠️  Failed to clear checkpoint:`, error.message);
    }
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff(fn, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY) {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) {
        throw error;
      }
      
      // Check if it's a rate limit error
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '300');
        console.log(`   ⏳ Rate limit hit. Waiting ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } else {
        console.log(`   🔄 Retry ${MAX_RETRIES - retries + 1}/${MAX_RETRIES} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Exponential backoff with max cap
      const nextDelay = Math.min(delay * 2, MAX_RETRY_DELAY);
      return this.retryWithBackoff(fn, retries - 1, nextDelay);
    }
  }

  /**
   * Batch write with retry and error recovery
   */
  async batchWriteWithRetry(tableName, items, batchSize = 25) {
    const failedBatches = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const putRequests = batch.map(item => ({
        PutRequest: { Item: item }
      }));

      try {
        await this.retryWithBackoff(async () => {
          await dynamoDB.send(new BatchWriteCommand({
            RequestItems: {
              [tableName]: putRequests
            }
          }));
        });
        
        // Small delay between successful batches
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`   ❌ Batch write failed for items ${i}-${i + batch.length}:`, error.message);
        failedBatches.push({
          startIndex: i,
          endIndex: i + batch.length,
          items: batch,
          error: error.message
        });
      }
    }
    
    return failedBatches;
  }

  /**
   * Improved Order Sync with checkpoint and retry
   * Flow: Fetch → Store → Wait → Repeat
   */
  async syncOrdersImproved(userId, shopUrl, accessToken, createdSince = null, syncType = 'manual', progressCallback = null) {
    console.log(`📋 Starting improved order sync (${syncType})...`);
    
    try {
      // Try to load checkpoint
      const checkpoint = await this.loadCheckpoint(userId, syncType);
      
      let totalOrdersSaved = checkpoint?.totalSaved || 0;
      let pageCount = checkpoint?.currentPage || 0;
      let url = checkpoint?.nextUrl || `https://${shopUrl}/admin/api/2024-01/orders.json?limit=250&status=any`;
      
      if (!checkpoint && createdSince) {
        url += `&created_at_min=${createdSince}`;
      }
      
      const failedPages = checkpoint?.failedPages || [];
      const syncTime = new Date().toISOString();
      
      // Paginate through orders: Fetch → Store → Wait → Repeat
      while (url) {
        pageCount++;
        
        console.log(`\n📄 Processing page ${pageCount}...`);
        
        try {
          // STEP 1: Fetch 250 orders from Shopify
          console.log(`   🔽 Fetching 250 orders from Shopify...`);
          
          const response = await this.retryWithBackoff(async () => {
            return await axios.get(url, {
              headers: {
                'X-Shopify-Access-Token': accessToken
              },
              timeout: 30000
            });
          });
          
          const orders = response.data.orders || [];
          console.log(`   ✅ Fetched ${orders.length} orders from page ${pageCount}`);
          
          // Report progress
          if (progressCallback) {
            progressCallback({
              stage: 'fetched',
              ordersCount: totalOrdersSaved + orders.length,
              page: pageCount,
              message: `Fetched ${orders.length} orders from page ${pageCount}`
            });
          }
          
          // STEP 2: Store these orders in database immediately
          if (orders.length > 0) {
            console.log(`   💾 Storing ${orders.length} orders in database...`);
            
            if (progressCallback) {
              progressCallback({
                stage: 'saving',
                ordersCount: totalOrdersSaved + orders.length,
                page: pageCount,
                message: `Saving ${orders.length} orders to database...`
              });
            }
            
            const orderItems = orders.map(order => ({
              userId,
              orderId: order.id.toString(),
              shopUrl,
              orderData: order,
              syncedAt: syncTime,
              createdAt: order.created_at,
              updatedAt: order.updated_at,
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
            }));
            
            const failedBatches = await this.batchWriteWithRetry(ORDERS_TABLE, orderItems);
            
            if (failedBatches.length > 0) {
              console.log(`   ⚠️  ${failedBatches.length} batches failed to write`);
              await this.saveFailedBatches(userId, syncType, 'orders', failedBatches);
            } else {
              console.log(`   ✅ Successfully stored ${orders.length} orders`);
              totalOrdersSaved += orders.length;
            }
          }
          
          // STEP 3: Check for next page
          const linkHeader = response.headers.link || response.headers['link'];
          const nextUrl = this.extractNextUrl(linkHeader);
          
          // Save checkpoint before waiting
          if (nextUrl) {
            await this.saveCheckpoint(userId, syncType, {
              currentPage: pageCount,
              nextUrl,
              totalSaved: totalOrdersSaved,
              failedPages
            });
            
            console.log(`   💾 Checkpoint saved: Page ${pageCount}, Total saved: ${totalOrdersSaved}`);
          }
          
          url = nextUrl;
          
          // STEP 4: Wait 2 minutes before next fetch (rate limiting)
          if (url) {
            const delay = syncType === 'daily' ? 30000 : 120000; // 30s for daily, 2min for initial/manual
            console.log(`   ⏳ Waiting ${delay / 1000} seconds before fetching next page...`);
            
            if (progressCallback) {
              progressCallback({
                stage: 'waiting',
                ordersCount: totalOrdersSaved,
                page: pageCount,
                message: `Waiting ${delay / 1000}s before fetching page ${pageCount + 1}... (${totalOrdersSaved} orders saved so far)`
              });
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
        } catch (pageError) {
          console.error(`   ❌ Failed to process page ${pageCount}:`, pageError.message);
          failedPages.push({
            page: pageCount,
            url,
            error: pageError.message,
            timestamp: new Date().toISOString()
          });
          
          // Save checkpoint with error info
          await this.saveCheckpoint(userId, syncType, {
            currentPage: pageCount,
            nextUrl: url,
            totalSaved: totalOrdersSaved,
            failedPages
          });
          
          // Try to continue to next page if possible
          const linkHeader = pageError.response?.headers?.link;
          const nextUrl = this.extractNextUrl(linkHeader);
          
          if (nextUrl) {
            console.log(`   ⚠️  Skipping failed page, continuing to next page...`);
            url = nextUrl;
          } else {
            console.log(`   ⚠️  No more pages to fetch. Stopping.`);
            break;
          }
        }
      }
      
      console.log(`\n📦 Sync Summary:`);
      console.log(`   Total pages processed: ${pageCount}`);
      console.log(`   Total orders saved: ${totalOrdersSaved}`);
      console.log(`   Failed pages: ${failedPages.length}`);
      
      if (failedPages.length > 0) {
        console.log(`\n⚠️  Failed pages details:`);
        failedPages.forEach(fp => {
          console.log(`   - Page ${fp.page}: ${fp.error}`);
        });
      }
      
      // Clear checkpoint on success
      await this.clearCheckpoint(userId, syncType);
      
      console.log(`   ✅ Order sync completed`);
      
      return {
        success: true,
        count: totalOrdersSaved,
        pagesProcessed: pageCount,
        failedPages: failedPages.length
      };
      
    } catch (error) {
      console.error(`   ❌ Order sync failed:`, error.message);
      
      if (progressCallback) {
        progressCallback({
          stage: 'error',
          message: `Sync failed: ${error.message}`
        });
      }
      
      return {
        success: false,
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Extract next URL from Link header
   */
  extractNextUrl(linkHeader) {
    if (!linkHeader) return null;
    
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    return nextMatch ? nextMatch[1] : null;
  }

  /**
   * Save failed batches for later retry
   */
  async saveFailedBatches(userId, syncType, dataType, failedBatches) {
    try {
      await dynamoDB.send(new PutCommand({
        TableName: SYNC_CHECKPOINTS_TABLE,
        Item: {
          userId,
          syncType: `${syncType}_failed_${dataType}`,
          failedBatches,
          createdAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        }
      }));
      console.log(`   💾 Saved ${failedBatches.length} failed batches for later retry`);
    } catch (error) {
      console.error(`   ⚠️  Failed to save failed batches:`, error.message);
    }
  }

  /**
   * Retry failed batches
   */
  async retryFailedBatches(userId, syncType, dataType) {
    console.log(`🔄 Retrying failed batches for ${userId}...`);
    
    try {
      const result = await dynamoDB.send(new GetCommand({
        TableName: SYNC_CHECKPOINTS_TABLE,
        Key: { userId, syncType: `${syncType}_failed_${dataType}` }
      }));
      
      if (!result.Item || !result.Item.failedBatches) {
        console.log(`   ℹ️  No failed batches found`);
        return { success: true, retriedCount: 0 };
      }
      
      const failedBatches = result.Item.failedBatches;
      console.log(`   📦 Found ${failedBatches.length} failed batches to retry`);
      
      let successCount = 0;
      const stillFailed = [];
      
      for (const batch of failedBatches) {
        try {
          const tableName = dataType === 'orders' ? ORDERS_TABLE : 
                           dataType === 'products' ? PRODUCTS_TABLE : 
                           CUSTOMERS_TABLE;
          
          await this.retryWithBackoff(async () => {
            const putRequests = batch.items.map(item => ({
              PutRequest: { Item: item }
            }));
            
            await dynamoDB.send(new BatchWriteCommand({
              RequestItems: {
                [tableName]: putRequests
              }
            }));
          });
          
          successCount++;
          console.log(`   ✅ Retry successful for batch ${batch.startIndex}-${batch.endIndex}`);
        } catch (error) {
          console.error(`   ❌ Retry failed for batch ${batch.startIndex}-${batch.endIndex}:`, error.message);
          stillFailed.push(batch);
        }
      }
      
      // Update or clear failed batches
      if (stillFailed.length > 0) {
        await this.saveFailedBatches(userId, syncType, dataType, stillFailed);
      } else {
        await dynamoDB.send(new UpdateCommand({
          TableName: SYNC_CHECKPOINTS_TABLE,
          Key: { userId, syncType: `${syncType}_failed_${dataType}` },
          UpdateExpression: 'REMOVE failedBatches'
        }));
      }
      
      console.log(`   ✅ Retry complete: ${successCount}/${failedBatches.length} batches recovered`);
      
      return {
        success: true,
        retriedCount: successCount,
        stillFailedCount: stillFailed.length
      };
      
    } catch (error) {
      console.error(`   ❌ Failed batch retry error:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Manual Sync with improved error handling
   */
  async manualSync(userId) {
    console.log(`\n🔄 Starting improved manual sync for user: ${userId}`);
    
    this.updateSyncStatus(userId, {
      status: 'in_progress',
      stage: 'starting',
      ordersCount: 0,
      message: 'Starting sync...'
    });
    
    try {
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
      
      // Sync orders with improved method
      const ordersResult = await this.syncOrdersImproved(
        userId,
        shopUrl,
        accessToken,
        null, // Fetch all orders
        'manual',
        (progress) => {
          this.updateSyncStatus(userId, {
            status: 'in_progress',
            ...progress
          });
        }
      );
      
      // Retry any failed batches
      if (ordersResult.failedBatches > 0) {
        console.log(`\n🔄 Retrying ${ordersResult.failedBatches} failed batches...`);
        await this.retryFailedBatches(userId, 'manual', 'orders');
      }
      
      // Update connection
      await this.updateConnectionSyncStatus(userId, {
        lastOrderSync: new Date().toISOString(),
        lastManualSync: new Date().toISOString()
      });
      
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
          orders: ordersResult.count,
          failedPages: ordersResult.failedPages,
          failedBatches: ordersResult.failedBatches
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
   * Daily Sync - Update only recent data
   */
  async dailySync(userId) {
    console.log(`\n🔄 Starting daily sync for user: ${userId}`);
    
    try {
      const connection = await this.getConnection(userId);
      if (!connection) {
        console.log(`   ⚠️  No Shopify connection found`);
        return { success: false, error: 'No connection found' };
      }
      
      const { shopUrl, accessToken } = connection;
      
      // Calculate yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const updatedSince = yesterday.toISOString();
      
      console.log(`   Fetching changes since: ${updatedSince}`);
      
      // Sync only updated orders (use fast sync for daily updates)
      const ordersResult = await this.syncOrdersImproved(
        userId,
        shopUrl,
        accessToken,
        updatedSince,
        'daily'
      );
      
      // Update sync timestamps
      await this.updateConnectionSyncStatus(userId, {
        lastOrderSync: new Date().toISOString()
      });
      
      console.log(`\n✅ Daily sync completed!`);
      console.log(`   Orders updated: ${ordersResult.count}\n`);
      
      return {
        success: true,
        data: {
          orders: ordersResult.count
        }
      };
    } catch (error) {
      console.error(`❌ Daily sync failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Initial Sync - For new users
   */
  async initialSync(userId, shopUrl, accessToken) {
    console.log(`\n🔄 Starting initial sync for user: ${userId}`);
    
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
      
      // Sync orders with improved method
      const ordersResult = await this.syncOrdersImproved(
        userId,
        shopUrl,
        accessToken,
        startDate,
        'initial',
        (progress) => {
          this.updateSyncStatus(userId, {
            status: 'in_progress',
            ...progress
          });
        }
      );
      
      // Update connection
      await this.updateConnectionSyncStatus(userId, {
        lastOrderSync: new Date().toISOString(),
        initialSyncCompleted: true,
        syncCompletedAt: new Date().toISOString()
      });
      
      this.updateSyncStatus(userId, {
        status: 'completed',
        stage: 'done',
        ordersCount: ordersResult.count,
        message: `Sync completed! ${ordersResult.count} orders`
      });
      
      console.log(`\n✅ Initial sync completed! Orders: ${ordersResult.count}\n`);
      
      return {
        success: true,
        data: {
          orders: ordersResult.count
        }
      };
    } catch (error) {
      console.error(`❌ Initial sync failed:`, error.message);
      
      this.updateSyncStatus(userId, {
        status: 'error',
        stage: 'failed',
        message: `Initial sync failed: ${error.message}`
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Get cached products
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
   * Get cached orders
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
   * Get cached customers
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

module.exports = new ImprovedShopifySyncService();
