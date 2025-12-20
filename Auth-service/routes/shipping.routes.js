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

// DELETE /api/shipping/disconnect - Disconnect platform
router.delete('/disconnect', authenticateToken, shippingController.disconnect);

module.exports = router;
