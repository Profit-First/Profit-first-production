/**
 * Script to check Shiprocket connection status in DynamoDB
 * Usage: node scripts/check-shiprocket-connection.js <userId>
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const dynamoDB = DynamoDBDocumentClient.from(client);

async function checkShiprocketConnection(userId) {
  try {
    console.log(`\n🔍 Checking Shiprocket connection for user: ${userId}\n`);

    // Query the shipping_connections table
    const command = new GetCommand({
      TableName: process.env.SHIPPING_CONNECTIONS_TABLE || 'shipping_connections',
      Key: {
        userId: userId
      }
    });

    const result = await dynamoDB.send(command);

    if (!result.Item) {
      console.log('❌ No Shiprocket connection found for this user');
      return null;
    }

    const connection = result.Item;
    
    console.log('✅ Shiprocket connection found!\n');
    console.log('📊 Connection Details:');
    console.log('─────────────────────────────────────');
    console.log(`Platform: ${connection.platform || 'N/A'}`);
    console.log(`Email: ${connection.email || 'N/A'}`);
    console.log(`Company ID: ${connection.company_id || 'N/A'}`);
    console.log(`First Name: ${connection.first_name || 'N/A'}`);
    console.log(`Last Name: ${connection.last_name || 'N/A'}`);
    console.log(`Connected At: ${connection.connectedAt || 'N/A'}`);
    console.log(`Token Expires: ${connection.expiresAt || 'N/A'}`);
    console.log(`Has Token: ${connection.token ? 'Yes ✅' : 'No ❌'}`);
    console.log(`Has Password: ${connection.password ? 'Yes ✅' : 'No ❌'}`);
    
    // Check if token is expired
    if (connection.expiresAt) {
      const expiryDate = new Date(connection.expiresAt);
      const now = new Date();
      const isExpired = expiryDate < now;
      
      console.log(`\n🕐 Token Status: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`);
      
      if (isExpired) {
        const daysExpired = Math.floor((now - expiryDate) / (1000 * 60 * 60 * 24));
        console.log(`   Expired ${daysExpired} days ago`);
        
        if (connection.password) {
          console.log('\n💡 Token expired but password is stored - can auto-refresh');
        } else {
          console.log('\n⚠️  Token expired and no password stored - user must reconnect');
        }
      } else {
        const daysRemaining = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
        console.log(`   Valid for ${daysRemaining} more days`);
      }
    }

    console.log('\n─────────────────────────────────────\n');

    return connection;

  } catch (error) {
    console.error('❌ Error checking Shiprocket connection:', error.message);
    throw error;
  }
}

// Get userId from command line argument
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Usage: node scripts/check-shiprocket-connection.js <userId>');
  console.error('Example: node scripts/check-shiprocket-connection.js 01932dca-60a1-70e9-339a-44228e6e5fd8');
  process.exit(1);
}

checkShiprocketConnection(userId)
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
