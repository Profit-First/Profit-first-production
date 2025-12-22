/**
 * Shipping Platform Controller
 * Handles connections to Shiprocket, Dilevery, Shipway, etc.
 */

const axios = require('axios');
const { PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');
const shiprocketService = require('../services/shiprocket.service');

const SHIPPING_CONNECTIONS_TABLE = process.env.SHIPPING_CONNECTIONS_TABLE || 'shipping_connections';

/**
 * Connect to Shiprocket
 */
async function connectShiprocket(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required for Shiprocket');
  }

  console.log(`   📧 Authenticating with Shiprocket...`);

  try {
    const response = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/auth/login',
      { email, password },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.data.token) {
      throw new Error('Failed to get Shiprocket token');
    }

    console.log(`   ✅ Shiprocket authenticated`);

    return {
      token: response.data.token,
      email: email,
      password: password, // Store for token refresh
      company_id: response.data.company_id,
      first_name: response.data.first_name,
      last_name: response.data.last_name,
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days
    };
  } catch (error) {
    if (error.response?.status === 403) {
      console.log(`   ❌ Shiprocket returned 403 Forbidden`);
      throw new Error('Shiprocket authentication failed (403 Forbidden). Please verify: 1) Your email and password are correct, 2) You can log into app.shiprocket.in with these credentials, 3) API access is enabled in your Shiprocket account');
    }
    if (error.response?.status === 401) {
      throw new Error('Invalid Shiprocket credentials. Please check your email and password.');
    }
    throw error;
  }
}

/**
 * Connect to Dilevery
 */
async function connectDilevery(access_token) {
  if (!access_token) {
    throw new Error('Access token is required for Dilevery');
  }

  console.log(`   🔑 Validating Dilevery token...`);

  const response = await axios.get(
    'https://api.dilevery.com/v1/user/profile',
    { headers: { 'Authorization': `Bearer ${access_token}` } }
  );

  console.log(`   ✅ Dilevery token validated`);

  return {
    token: access_token,
    user: response.data
  };
}

/**
 * Connect to Shipway
 */
async function connectShipway(email, license_key) {
  if (!email || !license_key) {
    throw new Error('Email and license key are required for Shipway');
  }

  console.log(`   📧 Authenticating with Shipway...`);

  const response = await axios.post(
    'https://shipway.in/api/PushOrderData',
    { username: email, license_key: license_key },
    { headers: { 'Content-Type': 'application/json' } }
  );

  console.log(`   ✅ Shipway authenticated`);

  return {
    email: email,
    license_key: license_key,
    validated: true
  };
}

/**
 * Connect to Ithink Logistics
 */
async function connectIthinkLogistics(access_token, secret_key) {
  if (!access_token || !secret_key) {
    throw new Error('Access token and secret key are required for Ithink Logistics');
  }

  console.log(`   🔑 Validating Ithink Logistics credentials...`);

  const response = await axios.get(
    'https://api.ithinklogistics.com/api_v3/order/list.json',
    {
      headers: {
        'access_token': access_token,
        'secret_key': secret_key
      }
    }
  );

  console.log(`   ✅ Ithink Logistics validated`);

  return {
    access_token: access_token,
    secret_key: secret_key,
    validated: true
  };
}

/**
 * Connect to Nimbuspost
 */
async function connectNimbuspost(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required for Nimbuspost');
  }

  console.log(`   📧 Authenticating with Nimbuspost...`);

  const response = await axios.post(
    'https://api.nimbuspost.com/v1/users/login',
    { email, password },
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (!response.data.data?.token) {
    throw new Error('Failed to get Nimbuspost token');
  }

  console.log(`   ✅ Nimbuspost authenticated`);

  return {
    token: response.data.data.token,
    email: email,
    user_id: response.data.data.user_id
  };
}

/**
 * Save shipping connection to database
 */
async function saveConnection(userId, platform, connectionData) {
  // Log what we're saving (mask password for security)
  const logData = { ...connectionData };
  if (logData.password) {
    logData.password = '***STORED***';
  }
  console.log(`   💾 Saving ${platform} connection:`, logData);
  
  const command = new PutCommand({
    TableName: SHIPPING_CONNECTIONS_TABLE,
    Item: {
      userId,
      platform,
      ...connectionData,
      status: 'active',
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });

  await dynamoDB.send(command);
  console.log(`   ✅ Connection saved to database`);
}

/**
 * Connect Shipping Platform
 * @route POST /api/shipping/connect
 * @access Protected
 */
async function connectPlatform(req, res) {
  try {
    const userId = req.user.userId;
    const { platform, email, password, access_token, secret_key } = req.body;

    console.log(`\n🚚 Connecting ${platform} for user: ${userId}`);

    if (!platform) {
      return res.status(400).json({ error: 'Platform is required' });
    }

    let connectionData = null;

    // Connect based on platform
    switch (platform) {
      case 'Shiprocket':
        connectionData = await connectShiprocket(email, password);
        break;
      case 'Dilevery':
        connectionData = await connectDilevery(access_token);
        break;
      case 'Shipway':
        connectionData = await connectShipway(email, password);
        break;
      case 'Ithink Logistics':
        connectionData = await connectIthinkLogistics(access_token, secret_key);
        break;
      case 'Nimbuspost':
        connectionData = await connectNimbuspost(email, password);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported platform' });
    }

    // Save connection to database
    await saveConnection(userId, platform, connectionData);

    console.log(`✅ ${platform} connected successfully`);

    // Immediately sync shipments after connecting (for Shiprocket)
    if (platform === 'Shiprocket' && connectionData.token) {
      console.log(`🔄 Auto-syncing shipments after connection...`);
      try {
        const syncResult = await shiprocketService.syncShipments(userId, connectionData.token);
        console.log(`✅ Auto-sync complete: ${syncResult.count} shipments\n`);
      } catch (syncError) {
        console.log(`⚠️  Auto-sync failed: ${syncError.message}\n`);
      }
    }

    res.json({
      success: true,
      message: `${platform} connected successfully`,
      platform,
      data: connectionData
    });

  } catch (error) {
    console.error('❌ Shipping connection error:', error);
    res.status(500).json({
      error: 'Failed to connect shipping platform',
      message: error.message
    });
  }
}

/**
 * Get shipping connection
 * @route GET /api/shipping/connection
 * @access Protected
 */
async function getConnection(req, res) {
  try {
    const userId = req.user.userId;

    const command = new GetCommand({
      TableName: SHIPPING_CONNECTIONS_TABLE,
      Key: { userId }
    });

    const result = await dynamoDB.send(command);

    if (!result.Item) {
      return res.status(404).json({
        connected: false,
        message: 'No shipping connection found'
      });
    }

    // Don't expose sensitive credentials
    const { token, access_token, secret_key, license_key, password, ...safeConnection } = result.Item;

    res.json({
      connected: true,
      connection: safeConnection
    });

  } catch (error) {
    console.error('Get shipping connection error:', error);
    res.status(500).json({ error: 'Failed to get connection' });
  }
}

/**
 * Disconnect shipping platform
 * @route DELETE /api/shipping/disconnect
 * @access Protected
 */
async function disconnect(req, res) {
  try {
    const userId = req.user.userId;

    const command = new PutCommand({
      TableName: SHIPPING_CONNECTIONS_TABLE,
      Item: {
        userId,
        status: 'disconnected',
        disconnectedAt: new Date().toISOString()
      }
    });

    await dynamoDB.send(command);

    res.json({
      success: true,
      message: 'Shipping platform disconnected'
    });

  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
}

/**
 * Sync shipments from Shiprocket
 * @route POST /api/shipping/sync
 * @access Protected
 */
async function syncShipments(req, res) {
  try {
    const userId = req.user.userId;

    console.log(`\n🔄 Syncing shipments for user: ${userId}`);

    // Get Shiprocket connection
    const command = new GetCommand({
      TableName: SHIPPING_CONNECTIONS_TABLE,
      Key: { userId }
    });

    const result = await dynamoDB.send(command);

    if (!result.Item || result.Item.platform !== 'Shiprocket') {
      return res.status(404).json({
        error: 'Shiprocket not connected',
        message: 'Please connect Shiprocket first'
      });
    }

    const token = result.Item.token;

    if (!token) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Please reconnect Shiprocket'
      });
    }

    // Sync shipments using service
    const syncResult = await shiprocketService.syncShipments(userId, token);

    res.json({
      success: true,
      message: `Synced ${syncResult.count} shipments successfully`,
      count: syncResult.count
    });

  } catch (error) {
    console.error('❌ Sync shipments error:', error);
    res.status(500).json({
      error: 'Failed to sync shipments',
      message: error.message
    });
  }
}

/**
 * Get shipments from database
 * @route GET /api/shipping/shipments
 * @access Protected
 */
async function getShipments(req, res) {
  try {
    const userId = req.user.userId;

    console.log(`\n📦 Getting shipments for user: ${userId}`);

    const shipments = await shiprocketService.getShipments(userId);

    res.json({
      success: true,
      count: shipments.length,
      shipments
    });

  } catch (error) {
    console.error('❌ Get shipments error:', error);
    res.status(500).json({
      error: 'Failed to get shipments',
      message: error.message
    });
  }
}

module.exports = {
  connectPlatform,
  getConnection,
  disconnect,
  syncShipments,
  getShipments
};
