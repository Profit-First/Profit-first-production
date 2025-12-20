/**
 * DynamoDB Tables Creation Script
 * Creates all required tables for Profit First application
 */

// Load environment variables
require('dotenv').config();

const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

// Initialize DynamoDB client
const dynamoDBClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

console.log('🔑 Using AWS credentials:');
console.log(`   Region: ${process.env.AWS_REGION || 'ap-south-1'}`);
console.log(`   Access Key: ${process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 10) + '...' : 'NOT SET'}`);
console.log(`   Secret Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '***' + process.env.AWS_SECRET_ACCESS_KEY.substring(process.env.AWS_SECRET_ACCESS_KEY.length - 4) : 'NOT SET'}`);
console.log('');

// Table definitions
const tables = [
  {
    name: 'Users',
    keySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' }
    ],
    attributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' }
    ]
  },
  {
    name: 'Onboarding',
    keySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' }
    ],
    attributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' }
    ]
  },
  {
    name: 'shopify_products',
    keySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'productId', KeyType: 'RANGE' }
    ],
    attributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'productId', AttributeType: 'S' }
    ]
  },
  {
    name: 'shopify_orders',
    keySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'orderId', KeyType: 'RANGE' }
    ],
    attributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'orderId', AttributeType: 'S' }
    ]
  },
  {
    name: 'shopify_customers',
    keySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'customerId', KeyType: 'RANGE' }
    ],
    attributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'customerId', AttributeType: 'S' }
    ]
  },
  {
    name: 'shopify_connections',
    keySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' }
    ],
    attributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' }
    ]
  },
  {
    name: 'meta_connections',
    keySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' }
    ],
    attributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' }
    ]
  },
  {
    name: 'meta_insights',
    keySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'date', KeyType: 'RANGE' }
    ],
    attributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'date', AttributeType: 'S' }
    ]
  },
  {
    name: 'shipping_connections',
    keySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' }
    ],
    attributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' }
    ]
  },
  {
    name: 'shiprocket_shipments',
    keySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'shipmentId', KeyType: 'RANGE' }
    ],
    attributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'shipmentId', AttributeType: 'S' }
    ]
  }
];

/**
 * Check if table exists
 */
async function tableExists(tableName) {
  try {
    const command = new DescribeTableCommand({ TableName: tableName });
    await dynamoDBClient.send(command);
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

/**
 * Create a DynamoDB table
 */
async function createTable(tableConfig) {
  const { name, keySchema, attributeDefinitions } = tableConfig;

  try {
    // Check if table already exists
    const exists = await tableExists(name);
    if (exists) {
      console.log(`✅ Table "${name}" already exists - skipping`);
      return;
    }

    console.log(`📝 Creating table: ${name}...`);

    const command = new CreateTableCommand({
      TableName: name,
      KeySchema: keySchema,
      AttributeDefinitions: attributeDefinitions,
      BillingMode: 'PAY_PER_REQUEST' // On-demand billing
    });

    await dynamoDBClient.send(command);
    console.log(`✅ Table "${name}" created successfully!`);
  } catch (error) {
    console.error(`❌ Error creating table "${name}":`, error.message);
    throw error;
  }
}

/**
 * Main function to create all tables
 */
async function createAllTables() {
  console.log('🚀 Starting DynamoDB tables creation...\n');
  console.log(`📍 Region: ${process.env.AWS_REGION || 'ap-south-1'}\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const table of tables) {
    try {
      const exists = await tableExists(table.name);
      if (exists) {
        skipCount++;
      } else {
        await createTable(table);
        successCount++;
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to create table "${table.name}":`, error.message);
      console.error('   Error details:', error);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   ✅ Created: ${successCount} tables`);
  console.log(`   ⏭️  Skipped: ${skipCount} tables (already exist)`);
  console.log(`   ❌ Failed: ${errorCount} tables`);
  console.log('='.repeat(50));

  if (errorCount === 0) {
    console.log('\n🎉 All tables are ready!');
    console.log('\n📋 Created/Verified tables:');
    tables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.name}`);
    });
  } else {
    console.log('\n⚠️  Some tables failed to create. Check errors above.');
  }
}

// Run the script
createAllTables()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
