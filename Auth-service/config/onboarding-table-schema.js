/**
 * DynamoDB Onboarding Table Schema
 * 
 * Separate table for storing detailed onboarding data
 * This keeps the Users table clean and allows for better querying
 */

module.exports = {
  TableName: 'Onboarding',
  
  // Primary Key
  KeySchema: [
    { AttributeName: 'userId', KeyType: 'HASH' }  // Partition key
  ],
  
  // Attribute Definitions
  AttributeDefinitions: [
    { AttributeName: 'userId', AttributeType: 'S' }
  ],
  
  // Provisioned Throughput (or use BillingMode: 'PAY_PER_REQUEST')
  BillingMode: 'PAY_PER_REQUEST',
  
  // Table Structure (not enforced by DynamoDB, but for documentation)
  Schema: {
    // Primary Key
    userId: 'String (UUID)',
    
    // Onboarding Status
    currentStep: 'Number (1-5)',
    isCompleted: 'Boolean',
    startedAt: 'String (ISO DateTime)',
    completedAt: 'String (ISO DateTime)',
    updatedAt: 'String (ISO DateTime)',
    
    // Step 1: Personal & Business Information
    step1: {
      fullName: 'String',
      email: 'String',
      phone: 'String',
      whatsapp: 'String',
      industry: 'String (E-commerce, Technology, etc.)',
      referral: 'String (Google Search, YouTube, etc.)',
      completedAt: 'String (ISO DateTime)'
    },
    
    // Step 2: Shopify Store Connection
    step2: {
      storeUrl: 'String',
      apiKey: 'String',
      apiSecret: 'String',
      accessToken: 'String',
      completedAt: 'String (ISO DateTime)'
    },
    
    // Step 3: Product Costs
    step3: {
      productCosts: [
        {
          productId: 'String',
          cost: 'Number'
        }
      ],
      completedAt: 'String (ISO DateTime)'
    },
    
    // Step 4: Ad Account Connection
    step4: {
      adAccountId: 'String',
      platform: 'String (Meta)',
      completedAt: 'String (ISO DateTime)'
    },
    
    // Step 5: Shipping Account Connection
    step5: {
      platform: 'String (Shiprocket, Shipway, Dilevery, Ithink Logistics)',
      completedAt: 'String (ISO DateTime)'
    }
  }
};
