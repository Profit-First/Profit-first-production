/**
 * Sync Scheduler Service
 * 
 * Runs daily sync for all active Shopify connections
 * Updates products, orders, and customers automatically
 */

const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');
const shopifySyncService = require('./shopify-sync-improved.service');
const metaSyncService = require('./meta-sync.service');
const shiprocketSyncService = require('./shiprocket-sync.service');

const SHOPIFY_CONNECTIONS_TABLE = process.env.SHOPIFY_CONNECTIONS_TABLE || 'shopify_connections';
const META_CONNECTIONS_TABLE = process.env.META_CONNECTIONS_TABLE || 'meta_connections';
const SHIPPING_CONNECTIONS_TABLE = process.env.SHIPPING_CONNECTIONS_TABLE || 'shipping_connections';

class SyncSchedulerService {
  constructor() {
    this.isRunning = false;
    this.syncInterval = null;
  }
  
  /**
   * Start the scheduler
   * Runs daily sync every 24 hours
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Sync scheduler is already running');
      return;
    }
    
    console.log('🚀 Starting sync scheduler...');
    console.log('   Interval: Every 24 hours');
    console.log('   First run: Immediately\n');
    
    // Run immediately on start
    this.runDailySync();
    
    // Then run every 24 hours
    this.syncInterval = setInterval(() => {
      this.runDailySync();
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    this.isRunning = true;
  }
  
  /**
   * Stop the scheduler
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.isRunning = false;
      console.log('🛑 Sync scheduler stopped');
    }
  }
  
  /**
   * Run daily sync for all active users
   */
  async runDailySync() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 DAILY SYNC STARTED`);
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
      // Get all active connections
      const shopifyConnections = await this.getActiveConnections(SHOPIFY_CONNECTIONS_TABLE);
      const metaConnections = await this.getActiveConnections(META_CONNECTIONS_TABLE);
      const shiprocketConnections = await this.getShippingConnections();
      
      const totalConnections = shopifyConnections.length + metaConnections.length + shiprocketConnections.length;
      
      if (totalConnections === 0) {
        console.log('ℹ️  No active connections found. Skipping sync.\n');
        return;
      }
      
      console.log(`📊 Found ${shopifyConnections.length} Shopify connection(s)`);
      console.log(`📊 Found ${metaConnections.length} Meta connection(s)`);
      console.log(`📊 Found ${shiprocketConnections.length} Shiprocket connection(s)\n`);
      
      const results = {
        shopify: [],
        meta: [],
        shiprocket: []
      };
      
      // Sync Shopify data
      if (shopifyConnections.length > 0) {
        console.log('🛍️  SHOPIFY SYNC\n');
        for (const connection of shopifyConnections) {
          const result = await shopifySyncService.dailySync(connection.userId);
          results.shopify.push({
            userId: connection.userId,
            shopUrl: connection.shopUrl,
            ...result
          });
          await this.sleep(1000);
        }
      }
      
      // Sync Meta data
      if (metaConnections.length > 0) {
        console.log('\n📱 META ADS SYNC\n');
        for (const connection of metaConnections) {
          const result = await metaSyncService.dailySync(connection.userId);
          results.meta.push({
            userId: connection.userId,
            email: connection.email,
            ...result
          });
          await this.sleep(1000);
        }
      }
      
      // Sync Shiprocket data
      if (shiprocketConnections.length > 0) {
        console.log('\n🚚 SHIPROCKET SYNC\n');
        for (const connection of shiprocketConnections) {
          const result = await shiprocketSyncService.dailySync(connection.userId);
          results.shiprocket.push({
            userId: connection.userId,
            platform: connection.platform,
            ...result
          });
          await this.sleep(1000);
        }
      }
      
      // Summary
      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ DAILY SYNC COMPLETED`);
      console.log(`\n   Shopify:`);
      console.log(`   - Total: ${results.shopify.length}`);
      console.log(`   - Successful: ${results.shopify.filter(r => r.success).length}`);
      console.log(`   - Failed: ${results.shopify.filter(r => !r.success).length}`);
      console.log(`\n   Meta Ads:`);
      console.log(`   - Total: ${results.meta.length}`);
      console.log(`   - Successful: ${results.meta.filter(r => r.success).length}`);
      console.log(`   - Failed: ${results.meta.filter(r => !r.success).length}`);
      console.log(`\n   Shiprocket:`);
      console.log(`   - Total: ${results.shiprocket.length}`);
      console.log(`   - Successful: ${results.shiprocket.filter(r => r.success).length}`);
      console.log(`   - Failed: ${results.shiprocket.filter(r => !r.success).length}`);
      console.log(`${'='.repeat(60)}\n`);
      
    } catch (error) {
      console.error(`\n❌ Daily sync error:`, error.message);
      console.error(`${'='.repeat(60)}\n`);
    }
  }
  
  /**
   * Get all active connections from a table
   */
  async getActiveConnections(tableName) {
    try {
      const command = new ScanCommand({
        TableName: tableName,
        FilterExpression: '#status = :active',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':active': 'active'
        }
      });
      
      const result = await dynamoDB.send(command);
      return result.Items || [];
    } catch (error) {
      console.error(`Get active connections error (${tableName}):`, error.message);
      return [];
    }
  }
  
  /**
   * Get all active shipping connections (Shiprocket, etc.)
   */
  async getShippingConnections() {
    try {
      const command = new ScanCommand({
        TableName: SHIPPING_CONNECTIONS_TABLE,
        FilterExpression: '#status = :active',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':active': 'active'
        }
      });
      
      const result = await dynamoDB.send(command);
      return result.Items || [];
    } catch (error) {
      console.error(`Get shipping connections error:`, error.message);
      return [];
    }
  }
  
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Manual trigger for testing
   */
  async triggerManualSync(userId) {
    console.log(`\n🔧 Manual sync triggered for user: ${userId}\n`);
    return await shopifySyncService.dailySync(userId);
  }
}

module.exports = new SyncSchedulerService();
