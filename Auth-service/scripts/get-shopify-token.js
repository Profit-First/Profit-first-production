/**
 * Get Shopify Access Token for a store
 */

require('dotenv').config();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ 
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
const docClient = DynamoDBDocumentClient.from(client);

const STORE_DOMAIN = "e23104-8c.myshopify.com";

async function getShopifyToken() {
  try {
    console.log(`\n🔍 Searching for Shopify connection: ${STORE_DOMAIN}\n`);

    const scanCommand = new ScanCommand({
      TableName: 'shopify_connections',
      FilterExpression: 'contains(shop, :domain)',
      ExpressionAttributeValues: {
        ':domain': STORE_DOMAIN
      }
    });

    const result = await docClient.send(scanCommand);
    
    if (result.Items && result.Items.length > 0) {
      const connection = result.Items[0];
      
      console.log('✅ Found Shopify connection!\n');
      console.log('Store Details:');
      console.log(`  Shop: ${connection.shop}`);
      console.log(`  User ID: ${connection.userId}`);
      console.log(`  Connected At: ${connection.connectedAt || 'N/A'}`);
      console.log(`  Has Access Token: ${!!connection.accessToken}`);
      
      if (connection.accessToken) {
        console.log(`\n🔑 Access Token: ${connection.accessToken}`);
        
        console.log('\n📋 cURL Command:');
        console.log(`curl -X GET "https://${STORE_DOMAIN}/admin/api/2024-01/orders.json?status=any&limit=50&created_at_min=2026-01-15T00:00:00Z&created_at_max=2026-02-13T23:59:59Z" \\`);
        console.log(`  -H "X-Shopify-Access-Token: ${connection.accessToken}" \\`);
        console.log(`  -H "Content-Type: application/json"`);
        
        console.log('\n📋 Postman Setup:');
        console.log(`Method: GET`);
        console.log(`URL: https://${STORE_DOMAIN}/admin/api/2024-01/orders.json?status=any&limit=50&created_at_min=2026-01-15T00:00:00Z&created_at_max=2026-02-13T23:59:59Z`);
        console.log(`\nHeaders:`);
        console.log(`  X-Shopify-Access-Token: ${connection.accessToken}`);
        console.log(`  Content-Type: application/json`);
      } else {
        console.log('\n❌ No access token found in connection');
      }
      
    } else {
      console.log('❌ No connection found for this store');
      console.log('\nTrying to find any Shopify connections...\n');
      
      const allScan = new ScanCommand({
        TableName: 'shopify_connections'
      });
      
      const allResult = await docClient.send(allScan);
      
      if (allResult.Items && allResult.Items.length > 0) {
        console.log(`Found ${allResult.Items.length} Shopify connection(s):`);
        allResult.Items.forEach((conn, i) => {
          console.log(`  ${i + 1}. Shop: ${conn.shop || conn.shopDomain || conn.storeName || 'N/A'} (User: ${conn.userId})`);
          if (i === 0) {
            console.log(`\n  Sample connection fields:`, Object.keys(conn));
          }
        });
        
        // Check if any match the domain
        const match = allResult.Items.find(c => 
          (c.shop && c.shop.includes('e23104-8c')) ||
          (c.shopDomain && c.shopDomain.includes('e23104-8c')) ||
          (c.storeName && c.storeName.includes('e23104-8c'))
        );
        
        if (match) {
          console.log(`\n✅ Found matching store!`);
          console.log(`  User ID: ${match.userId}`);
          console.log(`  Access Token: ${match.accessToken || 'N/A'}`);
        }
      } else {
        console.log('No Shopify connections found in database');
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

getShopifyToken()
  .then(() => {
    console.log('\n✅ Script completed\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
