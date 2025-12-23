/**
 * Create sync_checkpoints DynamoDB table
 * Run this script once to create the table for checkpoint storage
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });

async function createCheckpointsTable() {
  console.log('📦 Creating sync_checkpoints table...\n');
  
  try {
    const command = new CreateTableCommand({
      TableName: 'sync_checkpoints',
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },  // Partition key
        { AttributeName: 'syncType', KeyType: 'RANGE' } // Sort key
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'syncType', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST', // On-demand pricing
      TimeToLiveSpecification: {
        Enabled: true,
        AttributeName: 'ttl'
      }
    });
    
    const result = await client.send(command);
    console.log('✅ Table created successfully!');
    console.log('   Table ARN:', result.TableDescription.TableArn);
    console.log('   Table Status:', result.TableDescription.TableStatus);
    console.log('\n⏳ Waiting for table to become ACTIVE...');
    
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('ℹ️  Table already exists');
    } else {
      console.error('❌ Error creating table:', error.message);
    }
  }
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config();
  createCheckpointsTable();
}

module.exports = { createCheckpointsTable };
