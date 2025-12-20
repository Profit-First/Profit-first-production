/**
 * Shiprocket Sync Service
 * Handles automatic daily sync of Shiprocket shipments
 */

const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');
const shiprocketService = require('./shiprocket.service');

const SHIPPING_CONNECTIONS_TABLE = process.env.SHIPPING_CONNECTIONS_TABLE || 'shipping_connections';

class ShiprocketSyncService {
  /**
   * Daily sync for a user
   * Fetches latest shipments from Shiprocket
   */
  async dailySync(userId) {
    console.log(`🔄 Starting Shiprocket sync for user: ${userId}`);
    
    try {
      // Get Shiprocket connection
      const connection = await this.getConnection(userId);
      
      if (!connection) {
        console.log(`   ⚠️  No Shiprocket connection found`);
        return { success: false, reason: 'no_connection' };
      }
      
      if (connection.platform !== 'Shiprocket') {
        console.log(`   ⚠️  Connected platform is ${connection.platform}, not Shiprocket`);
        return { success: false, reason: 'wrong_platform' };
      }
      
      if (!connection.token) {
        console.log(`   ⚠️  No token found`);
        return { success: false, reason: 'no_token' };
      }
      
      // Check token expiration
      if (connection.expiresAt) {
        const expiryDate = new Date(connection.expiresAt);
        const now = new Date();
        
        if (expiryDate < now) {
          console.log(`   ⚠️  Token expired on ${connection.expiresAt}`);
          return { success: false, reason: 'token_expired' };
        }
      }
      
      console.log(`   📦 Syncing shipments...`);
      
      // Sync shipments
      const result = await shiprocketService.syncShipments(userId, connection.token);
      
      console.log(`✅ Shiprocket sync completed!`);
      console.log(`   Shipments synced: ${result.count}\n`);
      
      return {
        success: true,
        shipmentsSynced: result.count
      };
      
    } catch (error) {
      console.error(`❌ Shiprocket sync error for ${userId}:`, error.message);
      
      // Check if token is invalid
      if (error.response?.status === 401) {
        console.error(`   Token is invalid or expired`);
        return { success: false, reason: 'invalid_token', error: error.message };
      }
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get Shiprocket connection from database
   */
  async getConnection(userId) {
    try {
      const command = new GetCommand({
        TableName: SHIPPING_CONNECTIONS_TABLE,
        Key: { userId }
      });
      
      const result = await dynamoDB.send(command);
      return result.Item || null;
      
    } catch (error) {
      console.error('Get Shiprocket connection error:', error.message);
      return null;
    }
  }
}

module.exports = new ShiprocketSyncService();
