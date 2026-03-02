/**
 * Check all fields in Shiprocket API response to find order amount
 */

require('dotenv').config();
const axios = require('axios');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const dynamoDB = DynamoDBDocumentClient.from(client);

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';
const USER_ID = '61d31d1a-a0c1-7076-812f-d55319141da2';

async function getShiprocketToken() {
  const command = new GetCommand({
    TableName: process.env.SHIPPING_CONNECTIONS_TABLE || 'shipping_connections',
    Key: { userId: USER_ID }
  });

  const result = await dynamoDB.send(command);
  return result.Item?.token;
}

async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 CHECKING ALL SHIPROCKET FIELDS');
    console.log('='.repeat(80));

    const token = await getShiprocketToken();
    
    const response = await axios.get(`${SHIPROCKET_API_BASE}/shipments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        page: 1,
        per_page: 50
      }
    });

    const shipments = response.data?.data || [];
    
    console.log('\n📦 First Delivered Shipment - ALL FIELDS:\n');
    
    const delivered = shipments.find(s => s.status === 'DELIVERED');
    
    if (delivered) {
      console.log(JSON.stringify(delivered, null, 2));
      
      console.log('\n' + '='.repeat(80));
      console.log('💰 POTENTIAL REVENUE FIELDS:');
      console.log('='.repeat(80));
      console.log(`\n   total: ${delivered.total}`);
      console.log(`   subtotal: ${delivered.subtotal}`);
      console.log(`   order_total: ${delivered.order_total}`);
      console.log(`   total_amount: ${delivered.total_amount}`);
      console.log(`   amount: ${delivered.amount}`);
      console.log(`   order_amount: ${delivered.order_amount}`);
      console.log(`   charges.cod_charges: ${delivered.charges?.cod_charges}`);
      console.log(`   charges.total_charges: ${delivered.charges?.total_charges}`);
      console.log(`   charges.freight_charges: ${delivered.charges?.freight_charges}`);
      
      // Check products array
      if (delivered.products && delivered.products.length > 0) {
        console.log(`\n   Products array exists with ${delivered.products.length} items`);
        console.log(`   First product:`, JSON.stringify(delivered.products[0], null, 2));
      }
    } else {
      console.log('No delivered shipment found in first 5 records');
    }

  } catch (error) {
    console.error('\n💥 Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

main();
