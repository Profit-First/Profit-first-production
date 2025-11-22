/**
 * DynamoDB Service
 * 
 * Handles all database operations for user data storage
 * Uses DynamoDB Document Client for simplified data operations
 */

const { PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, tableName } = require('../config/aws.config');
const { v4: uuidv4 } = require('uuid');

class DynamoDBService {
  /**
   * Create User
   * Stores new user data in DynamoDB
   * 
   * @param {Object} userData - User information
   * @param {string} userData.email - User's email
   * @param {string} userData.firstName - User's first name
   * @param {string} userData.lastName - User's last name
   * @param {string} userData.authProvider - Authentication provider (cognito/google/etc)
   * @param {boolean} userData.isVerified - Email verification status
   * @returns {Object} Success status and user data/error
   */
  async createUser(userData) {
    try {
      const userId = uuidv4();
      const timestamp = new Date().toISOString();
      const isVerified = userData.isVerified || false;
      
      // Add TTL for unverified users (expire after 7 days)
      const ttl = !isVerified 
        ? Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days from now
        : undefined;
      
      const user = {
        userId: userId,  // Primary key (partition key)
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        authProvider: userData.authProvider || 'cognito',
        isVerified: isVerified,
        onboardingCompleted: false,  // Track onboarding completion
        onboardingStep: 1,  // Current onboarding step (1-5)
        onboardingData: {},  // Store onboarding form data
        createdAt: timestamp,
        updatedAt: timestamp,
        lastLogin: null,
        ...(ttl && { expireAt: ttl }) // Add TTL only for unverified users
      };

      const command = new PutCommand({
        TableName: tableName,
        Item: user,
        ConditionExpression: 'attribute_not_exists(userId)'
      });

      await dynamoDB.send(command);
      return { success: true, data: user };
    } catch (error) {
      console.error('DynamoDB createUser error:', error);
      if (error.name === 'ConditionalCheckFailedException') {
        return { success: false, error: 'User already exists' };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Get User by Email
   * Retrieves user data using email address
   * 
   * Note: Currently uses table scan. For production, create a GSI on email attribute
   * for better performance (O(1) instead of O(n))
   * 
   * @param {string} email - User's email address
   * @returns {Object} Success status and user data/error
   */
  async getUserByEmail(email) {
    try {
      // Using scan as workaround since email-index GSI doesn't exist
      // TODO: Create email-index GSI for production use
      const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
      const command = new ScanCommand({
        TableName: tableName,
        FilterExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email
        },
        Limit: 1 // Optimize by limiting to 1 result
      });

      const result = await dynamoDB.send(command);

      if (result.Items && result.Items.length > 0) {
        return { success: true, data: result.Items[0] };
      }
      return { success: false, error: 'User not found' };
    } catch (error) {
      console.error('DynamoDB getUserByEmail error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update User Verification Status
   * Marks user's email as verified after OTP confirmation
   * 
   * @param {string} email - User's email address
   * @param {boolean} isVerified - Verification status
   * @returns {Object} Success status and updated user data/error
   */
  async updateUserVerification(email, isVerified) {
    try {
      // First get the user to find their userId
      const userResult = await this.getUserByEmail(email);
      if (!userResult.success) {
        console.error(`updateUserVerification: User not found - ${email}`);
        return { success: false, error: 'User not found' };
      }

      console.log(`Updating verification for user:`, {
        email,
        userId: userResult.data.userId,
        currentVerified: userResult.data.isVerified,
        newVerified: isVerified
      });

      const command = new UpdateCommand({
        TableName: tableName,
        Key: { 
          userId: userResult.data.userId
        },
        UpdateExpression: 'SET isVerified = :verified, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':verified': isVerified,
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      });

      const result = await dynamoDB.send(command);
      
      console.log(`✓ Verification updated successfully:`, {
        email,
        isVerified: result.Attributes.isVerified,
        updatedAt: result.Attributes.updatedAt
      });
      
      return { success: true, data: result.Attributes };
    } catch (error) {
      console.error('DynamoDB updateUserVerification error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.code
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update User Details
   * Updates any user attributes
   * 
   * @param {string} email - User's email address
   * @param {Object} updates - Key-value pairs of attributes to update
   * @returns {Object} Success status and updated user data/error
   */
  async updateUser(email, updates) {
    try {
      // First get the user to find their userId
      const userResult = await this.getUserByEmail(email);
      if (!userResult.success) {
        return { success: false, error: 'User not found' };
      }

      const updateExpressions = [];
      const expressionAttributeValues = {};
      const expressionAttributeNames = {};

      Object.keys(updates).forEach((key, index) => {
        updateExpressions.push(`#attr${index} = :val${index}`);
        expressionAttributeNames[`#attr${index}`] = key;
        expressionAttributeValues[`:val${index}`] = updates[key];
      });

      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      const command = new UpdateCommand({
        TableName: tableName,
        Key: { 
          userId: userResult.data.userId
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      });

      const result = await dynamoDB.send(command);
      return { success: true, data: result.Attributes };
    } catch (error) {
      console.error('DynamoDB updateUser error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update Last Login
   * Records timestamp of user's last successful login
   * 
   * @param {string} email - User's email address
   * @returns {Object} Success status and updated user data/error
   */
  async updateLastLogin(email) {
    try {
      const userResult = await this.getUserByEmail(email);
      if (!userResult.success) {
        return { success: false, error: 'User not found' };
      }

      const timestamp = new Date().toISOString();
      
      // Use userId as the key (single-table design)
      const command = new UpdateCommand({
        TableName: tableName,
        Key: { 
          userId: userResult.data.userId
        },
        UpdateExpression: 'SET lastLogin = :lastLogin, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':lastLogin': timestamp,
          ':updatedAt': timestamp
        },
        ReturnValues: 'ALL_NEW'
      });

      const result = await dynamoDB.send(command);
      return { success: true, data: result.Attributes };
    } catch (error) {
      console.error('DynamoDB updateLastLogin error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get All Users
   * Retrieves all users from database
   * 
   * @returns {Object} Success status and array of users/error
   */
  async getAllUsers() {
    try {
      const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
      const command = new ScanCommand({
        TableName: tableName
      });

      const result = await dynamoDB.send(command);
      return { success: true, data: result.Items || [] };
    } catch (error) {
      console.error('DynamoDB getAllUsers error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get User by ID
   * Retrieves user by their userId
   * 
   * @param {string} userId - User's unique ID
   * @returns {Object} Success status and user data/error
   */
  async getUserById(userId) {
    try {
      // Since we need both pk and sk for GetCommand, we'll use Scan with filter
      const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
      const command = new ScanCommand({
        TableName: tableName,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        Limit: 1
      });

      const result = await dynamoDB.send(command);
      
      if (result.Items && result.Items.length > 0) {
        return { success: true, data: result.Items[0] };
      }
      return { success: false, error: 'User not found' };
    } catch (error) {
      console.error('DynamoDB getUserById error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete User
   * Removes user from database
   * 
   * @param {string} userId - User's unique ID
   * @returns {Object} Success status and message/error
   */
  async deleteUser(userId) {
    try {
      const { DeleteCommand } = require('@aws-sdk/lib-dynamodb');
      const command = new DeleteCommand({
        TableName: tableName,
        Key: { 
          userId: userId
        }
      });

      await dynamoDB.send(command);
      return { success: true, message: 'User deleted successfully' };
    } catch (error) {
      console.error('DynamoDB deleteUser error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update User Status
   * Activates or deactivates user account
   * 
   * @param {string} userId - User's unique ID
   * @param {boolean} isActive - Active status
   * @returns {Object} Success status and updated user data/error
   */
  async updateUserStatus(userId, isActive) {
    try {
      const command = new UpdateCommand({
        TableName: tableName,
        Key: { 
          userId: userId
        },
        UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':isActive': isActive,
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      });

      const result = await dynamoDB.send(command);
      return { success: true, data: result.Attributes };
    } catch (error) {
      console.error('DynamoDB updateUserStatus error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new DynamoDBService();
