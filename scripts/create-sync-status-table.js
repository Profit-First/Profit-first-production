/**
 * Create sync_status DynamoDB table
 * 
 * This table stores real-time sync progress for users
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');

// Initialize DynamoDB client
const dynamoDBClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function createSyncStatusTable() {
  console.log('🚀 Creating sync_status table...');
  
  const params = {
    TableName: 'sync_status',
    KeySchema: [
      {
        AttributeName: 'userId',
        KeyType: 'HASH' // Partition key
      }
    ],
    AttributeDefinitions: [
      {
        AttributeName: 'userId',
        AttributeType: 'S'
      }
    ],
    BillingMode: 'PAY_PER_REQUEST' // On-demand pricing
  };

  try {
    const command = new CreateTableCommand(params);
    const result = await dynamoDBClient.send(command);
    
    console.log('✅ sync_status table created successfully!');
    console.log('Table ARN:', result.TableDescription.TableArn);
    
    return result;
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('ℹ️  sync_status table already exists');
      return { success: true, message: 'Table already exists' };
    } else {
      console.error('❌ Error creating sync_status table:', error.message);
      throw error;
    }
  }
}

// Run if called directly
if (require.main === module) {
  createSyncStatusTable()
    .then(() => {
      console.log('🎉 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createSyncStatusTable };