/**
 * Meta/Facebook Ads Routes
 */

const express = require('express');
const router = express.Router();
const metaController = require('../controllers/meta.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// POST /api/meta/connect - Initiate OAuth flow
router.post('/connect', authenticateToken, metaController.initiateOAuth);

// GET /api/meta/callback - OAuth callback from Facebook
router.get('/callback', metaController.handleCallback);

// GET /api/meta/connection - Get connection status
router.get('/connection', authenticateToken, metaController.getConnection);

// POST /api/meta/select-account - Select ad account
router.post('/select-account', authenticateToken, metaController.selectAdAccount);

// POST /api/meta/sync-data - Manually sync 3 months data
router.post('/sync-data', authenticateToken, metaController.syncData);

// GET /api/meta/ad-account/:accountId - Get ad account data
router.get('/ad-account/:accountId', authenticateToken, metaController.getAdAccountData);

module.exports = router;
