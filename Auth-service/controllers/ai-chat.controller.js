/**
 * AI Chat Controller
 * 
 * PURPOSE: Handle HTTP requests for AI-powered business analytics chat
 * 
 * ENDPOINT: POST /api/ai/chat
 * 
 * REQUEST FLOW:
 * 1. Frontend sends user question in request body
 * 2. Controller validates input and extracts user ID from JWT token
 * 3. Calls AI service to process query
 * 4. Returns AI-generated response to frontend
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token (checked by authenticateToken middleware)
 * - User ID extracted from req.user.userId (set by middleware)
 * 
 * ERROR HANDLING:
 * - 400: Missing query parameter
 * - 500: AI service errors (DB issues, Bedrock API errors)
 */

const { processChatQuery } = require('../services/ai-chat.service');

/**
 * Handle chat query
 * 
 * ENDPOINT: POST /api/ai/chat
 * 
 * REQUEST BODY:
 * {
 *   "query": "How many orders did I get today?"
 * }
 * 
 * RESPONSE:
 * {
 *   "success": true,
 *   "data": {
 *     "response": "You received 45 orders today...",
 *     "intent": "orders_today",
 *     "timeframe": "today",
 *     "dataAvailable": true
 *   }
 * }
 * 
 * AUTHENTICATION: Required (JWT token in Authorization header)
 */
const chat = async (req, res) => {
  try {
    const { query } = req.body;
    const userId = req.user.userId;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await processChatQuery(userId, query);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat query',
      message: error.message 
    });
  }
};

module.exports = {
  chat
};
