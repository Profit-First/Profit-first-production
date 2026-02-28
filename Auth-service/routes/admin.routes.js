/**
 * Admin Routes
 * 
 * Defines all admin-related API endpoints
 * All routes require admin authentication
 */

const express = require('express');
const adminController = require('../controllers/admin.controller');
const { checkAdminKey } = require('../middleware/admin.middleware');

const router = express.Router();

// Apply admin authentication to all routes
// Using simple admin key check - replace with checkAdminRole for production
router.use(checkAdminKey);

// ============================================
// ADMIN ROUTES (Require admin key)
// ============================================

// Get dashboard statistics
router.get('/stats', adminController.getStats);

// Get all users
router.get('/users', adminController.getAllUsers);

// Get specific user by ID
router.get('/users/:userId', adminController.getUserById);

// Delete user
router.delete('/users/:userId', adminController.deleteUser);

// Update user status (activate/deactivate)
router.patch('/users/:userId/status', adminController.updateUserStatus);

module.exports = router;
