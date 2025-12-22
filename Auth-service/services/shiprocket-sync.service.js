/**
 * Shiprocket Sync Service
 * Handles automatic daily sync of Shiprocket shipments
 */

const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');
const shiprocketService = require('./shiprocket.service');
const axios = require('axios');

const SHIPPING_CONNECTIONS_TABLE = process.env.SHIPPING_CONNECTIONS_TABLE || 'shipping_connections';

class ShiprocketSyncService {
  /**
   * Refresh Shiprocket token using stored credentials
   */
  async refreshToken(userId, connection) {
    try {
      // Log what credentials are available (masked)
      console.log(`   📋 Stored credentials: email=${connection.email ? 'YES' : 'NO'}, password=${connection.password ? 'YES' : 'NO'}`);
      
      if (!connection.email || !connection.password) {
        console.log(`   ⚠️  No credentials stored for token refresh`);
        console.log(`   💡 User needs to reconnect Shiprocket in Settings to store credentials`);
        return null;
      }
      
      console.log(`   🔄 Refreshing Shiprocket token...`);
      
      const response = await axios.post(
        'https://apiv2.shiprocket.in/v1/external/auth/login',
        { email: connection.email, password: connection.password },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      if (!response.data.token) {
        console.log(`   ❌ Failed to refresh token`);
        return null;
      }
      
      // Update token in database
      const newExpiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days
      
      const command = new PutCommand({
        TableName: SHIPPING_CONNECTIONS_TABLE,
        Item: {
          ...connection,
          token: response.data.token,
          expiresAt: newExpiresAt,
          updatedAt: new Date().toISOString()
        }
      });
      
      await dynamoDB.send(command);
      
      console.log(`   ✅ Token refreshed successfully`);
      return response.data.token;
      
    } catch (error) {
      console.log(`   ❌ Token refresh failed: ${error.message}`);
      return null;
    }
  }

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
      
      let token = connection.token;
      
      if (!token) {
        console.log(`   ⚠️  No token found, attempting refresh...`);
        token = await this.refreshToken(userId, connection);
        if (!token) {
          return { success: false, reason: 'no_token' };
        }
      }
      
      // Check token expiration and refresh if needed
      if (connection.expiresAt) {
        const expiryDate = new Date(connection.expiresAt);
        const now = new Date();
        
        if (expiryDate < now) {
          console.log(`   ⚠️  Token expired on ${connection.expiresAt}, refreshing...`);
          token = await this.refreshToken(userId, connection);
          if (!token) {
            return { success: false, reason: 'token_expired' };
          }
        }
      }
      
      console.log(`   📦 Syncing shipments...`);
      
      // Sync shipments
      const result = await shiprocketService.syncShipments(userId, token);
      
      console.log(`✅ Shiprocket sync completed!`);
      console.log(`   Shipments synced: ${result.count}\n`);
      
      return {
        success: true,
        shipmentsSynced: result.count
      };
      
    } catch (error) {
      console.error(`❌ Shiprocket sync error for ${userId}:`, error.message);
      
      // Check if token is invalid (401 or 403) and try to refresh
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log(`   🔄 Token invalid, attempting refresh...`);
        const connection = await this.getConnection(userId);
        if (connection) {
          const newToken = await this.refreshToken(userId, connection);
          if (newToken) {
            // Retry sync with new token
            try {
              const result = await shiprocketService.syncShipments(userId, newToken);
              console.log(`✅ Shiprocket sync completed after token refresh!`);
              return { success: true, shipmentsSynced: result.count };
            } catch (retryError) {
              console.error(`   ❌ Retry failed: ${retryError.message}`);
            }
          }
        }
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
