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
  const adminKeyHeader = req.headers['x-admin-key'];
  const validAdminKey = process.env.ADMIN_KEY;

  if (!validAdminKey) {
    console.error('Security: ADMIN_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!adminKeyHeader) {
    return res.status(403).json({ error: 'Admin key required' });
  }

  // Handle case where header might be array (duplicate headers)
  const adminKey = Array.isArray(adminKeyHeader) ? adminKeyHeader[0] : adminKeyHeader;

  // Perform constant-time comparison
  try {
    const crypto = require('crypto');
    const adminKeyBuffer = Buffer.from(adminKey);
    const validKeyBuffer = Buffer.from(validAdminKey);

    if (adminKeyBuffer.length !== validKeyBuffer.length) {
      // Timing-safe-ish return (length mismatch leaks length but avoiding it is hard without fixed size)
      return res.status(403).json({ error: 'Invalid admin key' });
    }

    if (!crypto.timingSafeEqual(adminKeyBuffer, validKeyBuffer)) {
      console.warn('Security: Admin key mismatch from IP:', req.ip);
      return res.status(403).json({ error: 'Invalid admin key' });
    }

    next();
  } catch (err) {
    console.error('Admin key check error:', err.message);
    return res.status(403).json({ error: 'Invalid admin key format' });
  }
};

module.exports = {
  checkAdminRole,
  checkAdminKey
};
