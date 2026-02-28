/**
 * Shipping Platform Routes
 */

const express = require('express');
const router = express.Router();
const shippingController = require('../controllers/shipping.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// POST /api/shipping/connect - Connect shipping platform
router.post('/connect', authenticateToken, shippingController.connectPlatform);

// GET /api/shipping/connection - Get connection status
router.get('/connection', authenticateToken, shippingController.getConnection);

// POST /api/shipping/sync - Sync shipments from Shiprocket
router.post('/sync', authenticateToken, shippingController.syncShipments);

// GET /api/shipping/shipments - Get shipments from database
router.get('/shipments', authenticateToken, shippingController.getShipments);

// GET /api/shipping/metrics - Get shipping metrics (spend, RTO, delivered, revenue)
router.get('/metrics', authenticateToken, shippingController.getShippingMetrics);

// DELETE /api/shipping/disconnect - Disconnect platform
router.delete('/disconnect', authenticateToken, shippingController.disconnect);

module.exports = router;

// GET /api/shipping/dashboard-v2 - Get dashboard data from revenue_stats table
const shiprocketDashboardV2 = require('../controllers/shiprocket-dashboard-v2.controller');
router.get('/dashboard-v2', authenticateToken, shiprocketDashboardV2.getShiprocketDashboardData);
