/**
 * AWS Configuration
 * 
 * Initializes AWS SDK v3 clients for Cognito and DynamoDB
 * Uses environment variables for credentials and configuration
 */

const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

// AWS SDK v3 Configuration
const awsConfig = {
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
};

// Initialize DynamoDB Document Client
// Document Client automatically handles marshalling/unmarshalling of JavaScript objects
const ddbClient = new DynamoDBClient(awsConfig);
const dynamoDB = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    removeUndefinedValues: true // Remove undefined values from objects before sending to DynamoDB
  }
});

// Initialize Cognito Identity Provider Client
const cognito = new CognitoIdentityProviderClient(awsConfig);

// Export configured clients and environment variables
module.exports = {
  dynamoDB,
  cognito,
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID,
  clientSecret: process.env.COGNITO_CLIENT_SECRET, // Optional - only for confidential clients
  tableName: process.env.DYNAMODB_TABLE_NAME,
  // OAuth configuration for Cognito Hosted UI
  cognitoDomain: process.env.COGNITO_DOMAIN, // e.g., https://your-domain.auth.region.amazoncognito.com
  redirectUri: process.env.COGNITO_REDIRECT_URI // e.g., http://localhost:3000/api/auth/oauth/callback
};
