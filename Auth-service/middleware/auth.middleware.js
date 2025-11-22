/**
 * Authentication Middleware
 * 
 * Protects routes by verifying JWT access tokens.
 * This middleware is used on all protected routes that require authentication.
 * 
 * HOW IT WORKS:
 * 1. Extracts token from Authorization header (Bearer <token>)
 * 2. Validates token format (JWT has 3 parts)
 * 3. Decodes token to check expiry and claims
 * 4. Verifies token with AWS Cognito
 * 5. Extracts user info from Cognito response
 * 6. Attaches user info to req.user for use in route handlers
 * 7. Calls next() to proceed to route handler
 * 
 * TOKEN STRUCTURE:
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * 
 * JWT CLAIMS VALIDATED:
 * - exp: Token expiration timestamp
 * - iss: Token issuer (must match Cognito User Pool)
 * - aud/client_id: Token audience (must match Cognito Client ID)
 * 
 * USER INFO ATTACHED TO REQUEST:
 * req.user = {
 *   userId: string,        // Cognito sub (unique user ID)
 *   email: string,         // User's email
 *   cognitoSub: string,    // Same as userId
 *   firstName: string,     // User's first name
 *   lastName: string,      // User's last name
 *   attributes: Array      // All Cognito user attributes
 * }
 * 
 * ERROR RESPONSES:
 * - 401: Missing token, invalid token, expired token
 * - Specific error messages for different failure scenarios
 * 
 * USAGE IN ROUTES:
 * router.get('/profile', authenticateToken, async (req, res) => {
 *   const { userId, email } = req.user;
 *   // ... handle request
 * });
 */

const cognitoService = require('../services/cognito.service');

/**
 * Authenticate Token Middleware
 * 
 * Verifies JWT access token and attaches user info to request.
 * 
 * PROCESS:
 * 1. Extract token from Authorization header
 * 2. Validate token format
 * 3. Decode and check expiry
 * 4. Verify with Cognito
 * 5. Extract user attributes
 * 6. Attach to req.user
 * 7. Call next()
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.warn('Auth: Missing access token from IP:', req.ip);
      return res.status(401).json({ error: 'Access token required' });
    }

    // Validate token format (JWT has 3 parts separated by dots)
    if (token.split('.').length !== 3) {
      console.warn('Auth: Invalid token format from IP:', req.ip);
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Decode JWT to check expiry and claims (quick validation before Cognito call)
    try {
      const tokenParts = token.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      
      // Check token expiry
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        console.warn('Auth: Token expired from IP:', req.ip);
        return res.status(401).json({ 
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired. Please refresh your token.'
        });
      }

      // Verify token issuer (iss)
      const expectedIssuer = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`;
      if (payload.iss && payload.iss !== expectedIssuer) {
        console.warn('Auth: Invalid token issuer from IP:', req.ip);
        return res.status(401).json({ error: 'Invalid token issuer' });
      }

      // Verify token audience (aud) - client_id
      if (payload.client_id && payload.client_id !== process.env.COGNITO_CLIENT_ID) {
        console.warn('Auth: Invalid token audience from IP:', req.ip);
        return res.status(401).json({ error: 'Invalid token audience' });
      }
    } catch (decodeError) {
      console.error('Auth: Token decode error:', decodeError.message);
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Verify token with Cognito
    const result = await cognitoService.getUserDetails(token);
    
    if (!result.success) {
      console.warn('Auth: Token verification failed from IP:', req.ip);
      
      // Provide specific error messages for token issues
      if (result.error.includes('expired')) {
        return res.status(401).json({ error: 'Token expired. Please refresh your token.' });
      }
      if (result.error.includes('NotAuthorizedException')) {
        return res.status(401).json({ error: 'Invalid token. Please login again.' });
      }
      
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    /**
     * Extract User Attributes from Cognito Response
     * 
     * Cognito returns user attributes as an array of objects:
     * [
     *   { Name: 'sub', Value: 'uuid-here' },
     *   { Name: 'email', Value: 'user@example.com' },
     *   { Name: 'given_name', Value: 'John' },
     *   { Name: 'family_name', Value: 'Doe' }
     * ]
     * 
     * We extract the important ones and attach to req.user
     */
    const userAttributes = result.data.UserAttributes || [];
    const email = userAttributes.find(attr => attr.Name === 'email')?.Value;
    const sub = userAttributes.find(attr => attr.Name === 'sub')?.Value; // Cognito user ID (UUID)
    const firstName = userAttributes.find(attr => attr.Name === 'given_name')?.Value || '';
    const lastName = userAttributes.find(attr => attr.Name === 'family_name')?.Value || '';
    
    console.log(`Auth: Token verified - Email: ${email}, UserId: ${sub}`);
    
    /**
     * CRITICAL: Use Cognito sub as userId
     * 
     * The Cognito 'sub' (subject) is a unique UUID for each user.
     * We use this directly as userId throughout the application.
     * 
     * BENEFITS:
     * - No database lookup needed for authentication
     * - Consistent across all AWS services
     * - Immutable (never changes even if email changes)
     * - Globally unique
     * 
     * This userId is used in:
     * - DynamoDB queries (partition key)
     * - Onboarding status tracking
     * - User-specific data storage
     */
    req.user = {
      userId: sub,  // Use Cognito sub as userId
      email: email,
      cognitoSub: sub,
      attributes: userAttributes,
      firstName: firstName,
      lastName: lastName
    };

    // Proceed to route handler
    next();
  } catch (error) {
    console.error('Auth: Authentication error:', error.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticateToken };
