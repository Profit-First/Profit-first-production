/**
 * Script to reconnect Shiprocket with new credentials
 * Usage: node scripts/reconnect-shiprocket.js <userId> <email> <password>
 */

require('dotenv').config();
const axios = require('axios');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const dynamoDB = DynamoDBDocumentClient.from(client);

async function authenticateShiprocket(email, password) {
  console.log(`\n🔐 Authenticating with Shiprocket...`);
  console.log(`📧 Email: ${email}\n`);

  try {
    const response = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/auth/login',
      {
        email: email.trim(),
        password: password
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.status === 200 && response.data && response.data.token) {
      console.log('✅ Authentication successful!\n');
      console.log('📊 User Details:');
      console.log(`   Name: ${response.data.first_name} ${response.data.last_name}`);
      console.log(`   Company ID: ${response.data.company_id}`);
      console.log(`   Email: ${response.data.email}`);
      
      return {
        token: response.data.token,
        email: email.trim(),
        password: password,
        company_id: response.data.company_id,
        first_name: response.data.first_name,
        last_name: response.data.last_name,
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
      };
    } else {
      throw new Error(`Unexpected response status: ${response.status}`);
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ Authentication failed:', error.response.status, error.response.data);
      throw new Error(`Shiprocket authentication failed: ${error.response.data?.message || error.response.statusText}`);
    } else {
      console.error('❌ Network error:', error.message);
      throw error;
    }
  }
}

async function saveConnection(userId, connectionData) {
  console.log(`\n💾 Saving connection to database...`);
  
  try {
    const command = new PutCommand({
      TableName: process.env.SHIPPING_CONNECTIONS_TABLE || 'shipping_connections',
      Item: {
        userId,
        platform: 'Shiprocket',
        ...connectionData,
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

    await dynamoDB.send(command);
    console.log('✅ Connection saved successfully!\n');
  } catch (error) {
    console.error('❌ Failed to save connection:', error.message);
    throw error;
  }
}

async function reconnectShiprocket(userId, email, password) {
  try {
    console.log('═══════════════════════════════════════');
    console.log('🚀 Shiprocket Reconnection Script');
    console.log('═══════════════════════════════════════');
    console.log(`User ID: ${userId}`);
    
    // Step 1: Authenticate with Shiprocket
    const connectionData = await authenticateShiprocket(email, password);
    
    // Step 2: Save to database
    await saveConnection(userId, connectionData);
    
    console.log('═══════════════════════════════════════');
    console.log('✅ Shiprocket reconnected successfully!');
    console.log('═══════════════════════════════════════');
    console.log('\n📝 Next steps:');
    console.log('   1. Refresh your dashboard');
    console.log('   2. Check that "Revenue Earned" and "Delivered Orders" now show data');
    console.log('   3. Token will auto-refresh for the next 10 days\n');
    
  } catch (error) {
    console.error('\n❌ Reconnection failed:', error.message);
    throw error;
  }
}

// Get arguments
const userId = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];

if (!userId || !email || !password) {
  console.error('❌ Usage: node scripts/reconnect-shiprocket.js <userId> <email> <password>');
  console.error('Example: node scripts/reconnect-shiprocket.js 01932dca-60a1-70e9-339a-44228e6e5fd8 email@example.com password123');
  process.exit(1);
}

reconnectShiprocket(userId, email, password)
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
