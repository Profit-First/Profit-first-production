/**
 * AI Chat Routes
 * 
 * PURPOSE: Define API endpoints for AI-powered business analytics chat
 * 
 * BASE PATH: /api/ai
 * 
 * AVAILABLE ENDPOINTS:
 * - POST /api/ai/chat - Send natural language business query
 * 
 * AUTHENTICATION:
 * All routes require valid JWT token in Authorization header
 * Format: "Bearer <token>"
 * 
 * USAGE FROM FRONTEND:
 * ```javascript
 * const response = await axiosInstance.post('/ai/chat', {
 *   query: 'How many orders today?'
 * });
 * ```
 */

const express = require('express');
const router = express.Router();
const { chat } = require('../controllers/ai-chat.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// All routes require authentication
// authenticateToken middleware validates JWT and sets req.user
router.use(authenticateToken);

// POST /api/ai/chat - Send chat query
// Body: { query: "user's question" }
// Returns: AI-generated response with business insights
router.post('/chat', chat);

module.exports = router;
