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
  console.log(`   📧 Email: ${email}`);

  // Try multiple approaches as Shiprocket API can be finicky
  const attempts = [
    {
      name: 'Standard Request',
      config: {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }
    },
    {
      name: 'Postman-like Request',
      config: {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'PostmanRuntime/7.28.4',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        }
      }
    },
    {
      name: 'Mobile User Agent',
      config: {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
        }
      }
    }
  ];

  for (const attempt of attempts) {
    try {
      console.log(`   🔄 Trying: ${attempt.name}`);

      const response = await axios.post(
        'https://apiv2.shiprocket.in/v1/external/auth/login',
        {
          email: email.trim(),
          password: password
        },
        {
          ...attempt.config,
          timeout: 30000,
          validateStatus: function (status) {
            return status < 500; // Accept any status less than 500
          }
        }
      );

      console.log(`   📊 ${attempt.name} - Status: ${response.status}`);
      console.log(`   📊 Content-Type: ${response.headers['content-type']}`);

      // Check if we got HTML instead of JSON
      if (response.headers['content-type']?.includes('text/html')) {
        console.log(`   ❌ ${attempt.name} - Got HTML response, trying next approach...`);
        continue;
      }

      // Check for successful response
      if (response.status === 200 && response.data && response.data.token) {
        console.log(`   ✅ ${attempt.name} - Success!`);
        console.log(`   👤 User: ${response.data.first_name} ${response.data.last_name}`);
        console.log(`   🏢 Company ID: ${response.data.company_id}`);

        return {
          token: response.data.token,
          email: email.trim(),
          password: password,
          company_id: response.data.company_id,
          first_name: response.data.first_name,
          last_name: response.data.last_name,
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
        };
      }

      // Handle specific error responses
      if (response.status === 401) {
        throw new Error(`Invalid Shiprocket credentials. Please check your email and password. Email: ${email}`);
      }

      if (response.status === 403 && response.data && typeof response.data === 'object') {
        throw new Error(`Shiprocket authentication failed (403). Please check:
1. Email and password are correct
2. Account is active on app.shiprocket.in
3. API access is enabled in account settings
Email: ${email}`);
      }

      console.log(`   ⚠️  ${attempt.name} - Status ${response.status}, trying next approach...`);

    } catch (error) {
      console.log(`   ❌ ${attempt.name} failed:`, error.message);

      // If this is the last attempt, throw the error
      if (attempt === attempts[attempts.length - 1]) {
        // Handle network errors
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to Shiprocket API - connection refused. Please check your internet connection or try from a different network.');
        }

        if (error.code === 'ENOTFOUND') {
          throw new Error('Cannot resolve Shiprocket API domain. Please check your DNS settings or try from a different network.');
        }

        if (error.code === 'ETIMEDOUT') {
          throw new Error('Shiprocket API request timed out. Please try again or check your network connection.');
        }

        // If we got HTML responses, it's likely a network/proxy issue
        throw new Error(`Shiprocket API is not accessible from your network. This could be due to:
1. Corporate firewall blocking the request
2. ISP restrictions
3. Geographic blocking by Shiprocket
4. Network proxy interfering

Please try:
1. Using a different internet connection (mobile hotspot)
2. Contacting your network administrator
3. Using a VPN
4. Contacting Shiprocket support

Email attempted: ${email}`);
      }
    }
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
 * Get shipping connection from database
 */
async function getConnectionData(userId, platform) {
  const command = new GetCommand({
    TableName: SHIPPING_CONNECTIONS_TABLE,
    Key: {
      userId,
      platform
    }
  });

  const result = await dynamoDB.send(command);
  return result.Item;
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

    // Immediately test API after connecting (for Shiprocket)
    // We do this BEFORE sending response to ensure credentials are truly valid for API calls
    if (platform === 'Shiprocket' && connectionData.token) {
      console.log(`🧪 Testing Shiprocket API after connection...`);
      try {
        const testResult = await shiprocketService.testShiprocketAPI(connectionData.token);
        console.log(`✅ API test successful: ${testResult.data?.length || 0} shipments found\n`);
        connectionData.isApiWorking = true;

        // 🚀 TRIGGER BACKGROUND SYNC IMMEDIATELY
        shiprocketService.startBackgroundSync(userId, connectionData.token);

      } catch (testError) {
        console.warn(`⚠️  API test failed: ${testError.message}\n`);
        connectionData.isApiWorking = false;
        connectionData.apiError = testError.message;
        // We still consider connection successful as we got a token, but warn user
      }
    }

    if (!res.headersSent) {
      return res.status(200).json({
        success: true,
        message: `${platform} connected successfully`,
        platform,
        data: connectionData
      });
    }

  } catch (error) {
    console.error('❌ Shipping connection error:', error.message);

    // safe error extraction
    const errorDetails = error.response ? {
      status: error.response.status,
      data: error.response.data
    } : null;

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to connect shipping platform',
        message: error.message,
        details: errorDetails || 'No additional details available'
      });
    }
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
 * Test Shiprocket API connection
 * @route POST /api/shipping/sync
 * @access Protected
 */
async function syncShipments(req, res) {
  try {
    const userId = req.user.userId;

    console.log(`\n🧪 Testing Shiprocket API for user: ${userId}`);

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

    // Test API using service
    const testResult = await shiprocketService.testShiprocketAPI(token);

    res.json({
      success: true,
      message: `API test successful - found ${testResult.data?.length || 0} shipments`,
      count: testResult.data?.length || 0,
      data: testResult
    });

  } catch (error) {
    console.error('❌ Shiprocket API test error:', error);
    res.status(500).json({
      error: 'Failed to test Shiprocket API',
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

/**
 * Get shipping metrics (shipping spend, RTO, delivered, revenue)
 * @route GET /api/shipping/metrics
 * @access Protected
 */
async function getShippingMetrics(req, res) {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    console.log(`\n📊 Getting shipping metrics for user: ${userId}`);
    if (startDate || endDate) {
      console.log(`   📅 Date range: ${startDate || 'all'} to ${endDate || 'all'}`);
    }

    // Get connection to retrieve token
    const connection = await getConnectionData(userId, 'shiprocket');
    
    if (!connection || !connection.token) {
      return res.status(400).json({
        error: 'Shiprocket not connected',
        message: 'Please connect your Shiprocket account first'
      });
    }

    // Instead of calling Shiprocket API again, use the existing dashboard data
    // This ensures consistency and avoids duplicate API calls
    console.log(`   🔄 Fetching data from database (same as dashboard)...`);
    
    const shiprocketData = await shiprocketService.getShipments(userId);
    
    // Filter by date range
    const filteredData = shiprocketData.filter(item => {
      const dateStr = item.orderDate || item.createdAt;
      if (!dateStr) return false;
      
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        
        const dateOnly = d.toISOString().split('T')[0];
        return (!startDate || dateOnly >= startDate) && (!endDate || dateOnly <= endDate);
      } catch (error) {
        return false;
      }
    });

    console.log(`   📊 Filtered records: ${filteredData.length}`);

    // Calculate metrics using DASHBOARD logic
    const getStatus = (record) => {
      return (record.shipmentStatus || record.status || '').toUpperCase().trim();
    };

    const getStatusCode = (record) => {
      return parseInt(record.statusCode) || 0;
    };

    // Delivered Orders
    const deliveredRecords = filteredData.filter(r => {
      const status = getStatus(r);
      const code = getStatusCode(r);
      return status === 'DELIVERED' || code === 6 || code === 7 || code === 8;
    });
    const deliveredCount = deliveredRecords.length;

    // RTO Orders
    const rtoRecords = filteredData.filter(r => {
      const status = getStatus(r);
      const code = getStatusCode(r);
      return status === 'RTO DELIVERED' || status === 'RTO INITIATED' ||
        status.includes('RTO') || code === 9;
    });
    const rtoCount = rtoRecords.length;

    // Shipping Charges (from ALL shipments)
    const shippingCharges = filteredData.reduce((sum, r) => {
      const freight = parseFloat(r.freightCharges || r.shippingCharges || 0);
      return sum + freight;
    }, 0);

    // RTO Charges
    const rtoCharges = rtoRecords.reduce((sum, r) => {
      return sum + parseFloat(r.freightCharges || r.shippingCharges || 0);
    }, 0);

    // Revenue = SUM of delivered order totals (COD + Prepaid)
    // This matches the dashboard calculation
    let revenue = 0;
    let codRevenue = 0;
    let prepaidRevenue = 0;
    
    deliveredRecords.forEach(r => {
      const orderTotal = parseFloat(r.total || r.orderValue || r.totalAmount || r.amount || 0);
      revenue += orderTotal;
      
      // Track COD vs Prepaid
      const paymentMethod = (r.paymentMethod || '').toLowerCase();
      if (paymentMethod === 'cod') {
        codRevenue += orderTotal;
      } else if (paymentMethod === 'prepaid') {
        prepaidRevenue += orderTotal;
      }
    });

    console.log(`   💰 Revenue from ${deliveredCount} delivered orders: ₹${revenue.toFixed(2)}`);
    console.log(`      - COD Revenue: ₹${codRevenue.toFixed(2)}`);
    console.log(`      - Prepaid Revenue: ₹${prepaidRevenue.toFixed(2)}`);

    // Calculate rates
    const totalShipped = deliveredCount + rtoCount;
    const deliveryRate = totalShipped > 0 ? (deliveredCount / totalShipped) * 100 : 0;
    const rtoRate = totalShipped > 0 ? (rtoCount / totalShipped) * 100 : 0;

    // Count other statuses
    const canceledCount = filteredData.filter(s => getStatus(s) === 'CANCELED').length;
    const pendingCount = filteredData.filter(s => {
      const status = getStatus(s);
      return status === 'NEW' || status === 'PENDING' || status === 'PICKUP SCHEDULED';
    }).length;

    const result = {
      success: true,
      metrics: {
        shippingSpend: parseFloat(shippingCharges.toFixed(2)),
        rtoDeliveredCount: rtoCount,
        deliveredCount: deliveredCount,
        revenueEarned: parseFloat(revenue.toFixed(2)),
        totalShipments: filteredData.length,
        canceledCount: canceledCount,
        pendingCount: pendingCount,
        deliveryRate: parseFloat(deliveryRate.toFixed(2)),
        rtoRate: parseFloat(rtoRate.toFixed(2)),
        rtoCharges: parseFloat(rtoCharges.toFixed(2)),
        netShippingCost: parseFloat((shippingCharges - revenue).toFixed(2))
      },
      dateRange: {
        startDate: startDate || 'all',
        endDate: endDate || 'all'
      }
    };

    res.json(result);

  } catch (error) {
    console.error('❌ Get shipping metrics error:', error);
    res.status(500).json({
      error: 'Failed to get shipping metrics',
      message: error.message
    });
  }
}

module.exports = {
  connectPlatform,
  getConnection,
  disconnect,
  syncShipments,
  getShipments,
  getShippingMetrics
};
