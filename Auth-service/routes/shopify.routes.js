/**
 * Shopify Routes
 * 
 * Handles Shopify OAuth and store connection endpoints
 */

const express = require('express');
const router = express.Router();
const shopifyController = require('../controllers/shopify.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// POST /api/shopify/connect - Initiate OAuth flow
router.post('/connect', authenticateToken, shopifyController.initiateOAuth);

// POST /api/shopify/callback - Callback from frontend (requires auth)
router.post('/callback', authenticateToken, shopifyController.handleCallback);

// GET /api/shopify/connection - Get connection status
router.get('/connection', authenticateToken, shopifyController.getConnection);

// DELETE /api/shopify/connection - Disconnect store
router.delete('/connection', authenticateToken, shopifyController.disconnect);

module.exports = router;
