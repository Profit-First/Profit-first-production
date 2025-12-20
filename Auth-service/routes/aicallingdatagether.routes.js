/**
 * AI Calling Data Routes
 * 
 * Routes for fetching order confirmation data and managing call status
 * Used by the Order Confirmation page to display customer orders
 */

const express = require('express');
const router = express.Router();
const orderConfirmationController = require('../controllers/orderconformationdata');
const { authenticateToken } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/order-confirmation/data
 * @desc    Get order confirmation data for authenticated user
 * @access  Private
 * @query   startDate - Start date for filtering orders (optional)
 * @query   endDate - End date for filtering orders (optional)
 * 
 * @returns {Object} orders - Array of customer orders with details
 * @returns {Object} stats - Statistics (total, confirmed, cancelled, etc.)
 */
router.get('/data', authenticateToken, orderConfirmationController.getOrderConfirmationData);

/**
 * @route   PUT /api/order-confirmation/update-status
 * @desc    Update order call status after confirmation call
 * @access  Private
 * @body    orderId - Order ID to update
 * @body    callStatus - New call status (confirmed, cancelled, pending)
 * @body    callNotes - Optional notes from the call
 * 
 * @returns {Object} Updated order data
 */
router.put('/update-status', authenticateToken, orderConfirmationController.updateOrderCallStatus);

module.exports = router;
