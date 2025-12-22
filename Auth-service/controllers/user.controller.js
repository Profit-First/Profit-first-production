/**
 * User Controller
 * Handles user profile and settings
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const SHIPPING_CONNECTIONS_TABLE = process.env.SHIPPING_CONNECTIONS_TABLE || 'shipping_connections';

/**
 * Get user profile
 * GET /api/user/profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const email = req.user.email; // From JWT token
    console.log(`📋 Getting profile for user: ${userId} (${email})`);

    // Get onboarding data (this contains user's settings)
    const onboardingParams = {
      TableName: process.env.ONBOARDING_TABLE_NAME || 'Onboarding',
      Key: { userId }
    };

    const onboardingResult = await docClient.send(new GetCommand(onboardingParams));
    const onboarding = onboardingResult.Item || {};

    // Get shipping connection data (for Shiprocket email)
    let shippingConnection = null;
    try {
      const shippingParams = {
        TableName: SHIPPING_CONNECTIONS_TABLE,
        Key: { userId }
      };
      const shippingResult = await docClient.send(new GetCommand(shippingParams));
      if (shippingResult.Item) {
        shippingConnection = {
          platform: shippingResult.Item.platform,
          email: shippingResult.Item.email,
          status: shippingResult.Item.status,
          connectedAt: shippingResult.Item.connectedAt
        };
        console.log(`✅ Found shipping connection: ${shippingConnection.platform} - ${shippingConnection.email}`);
      }
    } catch (shippingError) {
      console.log(`⚠️  Could not fetch shipping connection: ${shippingError.message}`);
    }

    // If we have shipping connection, use that email for step5
    if (shippingConnection && shippingConnection.email) {
      onboarding.step5 = {
        ...(onboarding.step5 || {}),
        shiproactId: shippingConnection.email,
        shiproactPassword: '' // Don't expose password
      };
    }

    // Extract name from onboarding step1 or use email
    const step1 = onboarding.step1 || {};
    const firstName = step1.firstName || step1.name || '';
    const lastName = step1.lastName || '';

    console.log(`✅ Profile loaded successfully`);

    res.json({
      userId: userId,
      email: email,
      firstName: firstName,
      lastName: lastName,
      onboarding: onboarding,
      shippingConnection: shippingConnection
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
