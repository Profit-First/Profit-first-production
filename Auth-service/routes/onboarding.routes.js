/**
 * Onboarding Routes
 * 
 * Defines all onboarding-related API endpoints
 */

const express = require('express');
const onboardingController = require('../controllers/onboarding.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// All onboarding routes require authentication
router.use(authenticateToken);

// Get current onboarding step
router.get('/step', onboardingController.getCurrentStep);

// Update onboarding step
router.post('/step', onboardingController.updateStep);

// Complete onboarding
router.post('/complete', onboardingController.completeOnboarding);

// Get onboarding data
router.get('/data', onboardingController.getOnboardingData);

// Save product costs
router.post('/modifyprice', onboardingController.modifyPrice);

// Background sync of orders and customers
router.post('/background-sync', onboardingController.backgroundSync);

// Manual sync - triggered by "Sync Now" button on dashboard
router.post('/manual-sync', onboardingController.manualSync);

// Get sync status - for polling progress
router.get('/sync-status', onboardingController.getSyncStatus);

// Fetch products from Shopify
router.get('/fetchproduct', onboardingController.fetchProducts);

// Proxy to get Shopify access token
router.get('/proxy/token', onboardingController.getProxyToken);

// Connect shipping platform (Step 5)
router.post('/step5', onboardingController.connectShipping);

module.exports = router;
