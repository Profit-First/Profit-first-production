/**
 * Sync Shopify Orders to DynamoDB
 * Fetches orders from Shopify and saves to shopify_orders table
 */

require('dotenv').config();
const axios = require('axios');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

// Shopify credentials - REPLACE WITH YOUR VALUES
const SHOPIFY_STORE = process.env.SHOPIFY_STORE || 'your-store.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || 'your-shopify-token';
const USER_ID = process.env.USER_ID || 'your-user-id'; // Get from DynamoDB Users table

// Initialize DynamoDB
const dynamoDBClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const dynamoDB = DynamoDBDocumentClient.from(dynamoDBClient);

const SHOPIFY_API_VERSION = '2023-10';
const ORDERS_TABLE = process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders';

/**
 * Fetch ALL orders from Shopify with pagination
 */
async function fetchShopifyOrders() {
  try {
    console.log('🔍 Fetching orders from Shopify...');
    console.log(`   Store: ${SHOPIFY_STORE}`);
    
    let allOrders = [];
    let pageInfo = null;
    let pageCount = 0;
    
    do {
      pageCount++;
      const params = {
        status: 'any',
        limit: 250 // Max 250 orders per request
      };
      
      // Use cursor-based pagination (page_info) for subsequent requests
      if (pageInfo) {
        params.page_info = pageInfo;
      }
      
      const response = await axios.get(
        `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/orders.json`,
        {
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
          },
          params
        }
      );

      const orders = response.data.orders;
      allOrders = allOrders.concat(orders);
      console.log(`   📄 Page ${pageCount}: ${orders.length} orders (Total: ${allOrders.length})`);
      
      // Check for next page in Link header
      const linkHeader = response.headers.link;
      pageInfo = null;
      
      if (linkHeader) {
        // Parse Link header for next page
        const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]*)[^>]*>;\s*rel="next"/);
        if (nextMatch) {
          pageInfo = nextMatch[1];
        }
      }
      
    } while (pageInfo);

    console.log(`✅ Fetched ${allOrders.length} total orders from Shopify (${pageCount} pages)`);
    return allOrders;
  } catch (error) {
    console.error('❌ Error fetching Shopify orders:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Transform Shopify order to DynamoDB format
 */
function transformOrder(shopifyOrder) {
  return {
    userId: USER_ID,
    orderId: `shopify_${shopifyOrder.id}`,
    shopifyOrderId: shopifyOrder.id.toString(),
    orderNumber: shopifyOrder.order_number,
    email: shopifyOrder.email,
    createdAt: shopifyOrder.created_at,
    updatedAt: shopifyOrder.updated_at,
    totalPrice: shopifyOrder.total_price,
    subtotalPrice: shopifyOrder.subtotal_price,
    totalTax: shopifyOrder.total_tax,
    currency: shopifyOrder.currency,
    financialStatus: shopifyOrder.financial_status,
    fulfillmentStatus: shopifyOrder.fulfillment_status || 'unfulfilled',
    customerName: shopifyOrder.customer ? 
      `${shopifyOrder.customer.first_name || ''} ${shopifyOrder.customer.last_name || ''}`.trim() : 
      'Unknown',
    customerPhone: shopifyOrder.customer?.phone || shopifyOrder.shipping_address?.phone || '',
    customerEmail: shopifyOrder.customer?.email || shopifyOrder.email,
    shippingAddress: shopifyOrder.shipping_address ? {
      address1: shopifyOrder.shipping_address.address1,
      address2: shopifyOrder.shipping_address.address2,
      city: shopifyOrder.shipping_address.city,
      province: shopifyOrder.shipping_address.province,
      country: shopifyOrder.shipping_address.country,
      zip: shopifyOrder.shipping_address.zip,
      phone: shopifyOrder.shipping_address.phone
    } : null,
    lineItems: shopifyOrder.line_items.map(item => ({
      id: item.id.toString(),
      productId: item.product_id?.toString(),
      variantId: item.variant_id?.toString(),
      title: item.title,
      quantity: item.quantity,
      price: item.price,
      sku: item.sku,
      vendor: item.vendor
    })),
    tags: shopifyOrder.tags,
    note: shopifyOrder.note,
    gateway: shopifyOrder.gateway,
    test: shopifyOrder.test,
    cancelledAt: shopifyOrder.cancelled_at,
    cancelReason: shopifyOrder.cancel_reason,
    syncedAt: new Date().toISOString()
  };
}

/**
 * Save orders to DynamoDB in batches
 */
async function saveOrdersToDynamoDB(orders) {
  console.log(`\n💾 Saving ${orders.length} orders to DynamoDB...`);
  
  const batchSize = 25; // DynamoDB batch write limit
  let savedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    
    try {
      // Use individual PutCommand for better error handling
      for (const order of batch) {
        try {
          const transformedOrder = transformOrder(order);
          
          const command = new PutCommand({
            TableName: ORDERS_TABLE,
            Item: transformedOrder
          });

          await dynamoDB.send(command);
          savedCount++;
          console.log(`   ✅ Saved order #${order.order_number} (${savedCount}/${orders.length})`);
        } catch (error) {
          errorCount++;
          console.error(`   ❌ Failed to save order #${order.order_number}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`   ❌ Batch error:`, error.message);
      errorCount += batch.length;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Saved: ${savedCount} orders`);
  console.log(`   ❌ Failed: ${errorCount} orders`);
  
  return { savedCount, errorCount };
}

/**
 * Main function
 */
async function syncOrders() {
  try {
    console.log('🚀 Starting Shopify orders sync...\n');
    
    // Fetch orders from Shopify
    const orders = await fetchShopifyOrders();
    
    if (orders.length === 0) {
      console.log('⚠️  No orders found in Shopify');
      return;
    }

    // Save to DynamoDB
    const result = await saveOrdersToDynamoDB(orders);
    
    console.log('\n🎉 Sync completed!');
    console.log(`   Total orders processed: ${orders.length}`);
    console.log(`   Successfully saved: ${result.savedCount}`);
    console.log(`   Failed: ${result.errorCount}`);
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

// Run the sync
syncOrders()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
