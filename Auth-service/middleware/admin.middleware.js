/**
 * Admin Middleware
 * 
 * Verifies that the authenticated user has admin privileges
 * Must be used after authenticateToken middleware
 */

const dynamoDBService = require('../services/dynamodb.service');

/**
 * Check Admin Role
 * Verifies user has admin role
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const checkAdminRole = async (req, res, next) => {
  try {
    // User email is set by authenticateToken middleware
    const { email } = req.user;

    if (!email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user from database
    const userResult = await dynamoDBService.getUserByEmail(email);

    if (!userResult.success) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has admin role
    const user = userResult.data;
    if (!user.isAdmin) {
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.' 
      });
    }

    // Attach full user data to request
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Simple Admin Key Check (Alternative)
 * Checks for admin key in header (simpler but less secure)
 * Use this for quick setup, replace with proper role-based auth in production
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const checkAdminKey = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  const validAdminKey = process.env.ADMIN_KEY;

  if (!validAdminKey) {
    console.error('Security: ADMIN_KEY not configured in environment variables');
    return res.status(500).json({ 
      error: 'Admin key not configured. Set ADMIN_KEY in environment variables.' 
    });
  }

  // Validate admin key format and length
  if (!adminKey) {
    console.warn('Security: Admin key missing in request headers');
    return res.status(403).json({ 
      error: 'Access denied. Admin key required.' 
    });
  }

  // Use constant-time comparison to prevent timing attacks
  if (adminKey.length !== validAdminKey.length) {
    console.warn('Security: Invalid admin key length attempted');
    return res.status(403).json({ 
      error: 'Access denied. Invalid admin key.' 
    });
  }

  // Constant-time comparison
  const crypto = require('crypto');
  const adminKeyBuffer = Buffer.from(adminKey);
  const validKeyBuffer = Buffer.from(validAdminKey);
  
  if (!crypto.timingSafeEqual(adminKeyBuffer, validKeyBuffer)) {
    console.warn('Security: Invalid admin key attempted from IP:', req.ip);
    return res.status(403).json({ 
      error: 'Access denied. Invalid admin key.' 
    });
  }

  next();
};

module.exports = { 
  checkAdminRole,
  checkAdminKey
};
