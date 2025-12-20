/**
 * User Controller
 * Handles user profile and settings
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Get user profile
 * GET /api/user/profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user from Users table
    const userParams = {
      TableName: process.env.DYNAMODB_TABLE_NAME || 'Users',
      Key: { userId }
    };

    const userResult = await docClient.send(new GetCommand(userParams));

    if (!userResult.Item) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get onboarding data
    const onboardingParams = {
      TableName: process.env.ONBOARDING_TABLE_NAME || 'Onboarding',
      Key: { userId }
    };

    const onboardingResult = await docClient.send(new GetCommand(onboardingParams));

    res.json({
      userId: userResult.Item.userId,
      email: userResult.Item.email,
      firstName: userResult.Item.firstName || '',
      lastName: userResult.Item.lastName || '',
      onboarding: onboardingResult.Item || {}
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

/**
 * Update basic profile
 * PUT /api/user/profile/basic
 */
const updateBasicProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, email } = req.body;

    const params = {
      TableName: process.env.DYNAMODB_TABLE_NAME || 'Users',
      Key: { userId },
      UpdateExpression: 'SET firstName = :firstName, lastName = :lastName, email = :email',
      ExpressionAttributeValues: {
        ':firstName': firstName,
        ':lastName': lastName,
        ':email': email
      },
      ReturnValues: 'ALL_NEW'
    };

    await docClient.send(new UpdateCommand(params));

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

/**
 * Update Shopify credentials
 * PUT /api/user/profile/shopify
 */
const updateShopify = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { storeUrl, apiKey, apiSecret, accessToken } = req.body;

    const params = {
      TableName: process.env.ONBOARDING_TABLE_NAME || 'Onboarding',
      Key: { userId },
      UpdateExpression: 'SET step2 = :step2',
      ExpressionAttributeValues: {
        ':step2': { storeUrl, apiKey, apiSecret, accessToken }
      }
    };

    await docClient.send(new UpdateCommand(params));

    res.json({ message: 'Shopify credentials updated successfully' });
  } catch (error) {
    console.error('Update Shopify error:', error);
    res.status(500).json({ error: 'Failed to update Shopify credentials' });
  }
};

/**
 * Update Meta credentials
 * PUT /api/user/profile/meta
 */
const updateMeta = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { adAccountId } = req.body;

    const params = {
      TableName: process.env.ONBOARDING_TABLE_NAME || 'Onboarding',
      Key: { userId },
      UpdateExpression: 'SET step4 = :step4',
      ExpressionAttributeValues: {
        ':step4': { adAccountId }
      }
    };

    await docClient.send(new UpdateCommand(params));

    res.json({ message: 'Meta credentials updated successfully' });
  } catch (error) {
    console.error('Update Meta error:', error);
    res.status(500).json({ error: 'Failed to update Meta credentials' });
  }
};

/**
 * Update Shiprocket credentials
 * PUT /api/user/profile/shiprocket
 */
const updateShiprocket = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { shiproactId, shiproactPassword } = req.body;

    const params = {
      TableName: process.env.ONBOARDING_TABLE_NAME || 'Onboarding',
      Key: { userId },
      UpdateExpression: 'SET step5 = :step5',
      ExpressionAttributeValues: {
        ':step5': { shiproactId, shiproactPassword }
      }
    };

    await docClient.send(new UpdateCommand(params));

    res.json({ message: 'Shiprocket credentials updated successfully' });
  } catch (error) {
    console.error('Update Shiprocket error:', error);
    res.status(500).json({ error: 'Failed to update Shiprocket credentials' });
  }
};

module.exports = {
  getProfile,
  updateBasicProfile,
  updateShopify,
  updateMeta,
  updateShiprocket
};
