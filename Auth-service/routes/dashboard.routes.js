/**
 * Dashboard Routes
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// GET /api/data/dashboard - Get dashboard data
router.get('/dashboard', authenticateToken, dashboardController.getDashboardData);

// GET /api/data/sync-status - Get sync status
router.get('/sync-status', authenticateToken, dashboardController.getSyncStatus);

module.exports = router;
