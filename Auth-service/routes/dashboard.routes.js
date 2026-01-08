/**
 * Dashboard Routes
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const shiprocketDashboardController = require('../controllers/shiprocket-dashboard.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// GET /api/data/dashboard - Get main dashboard data (Shopify only)
router.get('/dashboard', authenticateToken, dashboardController.getDashboardData);

// GET /api/data/shiprocket-dashboard - Get Shiprocket-specific dashboard data
router.get('/shiprocket-dashboard', authenticateToken, shiprocketDashboardController.getShiprocketDashboardData);

// GET /api/data/shiprocket-debug - Debug Shiprocket connection and data
router.get('/shiprocket-debug', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;
    
    console.log(`🔍 Debug request for user: ${userId}`);
    
    // Get shipping connection
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
    const { dynamoDB } = require('../config/aws.config');
    
    const command = new QueryCommand({
      TableName: 'shipping_connections',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await dynamoDB.send(command);
    const shippingConnection = result.Items?.[0];
    
    if (!shippingConnection || !shippingConnection.token) {
      return res.json({
        success: false,
        error: 'No Shiprocket connection found',
        solution: 'Connect your Shiprocket account in dashboard settings'
      });
    }
    
    // Test API connection
    const shiprocketService = require('../services/shiprocket.service');
    const testResult = await shiprocketService.fetchOrdersDirectly(shippingConnection.token, {
      startDate: startDate || '2025-01-01',
      endDate: endDate || '2025-12-31',
      maxPages: 2,
      perPage: 50
    });
    
    const delivered = testResult.shipments?.filter(s => 
      s.statusCode === 6 || s.statusCode === 7 || s.statusCode === 8
    ) || [];
    
    const statusBreakdown = {};
    testResult.shipments?.forEach(s => {
      const status = s.status || 'Unknown';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });
    
    res.json({
      success: true,
      debug: {
        connectionExists: true,
        hasToken: true,
        tokenLength: shippingConnection.token.length,
        apiWorking: true,
        totalRecords: testResult.shipments?.length || 0,
        deliveredRecords: delivered.length,
        dateRange: { startDate, endDate },
        statusBreakdown,
        sampleRecord: testResult.shipments?.[0] ? {
          orderId: testResult.shipments[0].orderId,
          total: testResult.shipments[0].total,
          status: testResult.shipments[0].status,
          statusCode: testResult.shipments[0].statusCode,
          shippingCharges: testResult.shipments[0].shippingCharges
        } : null
      }
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      solution: error.response?.status === 401 ? 'Re-connect Shiprocket account' : 'Check API connection'
    });
  }
});

// GET /api/data/sync-status - Get sync status
router.get('/sync-status', authenticateToken, dashboardController.getSyncStatus);

// POST /api/data/sync-shopify - Manual Shopify sync (last 3 months)
router.post('/sync-shopify', authenticateToken, dashboardController.syncShopifyOrders);

module.exports = router;
