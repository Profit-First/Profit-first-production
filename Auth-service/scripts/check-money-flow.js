require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function checkMoneyFlow() {
  const userId = '61d31d1a-a0c1-7076-812f-d55319141da2'; // Lux Chrono
  
  // Fetch shiprocket shipments
  const shiprocketResult = await docClient.send(new QueryCommand({
    TableName: process.env.SHIPROCKET_SHIPMENTS_TABLE || 'shiprocket_shipments',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  }));
  
  const shipments = shiprocketResult.Items || [];
  console.log(`\n📦 Total Shipments: ${shipments.length}`);
  
  // Calculate shipping cost using freight_charges
  let totalFreightCharges = 0;
  let totalTotalCharges = 0;
  
  shipments.forEach(s => {
    const freight = parseFloat(s.freight_charges || s.freightCharges || 0);
    const total = parseFloat(s.totalCharges || s.total_charges || 0);
    
    totalFreightCharges += freight;
    totalTotalCharges += total;
  });
  
  console.log(`\n💰 Shipping Costs:`);
  console.log(`   freight_charges: ₹${totalFreightCharges.toFixed(2)}`);
  console.log(`   totalCharges: ₹${totalTotalCharges.toFixed(2)}`);
  
  // Check business expenses
  const expensesResult = await docClient.send(new QueryCommand({
    TableName: process.env.BUSINESS_EXPENSES_TABLE || 'business_expenses',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  }));
  
  const expenses = expensesResult.Items?.[0] || {};
  console.log(`\n💼 Business Expenses:`);
  console.log(`   agencyFees: ₹${expenses.agencyFees || 0}`);
  console.log(`   rtoHandlingFees: ₹${expenses.rtoHandlingFees || 0}`);
  console.log(`   staffFees: ₹${expenses.staffFees || 0}`);
  console.log(`   officeRent: ₹${expenses.officeRent || 0}`);
  console.log(`   otherExpenses: ₹${expenses.otherExpenses || 0}`);
  console.log(`   paymentGatewayFeePercent: ${expenses.paymentGatewayFeePercent || 0}%`);
}

checkMoneyFlow().catch(console.error);
