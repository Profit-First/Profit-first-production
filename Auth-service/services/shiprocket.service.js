/**
 * Shiprocket Service
 * Handles Shiprocket API calls and data synchronization
 */

const axios = require('axios');
const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';
const SHIPMENTS_TABLE = process.env.SHIPROCKET_SHIPMENTS_TABLE || 'shiprocket_shipments';

/**
 * Fetch all shipments from Shiprocket
 */
async function fetchShipments(token, userId) {
  try {
    console.log(`\n📦 Fetching shipments from Shiprocket...`);

    const response = await axios.get(`${SHIPROCKET_API_BASE}/shipments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        per_page: 100 // Max per page
      }
    });

    const shipments = response.data.data || [];
    console.log(`✅ Fetched ${shipments.length} shipments`);

    // Store shipments in database
    let savedCount = 0;
    for (const shipment of shipments) {
      await saveShipment(userId, shipment);
      savedCount++;
    }

    console.log(`💾 Saved ${savedCount} shipments to database`);

    return {
      success: true,
      count: shipments.length,
      shipments
    };

  } catch (error) {
    console.error('❌ Error fetching shipments:', error.message);
    throw error;
  }
}

/**
 * Fetch specific shipment by AWB code
 */
async function fetchShipmentByAWB(token, awbCode) {
  try {
    const response = await axios.get(`${SHIPROCKET_API_BASE}/courier/track/awb/${awbCode}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching shipment ${awbCode}:`, error.message);
    throw error;
  }
}

/**
 * Fetch shipment tracking details
 */
async function fetchTrackingDetails(token, shipmentId) {
  try {
    const response = await axios.get(`${SHIPROCKET_API_BASE}/courier/track/shipment/${shipmentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching tracking for ${shipmentId}:`, error.message);
    throw error;
  }
}

/**
 * Save shipment to database
 */
async function saveShipment(userId, shipment) {
  const item = {
    userId,
    shipmentId: shipment.id?.toString(),
    orderId: shipment.order_id?.toString(),
    awbCode: shipment.awb_code,
    courierName: shipment.courier_name,
    status: shipment.status,
    statusCode: shipment.status_code,
    
    // Shipment details
    pickupDate: shipment.pickup_date,
    deliveredDate: shipment.delivered_date,
    weight: shipment.weight,
    dimensions: shipment.dimensions,
    
    // Customer details
    customerName: shipment.customer_name,
    customerEmail: shipment.customer_email,
    customerPhone: shipment.customer_phone,
    
    // Address
    deliveryAddress: shipment.delivery_address,
    deliveryCity: shipment.delivery_city,
    deliveryState: shipment.delivery_state,
    deliveryPincode: shipment.delivery_pincode,
    
    // Pricing
    shippingCharges: parseFloat(shipment.shipping_charges || 0),
    codCharges: parseFloat(shipment.cod_charges || 0),
    totalCharges: parseFloat(shipment.total_charges || 0),
    
    // Tracking
    trackingUrl: shipment.tracking_url,
    etd: shipment.etd,
    
    // Metadata
    syncedAt: new Date().toISOString(),
    source: 'shiprocket_api'
  };

  const command = new PutCommand({
    TableName: SHIPMENTS_TABLE,
    Item: item
  });

  await dynamoDB.send(command);
}

/**
 * Get shipments from database
 */
async function getShipments(userId, filters = {}) {
  try {
    const command = new QueryCommand({
      TableName: SHIPMENTS_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await dynamoDB.send(command);
    return result.Items || [];
  } catch (error) {
    console.error('Error getting shipments from database:', error.message);
    return [];
  }
}

/**
 * Sync shipments (fetch from Shiprocket and save to database)
 */
async function syncShipments(userId, token) {
  try {
    console.log(`\n🔄 Syncing shipments for user: ${userId}`);
    
    const result = await fetchShipments(token, userId);
    
    console.log(`✅ Sync completed: ${result.count} shipments\n`);
    
    return result;
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    throw error;
  }
}

module.exports = {
  fetchShipments,
  fetchShipmentByAWB,
  fetchTrackingDetails,
  saveShipment,
  getShipments,
  syncShipments
};
