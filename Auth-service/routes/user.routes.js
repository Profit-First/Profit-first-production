/**
 * User Routes
 * Handles user profile and settings
 */

const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateBasicProfile,
  updateShopify,
  updateMeta,
  updateShiprocket,
  getBusinessExpenses,
  updateBusinessExpenses
} = require('../controllers/user.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticateToken);

// GET /api/user/profile - Get user profile
router.get('/profile', getProfile);

// PUT /api/user/profile/basic - Update basic profile
router.put('/profile/basic', updateBasicProfile);

// PUT /api/user/profile/shopify - Update Shopify credentials
router.put('/profile/shopify', updateShopify);

// PUT /api/user/profile/meta - Update Meta credentials
router.put('/profile/meta', updateMeta);

// PUT /api/user/profile/shiprocket - Update Shiprocket credentials
router.put('/profile/shiprocket', updateShiprocket);

// GET /api/user/business-expenses - Get business expenses
router.get('/business-expenses', getBusinessExpenses);

// POST /api/user/business-expenses - Update business expenses
router.post('/business-expenses', updateBusinessExpenses);

module.exports = router;
