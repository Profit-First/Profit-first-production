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
 * Simple direct fetch from Shiprocket API - no filtering, no database
 */
async function testShiprocketAPI(token) {
  try {
    console.log(`🧪 Testing Shiprocket API directly...`);
    
    const response = await axios.get(`${SHIPROCKET_API_BASE}/shipments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        per_page: 50
      }
    });

    console.log(`✅ API Response Status: ${response.status}`);
    console.log(`📦 Raw API Data:`, JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Shiprocket API Test Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
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
 * Fetch orders directly from Shiprocket API with pagination (contains revenue data)
 */
async function fetchOrdersDirectly(token, options = {}) {
  try {
    console.log(`🔄 Fetching orders directly from Shiprocket API...`);
    
    const {
      startDate,
      endDate,
      maxPages = 10,
      perPage = 100
    } = options;
    
    let allOrders = [];
    let currentPage = 1;
    let hasMorePages = true;
    
    while (hasMorePages && currentPage <= maxPages) {
      console.log(`📄 Fetching page ${currentPage}...`);
      
      const params = {
        per_page: perPage,
        page: currentPage
      };
      
      // Add date filters if provided - Shiprocket API date format
      if (startDate) {
        // Convert YYYY-MM-DD to DD-MM-YYYY format for Shiprocket API
        const [year, month, day] = startDate.split('-');
        params.created_after = `${day}-${month}-${year}`;
      }
      if (endDate) {
        // Convert YYYY-MM-DD to DD-MM-YYYY format for Shiprocket API
        const [year, month, day] = endDate.split('-');
        params.created_before = `${day}-${month}-${year}`;
      }
      
      console.log(`📅 API Params:`, params);
      
      const response = await axios.get(`${SHIPROCKET_API_BASE}/orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params
      });
      
      const data = response.data;
      const orders = data.data || [];
      
      console.log(`   📦 Page ${currentPage}: ${orders.length} orders`);
      
      // Debug: Log first order structure to see available fields
      if (currentPage === 1 && orders.length > 0) {
        console.log(`🔍 Raw Shiprocket API order structure (first order):`, 
          JSON.stringify(orders[0], null, 2));
      }
      
      if (orders.length === 0) {
        hasMorePages = false;
      } else {
        // Filter orders by date range on client side for accuracy
        const filteredOrders = orders.filter(order => {
          if (!startDate || !endDate) return true; // No date filter
          
          // Try multiple date fields from the order
          const orderDate = order.channel_created_at || order.created_at;
          if (!orderDate) return true; // Include if no date available
          
          // Parse the date - handle different formats
          let parsedDate;
          try {
            // Handle "24 Jul 2019, 11:11 AM" format
            if (orderDate.includes(',')) {
              const datePart = orderDate.split(',')[0].trim(); // "24 Jul 2019"
              parsedDate = new Date(datePart + ' UTC'); // Parse in UTC to avoid timezone issues
            } else {
              parsedDate = new Date(orderDate);
            }
            
            // Convert to YYYY-MM-DD for comparison
            const orderDateStr = parsedDate.toISOString().split('T')[0];
            
            return orderDateStr >= startDate && orderDateStr <= endDate;
          } catch (error) {
            console.warn(`Failed to parse order date: ${orderDate}`);
            return true; // Include if date parsing fails
          }
        });
        
        console.log(`   📅 Filtered ${filteredOrders.length} orders (from ${orders.length}) within date range`);
        
        // Convert to standardized format - extract shipment data from filtered orders
        const standardizedShipments = filteredOrders.flatMap(order => {
          // Each order can have multiple shipments
          return (order.shipments || []).map(shipment => ({
            // Order data
            orderId: order.channel_order_id?.toString() || order.id?.toString(),
            orderTotal: parseFloat(order.total || 0),
            orderTax: parseFloat(order.tax || 0),
            paymentMethod: order.payment_method,
            paymentStatus: order.payment_status,
            customerName: order.customer_name,
            customerEmail: order.customer_email,
            customerPhone: order.customer_phone,
            
            // Shipment data
            shipmentId: shipment.id?.toString(),
            awbCode: shipment.awb,
            courierName: shipment.courier,
            weight: shipment.weight,
            dimensions: shipment.dimensions,
            
            // Status mapping - use order status if shipment status not available
            status: mapShiprocketStatus(order.status, order.status_code),
            statusCode: order.status_code,
            
            // Dates - handle multiple date formats
            pickupDate: shipment.pickup_scheduled_date,
            deliveredDate: shipment.delivered_date,
            rtoDeliveredDate: shipment.rto_delivered_date,
            orderDate: order.channel_created_at || order.created_at,
            createdAt: order.created_at,
            
            // Parse order date for filtering
            parsedOrderDate: (() => {
              const dateStr = order.channel_created_at || order.created_at;
              if (!dateStr) return null;
              
              try {
                // Handle "24 Jul 2019, 11:11 AM" format
                if (dateStr.includes(',')) {
                  const datePart = dateStr.split(',')[0].trim(); // "24 Jul 2019"
                  // Parse in UTC to avoid timezone issues
                  const date = new Date(datePart + ' UTC');
                  return date.toISOString().split('T')[0];
                } else {
                  const date = new Date(dateStr);
                  return date.toISOString().split('T')[0];
                }
              } catch (error) {
                return null;
              }
            })(),
            
            // Revenue fields - use order total as the main revenue
            orderValue: parseFloat(order.total || 0),
            totalAmount: parseFloat(order.total || 0),
            amount: parseFloat(order.total || 0),
            total: parseFloat(order.total || 0),
            
            // COD specific
            codCharges: order.payment_method === 'cod' ? parseFloat(order.total || 0) : 0,
            
            // Shipping costs (if available)
            shippingCharges: 0, // Not available in orders endpoint
            totalCharges: 0,    // Not available in orders endpoint
            
            trackingUrl: null,
            etd: shipment.etd
          }));
        });
        
        allOrders = allOrders.concat(standardizedShipments);
        
        // Check if there are more pages
        if (orders.length < perPage) {
          hasMorePages = false;
        } else {
          currentPage++;
        }
      }
    }
    
    console.log(`✅ Fetched ${allOrders.length} total shipments from orders across ${currentPage - 1} pages`);
    
    return {
      success: true,
      shipments: allOrders, // Return as shipments for compatibility
      count: allOrders.length,
      pages: currentPage - 1
    };
    
  } catch (error) {
    console.error('❌ Error fetching orders directly:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Map Shiprocket status codes to readable status
 */
function mapShiprocketStatus(status, statusCode) {
  const statusMap = {
    1: 'Pickup Pending',
    2: 'Pickup Scheduled',
    3: 'In Transit',
    4: 'Out for Delivery',
    5: 'Cancelled',
    6: 'Delivered',
    7: 'Delivered',
    8: 'Delivered',
    9: 'RTO Delivered',
    10: 'RTO In Transit',
    11: 'Lost',
    17: 'NDR Pending',
    18: 'NDR'
  };
  
  return statusMap[statusCode] || status || 'Unknown';
}

/**
 * Fetch shipments directly from Shiprocket API with pagination
 */
async function fetchShipmentsDirectly(token, options = {}) {
  try {
    console.log(`🔄 Fetching shipments directly from Shiprocket API...`);
    
    const {
      startDate,
      endDate,
      maxPages = 10,
      perPage = 100
    } = options;
    
    let allShipments = [];
    let currentPage = 1;
    let hasMorePages = true;
    
    while (hasMorePages && currentPage <= maxPages) {
      console.log(`📄 Fetching page ${currentPage}...`);
      
      const params = {
        per_page: perPage,
        page: currentPage
      };
      
      // Add date filters if provided
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const response = await axios.get(`${SHIPROCKET_API_BASE}/shipments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params
      });
      
      const data = response.data;
      const shipments = data.data || [];
      
      console.log(`   📦 Page ${currentPage}: ${shipments.length} shipments`);
      
      // Debug: Log first shipment structure to see available fields
      if (currentPage === 1 && shipments.length > 0) {
        console.log(`🔍 Raw Shiprocket API shipment structure (first shipment):`, 
          JSON.stringify(shipments[0], null, 2));
      }
      
      if (shipments.length === 0) {
        hasMorePages = false;
      } else {
        // Convert to standardized format
        const standardizedShipments = shipments.map(s => ({
          shipmentId: s.id?.toString(),
          orderId: s.order_id?.toString(),
          awbCode: s.awb_code,
          courierName: s.courier_name,
          status: s.status,
          statusCode: s.status_code,
          pickupDate: s.pickup_date,
          deliveredDate: s.delivered_date,
          orderDate: s.order_date || s.created_at,
          createdAt: s.created_at,
          customerName: s.customer_name,
          customerEmail: s.customer_email,
          customerPhone: s.customer_phone,
          
          // Revenue fields - try multiple possible field names from Shiprocket API
          shippingCharges: parseFloat(s.shipping_charges || s.shippingCharges || 0),
          codCharges: parseFloat(s.cod_charges || s.codCharges || s.cod_amount || s.codAmount || 0),
          totalCharges: parseFloat(s.total_charges || s.totalCharges || 0),
          orderValue: parseFloat(s.order_value || s.orderValue || s.order_amount || s.orderAmount || 0),
          totalAmount: parseFloat(s.total_amount || s.totalAmount || 0),
          amount: parseFloat(s.amount || s.order_total || s.orderTotal || 0),
          
          // Additional possible revenue fields
          subtotal: parseFloat(s.subtotal || 0),
          total: parseFloat(s.total || 0),
          grandTotal: parseFloat(s.grand_total || s.grandTotal || 0),
          
          trackingUrl: s.tracking_url,
          etd: s.etd
        }));
        
        allShipments = allShipments.concat(standardizedShipments);
        
        // Check if there are more pages
        if (shipments.length < perPage) {
          hasMorePages = false;
        } else {
          currentPage++;
        }
      }
    }
    
    console.log(`✅ Fetched ${allShipments.length} total shipments across ${currentPage - 1} pages`);
    
    return {
      success: true,
      shipments: allShipments,
      count: allShipments.length,
      pages: currentPage - 1
    };
    
  } catch (error) {
    console.error('❌ Error fetching shipments directly:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
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
    orderDate: shipment.order_date || shipment.created_at,
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
    
    // Pricing - Save all possible revenue fields
    shippingCharges: parseFloat(shipment.shipping_charges || 0),
    codCharges: parseFloat(shipment.cod_charges || 0),
    totalCharges: parseFloat(shipment.total_charges || 0),
    orderValue: parseFloat(shipment.order_value || 0),
    totalAmount: parseFloat(shipment.total_amount || 0),
    amount: parseFloat(shipment.amount || 0),
    
    // Tracking
    trackingUrl: shipment.tracking_url,
    etd: shipment.etd,
    
    // Metadata
    syncedAt: new Date().toISOString(),
    createdAt: shipment.created_at,
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

module.exports = {
  testShiprocketAPI,
  fetchShipmentByAWB,
  fetchTrackingDetails,
  fetchShipmentsDirectly,
  fetchOrdersDirectly,
  mapShiprocketStatus,
  saveShipment,
  getShipments
};