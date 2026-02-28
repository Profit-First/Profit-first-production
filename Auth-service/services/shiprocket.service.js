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
 * Fetch comprehensive Shiprocket data using both Orders and Shipments APIs
 * This combines order data (revenue) with shipment data (shipping costs)
 */
async function fetchOrdersDirectly(token, options = {}) {
  try {
    console.log(`🔄 Fetching comprehensive Shiprocket data (Orders + Shipments)...`);

    const {
      startDate,
      endDate,
      maxPages = 20, // Increased to get more data
      perPage = 250   // Increased to 250 as requested
    } = options;

    console.log(`📊 Fetch settings: ${perPage} records per page, max ${maxPages} pages`);
    console.log(`📅 Date range: ${startDate} to ${endDate}`);

    // Step 1: Fetch Orders (contains revenue data)
    console.log(`📦 Step 1: Fetching orders from Shiprocket API...`);
    const ordersData = await fetchShiprocketOrders(token, { startDate, endDate, maxPages, perPage });

    // Step 2: Fetch Shipments (contains shipping costs)
    console.log(`🚚 Step 2: Fetching shipments from Shiprocket API...`);
    const shipmentsData = await fetchShiprocketShipments(token, { startDate, endDate, maxPages, perPage });

    // Step 3: Merge orders and shipments data
    console.log(`🔗 Step 3: Merging orders and shipments data...`);
    let mergedData = mergeOrdersAndShipments(ordersData, shipmentsData);

    // Step 4: Apply client-side date filtering (backup if API filter didn't work)
    if (startDate && endDate) {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      const beforeFilter = mergedData.length;

      mergedData = mergedData.filter(record => {
        // Try multiple date fields
        const dateStr = record.parsedOrderDate || record.orderDate || record.createdAt;
        if (!dateStr) return true; // Keep if no date

        const recordDate = new Date(dateStr);
        return recordDate >= start && recordDate <= end;
      });

      console.log(`📅 Date filter applied: ${beforeFilter} → ${mergedData.length} records`);
    }

    console.log(`✅ Comprehensive Shiprocket data fetched: ${mergedData.length} records`);
    console.log(`📈 Data breakdown:`);
    console.log(`   - Orders API: ${ordersData.orders?.length || 0} records`);
    console.log(`   - Shipments API: ${shipmentsData.shipments?.length || 0} records`);
    console.log(`   - After date filter: ${mergedData.length}`);

    // Debug: Show sample of fetched data
    if (mergedData.length > 0) {
      const sample = mergedData[0];
      console.log(`🔍 Sample record:`, {
        orderId: sample.orderId,
        total: sample.total,
        status: sample.status,
        statusCode: sample.statusCode,
        shippingCharges: sample.shippingCharges,
        orderDate: sample.orderDate,
        source: sample.source
      });
    }

    return {
      success: true,
      shipments: mergedData,
      count: mergedData.length,
      pages: Math.max(ordersData.pages || 1, shipmentsData.pages || 1)
    };

  } catch (error) {
    console.error('❌ Error fetching comprehensive Shiprocket data:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);

      // If 401 Unauthorized, token has expired
      if (error.response.status === 401) {
        console.error('   🔑 Token expired or invalid - user needs to reconnect Shiprocket');
        const tokenError = new Error('Shiprocket token expired. Please reconnect your Shiprocket account in Settings.');
        tokenError.code = 'TOKEN_EXPIRED';
        throw tokenError;
      }
    }
    throw error;
  }
}

/**
 * Fetch orders from Shiprocket Orders API
 */
async function fetchShiprocketOrders(token, options = {}) {
  const {
    startDate,
    endDate,
    maxPages = 20,  // Increased
    perPage = 250   // Increased to 250 as requested
  } = options;

  let allOrders = [];
  let currentPage = 1;
  let hasMorePages = true;
  const seenOrderIds = new Set(); // Track unique order IDs to detect duplicates

  console.log(`📦 Fetching orders: ${perPage} per page, max ${maxPages} pages`);

  while (hasMorePages && currentPage <= maxPages) {
    console.log(`   📄 Orders page ${currentPage}/${maxPages}...`);

    const params = {
      per_page: perPage,
      page: currentPage
    };

    // Add date filters - Shiprocket API format (DD-MM-YYYY)
    if (startDate) {
      const [year, month, day] = startDate.split('-');
      params.created_after = `${day}-${month}-${year}`;
    }
    if (endDate) {
      const [year, month, day] = endDate.split('-');
      params.created_before = `${day}-${month}-${year}`;
    }

    console.log(`      📅 API params:`, params);

    const response = await axios.get(`${SHIPROCKET_API_BASE}/orders`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params
    });

    const data = response.data;
    const orders = data.data || [];

    console.log(`      📦 Found ${orders.length} orders on page ${currentPage}`);

    // Debug: Log API response structure on first page
    if (currentPage === 1 && orders.length > 0) {
      console.log(`🔍 Orders API response structure:`, {
        totalOrders: orders.length,
        hasData: !!data.data,
        firstOrderId: orders[0]?.id,
        firstOrderTotal: orders[0]?.total,
        firstOrderStatus: orders[0]?.status,
        firstOrderStatusCode: orders[0]?.status_code,
        hasShipments: !!orders[0]?.shipments,
        shipmentsCount: orders[0]?.shipments?.length || 0
      });
      
      // Log first shipment structure
      if (orders[0]?.shipments && orders[0].shipments.length > 0) {
        const firstShipment = orders[0].shipments[0];
        console.log(`🔍 First shipment structure:`, {
          id: firstShipment.id,
          awb: firstShipment.awb,
          hasCharges: !!firstShipment.charges,
          freightCharges: firstShipment.charges?.freight_charges,
          chargesObject: firstShipment.charges
        });
      }
    }

    if (orders.length === 0) {
      console.log(`      ⚠️  No more orders found, stopping pagination`);
      hasMorePages = false;
      break;
    }

    // Check for duplicate orders (indicates API pagination issue)
    let newOrdersCount = 0;
    const pageOrderIds = orders.map(o => o.id?.toString()).filter(Boolean);
    
    // Count new orders but DON'T add to seenOrderIds yet
    for (const orderId of pageOrderIds) {
      if (!seenOrderIds.has(orderId)) {
        newOrdersCount++;
      }
    }

    if (newOrdersCount === 0) {
      console.log(`      ⚠️  All orders on this page are duplicates - stopping pagination`);
      hasMorePages = false;
      break;
    }

    console.log(`      ✅ ${newOrdersCount} new orders (${pageOrderIds.length - newOrdersCount} duplicates)`);

    // Process each order
    orders.forEach(order => {
      const orderId = order.id?.toString();
      
      // Skip if we've already processed this order
      if (!orderId || seenOrderIds.has(orderId)) {
        return;
      }

      // Mark as seen NOW (after checking)
      seenOrderIds.add(orderId);

      // Create a record for each shipment in the order
      const shipments = order.shipments && order.shipments.length > 0
        ? order.shipments
        : [{ id: `order-${order.id}`, awb: null, courier: 'No Shipment' }];

      shipments.forEach(shipment => {
        // Orders API does NOT include freight_charges in shipments
        // We'll get this from Shipments API later in the merge
        // For now, use the 'cost' field as a placeholder
        const estimatedCost = parseFloat(shipment.cost || 0);

        allOrders.push({
          // Order identification
          orderId: order.channel_order_id?.toString() || order.id?.toString(),
          channelOrderId: order.channel_order_id?.toString(), // Preserve original channel_order_id
          shiprocketOrderId: order.id?.toString(),
          shipmentId: shipment.id?.toString(),

          // Revenue data from order
          total: parseFloat(order.total || 0),
          orderValue: parseFloat(order.total || 0),
          totalAmount: parseFloat(order.total || 0),
          amount: parseFloat(order.total || 0),
          tax: parseFloat(order.tax || 0),

          // Payment info
          paymentMethod: order.payment_method,
          paymentStatus: order.payment_status,
          codCharges: order.payment_method === 'cod' ? parseFloat(order.total || 0) : 0,

          // Customer info
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          customerCity: order.customer_city,
          customerState: order.customer_state,
          customerPincode: order.customer_pincode,

          // Order status (use this for delivery status)
          status: order.status,
          statusCode: order.status_code,
          masterStatus: order.master_status,

          // Shipment info
          awbCode: shipment.awb,
          courierName: shipment.courier,
          weight: parseFloat(shipment.weight || 0),
          dimensions: shipment.dimensions,

          // Dates
          orderDate: order.channel_created_at || order.created_at,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          pickupDate: shipment.pickup_scheduled_date,
          deliveredDate: shipment.delivered_date,
          etd: shipment.etd,

          // Parse order date for filtering
          parsedOrderDate: parseShiprocketDate(order.channel_created_at || order.created_at),

          // Shipping costs - will be populated from Shipments API
          shippingCharges: estimatedCost,
          totalCharges: estimatedCost,
          freightCharges: 0, // Will be updated from Shipments API

          // Source
          source: 'orders_api',
          channelName: order.channel_name
        });
      });
    });

    // Check pagination - stop if we got fewer orders than requested OR all were duplicates
    if (orders.length < perPage || newOrdersCount === 0) {
      console.log(`      ✅ Last page reached`);
      hasMorePages = false;
    } else {
      currentPage++;
    }
  }

  console.log(`✅ Orders API: Fetched ${allOrders.length} total records across ${currentPage - 1} pages`);

  return {
    orders: allOrders,
    pages: currentPage - 1
  };
}

/**
 * Fetch shipments from Shiprocket Shipments API (contains shipping costs)
 */
async function fetchShiprocketShipments(token, options = {}) {
  const {
    startDate,
    endDate,
    maxPages = 20,  // Increased
    perPage = 250   // Increased to 250 as requested
  } = options;

  let allShipments = [];
  let currentPage = 1;
  let hasMorePages = true;

  console.log(`🚚 Fetching shipments: ${perPage} per page, max ${maxPages} pages`);

  while (hasMorePages && currentPage <= maxPages) {
    console.log(`   🚚 Shipments page ${currentPage}/${maxPages}...`);

    const params = {
      per_page: perPage,
      page: currentPage
    };

    // Add date filters if provided
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    console.log(`      📅 API params:`, params);

    const response = await axios.get(`${SHIPROCKET_API_BASE}/shipments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params
    });

    const data = response.data;
    const shipments = data.data || [];

    console.log(`      🚚 Found ${shipments.length} shipments on page ${currentPage}`);

    // Debug: Log API response structure on first page
    if (currentPage === 1) {
      console.log(`🔍 Shipments API response structure:`, {
        totalShipments: shipments.length,
        hasData: !!data.data,
        firstShipmentId: shipments[0]?.id,
        firstShipmentStatus: shipments[0]?.status,
        firstShipmentCharges: shipments[0]?.charges?.freight_charges
      });
    }

    if (shipments.length === 0) {
      console.log(`      ⚠️  No more shipments found, stopping pagination`);
      hasMorePages = false;
    } else {
      // Process each shipment
      shipments.forEach(shipment => {
        // Extract freight charges from charges object
        const charges = shipment.charges || {};
        const freightCharges = parseFloat(charges.freight_charges) || 0;
        
        allShipments.push({
          shipmentId: shipment.id?.toString(),
          orderId: shipment.order_id?.toString(),
          awbCode: shipment.awb,
          status: shipment.status,

          // Shipping costs from charges object
          freightCharges: freightCharges,
          codCharges: parseFloat(charges.cod_charges) || 0,
          appliedWeightAmount: parseFloat(charges.applied_weight_amount) || 0,

          // Use freight_charges as main shipping cost
          shippingCharges: freightCharges,
          totalCharges: freightCharges,

          // Additional info
          paymentMethod: shipment.payment_method,
          createdAt: shipment.created_at,
          channelName: shipment.channel_name,

          source: 'shipments_api'
        });
      });

      // Check pagination
      if (shipments.length < perPage) {
        console.log(`      ✅ Last page reached (${shipments.length} < ${perPage})`);
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }
  }

  console.log(`✅ Shipments API: Fetched ${allShipments.length} total records across ${currentPage - 1} pages`);

  return {
    shipments: allShipments,
    pages: currentPage - 1
  };
}

/**
 * Merge orders and shipments data to get complete picture
 */
function mergeOrdersAndShipments(ordersData, shipmentsData) {
  const orders = ordersData.orders || [];
  const shipments = shipmentsData.shipments || [];

  console.log(`   🔗 Merging ${orders.length} orders with ${shipments.length} shipments...`);

  // Create a map of shipments by shipment ID for quick lookup
  const shipmentsMap = new Map();
  shipments.forEach(shipment => {
    if (shipment.shipmentId) {
      shipmentsMap.set(shipment.shipmentId, shipment);
    }
  });

  console.log(`   📊 Shipments map size: ${shipmentsMap.size}`);

  // Merge data
  const mergedData = orders.map(order => {
    const matchingShipment = shipmentsMap.get(order.shipmentId);

    if (matchingShipment) {
      // Use freight charges from Shipments API (this is the actual cost)
      return {
        ...order,
        shippingCharges: matchingShipment.freightCharges,
        totalCharges: matchingShipment.freightCharges,
        freightCharges: matchingShipment.freightCharges,
        appliedWeightAmount: matchingShipment.appliedWeightAmount,

        // Update status if shipment has more recent status
        shipmentStatus: matchingShipment.status,

        source: 'merged_apis'
      };
    }

    // If no matching shipment, keep the estimated cost from Orders API
    return {
      ...order,
      source: 'orders_api_only'
    };
  });

  // Count how many got freight charges
  const withFreight = mergedData.filter(m => m.freightCharges > 0).length;
  console.log(`   ✅ Merged data: ${mergedData.length} records (${withFreight} with freight charges)`);
  
  return mergedData;
}

/**
 * Parse Shiprocket date format ("29 Dec 2025, 04:14 PM")
 */
function parseShiprocketDate(dateStr) {
  if (!dateStr) return null;

  try {
    // Handle "29 Dec 2025, 04:14 PM" format
    if (dateStr.includes(',')) {
      const datePart = dateStr.split(',')[0].trim(); // "29 Dec 2025"
      const date = new Date(datePart + ' UTC');
      return date.toISOString().split('T')[0];
    } else {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    console.warn(`Failed to parse Shiprocket date: ${dateStr}`);
    return null;
  }
}

/**
 * Map Shiprocket status codes to readable status
 * Updated based on real Shiprocket API data
 */
function mapShiprocketStatus(status, statusCode) {
  const statusMap = {
    // Pickup and Processing
    1: 'Pickup Pending',
    2: 'Pickup Scheduled',
    3: 'Picked Up',
    4: 'In Transit',
    5: 'Out for Delivery',

    // Delivered statuses
    6: 'Delivered',
    7: 'Delivered',
    8: 'Delivered',

    // Failed/Return statuses
    9: 'RTO Delivered',
    10: 'RTO In Transit',
    11: 'Lost',
    12: 'Cancelled',
    13: 'Damaged',
    14: 'Destroyed',
    15: 'Undelivered',
    16: 'Exception',
    17: 'NDR Pending',
    18: 'NDR',
    19: 'Misrouted',
    20: 'In Transit', // Based on your data showing "IN TRANSIT" with status_code 20
    21: 'Delayed',
    22: 'Partial Delivered',
    23: 'Return Initiated',
    24: 'Return in Progress',
    25: 'Return Delivered'
  };

  // If we have a mapped status, use it; otherwise use the raw status
  const mappedStatus = statusMap[statusCode];
  if (mappedStatus) {
    return mappedStatus;
  }

  // Fallback to raw status or default
  return status || 'Unknown';
}

/**
 * Save shipment to database
 */
async function saveShipment(userId, shipment) {
  // Extract shipmentId from multiple possible fields
  // IMPORTANT: Check shipmentId FIRST because that's what fetchShiprocketOrders creates
  let shipmentId = shipment.shipmentId?.toString() ||
                   shipment.id?.toString() || 
                   shipment.shipment_id?.toString();
  
  // Skip placeholder IDs like "order-123456"
  if (shipmentId && shipmentId.startsWith('order-')) {
    console.warn(`⚠️  Skipping placeholder shipment: ${shipmentId}, orderId=${shipment.orderId}, status=${shipment.status}`);
    return { skipped: true, reason: 'placeholder_id' };
  }
  
  // Skip if no shipmentId (required for DynamoDB)
  if (!shipmentId) {
    console.warn(`⚠️  Skipping shipment without ID: orderId=${shipment.order_id || shipment.orderId}, status=${shipment.status}`);
    return { skipped: true, reason: 'no_shipment_id' };
  }

  const item = {
    userId,
    shipmentId,
    orderId: shipment.order_id?.toString() || shipment.orderId?.toString(),
    awbCode: shipment.awb_code || shipment.awbCode,
    courierName: shipment.courier_name || shipment.courierName,
    status: shipment.status || shipment.shipmentStatus,
    statusCode: shipment.status_code || shipment.statusCode,

    // Shipment details
    pickupDate: shipment.pickup_date || shipment.pickupDate,
    deliveredDate: shipment.delivered_date || shipment.deliveredDate,
    orderDate: shipment.order_date || shipment.orderDate || shipment.created_at || shipment.createdAt,
    weight: shipment.weight,
    dimensions: shipment.dimensions,

    // Customer details
    customerName: shipment.customer_name || shipment.customerName,
    customerEmail: shipment.customer_email || shipment.customerEmail,
    customerPhone: shipment.customer_phone || shipment.customerPhone,

    // Address
    deliveryAddress: shipment.delivery_address || shipment.deliveryAddress,
    deliveryCity: shipment.delivery_city || shipment.deliveryCity,
    deliveryState: shipment.delivery_state || shipment.deliveryState,
    deliveryPincode: shipment.delivery_pincode || shipment.deliveryPincode,

    // Pricing - Save all possible revenue fields
    shippingCharges: parseFloat(shipment.shipping_charges || shipment.shippingCharges || 0),
    codCharges: parseFloat(shipment.cod_charges || shipment.codCharges || 0),
    totalCharges: parseFloat(shipment.total_charges || shipment.totalCharges || 0),
    orderValue: parseFloat(shipment.order_value || shipment.orderValue || 0),
    totalAmount: parseFloat(shipment.total_amount || shipment.totalAmount || 0),
    amount: parseFloat(shipment.amount || 0),

    // Tracking
    trackingUrl: shipment.tracking_url || shipment.trackingUrl,
    etd: shipment.etd,

    // Metadata
    syncedAt: new Date().toISOString(),
    createdAt: shipment.created_at || shipment.createdAt,
    source: shipment.source || 'shiprocket_api'
  };

  try {
    const command = new PutCommand({
      TableName: SHIPMENTS_TABLE,
      Item: item
    });

    await dynamoDB.send(command);
    return { saved: true };
  } catch (error) {
    console.error(`❌ Error saving shipment ${shipmentId}:`, error.message);
    return { skipped: true, reason: 'save_error', error: error.message };
  }
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
 * Sync Shiprocket orders to database with rate limiting and pagination
 */
/**
 * Sync Shiprocket orders to database with rate limiting and pagination
 */
/**
   * 🚀 START BACKGROUND SYNC (Non-blocking)
   * Fetches last 12 months of data in background
   */
function startBackgroundSync(userId, token) {
  console.log(`🚀 [Shiprocket] Triggering Background Sync for user: ${userId}`);
  // Run without await to make it non-blocking
  syncShiprocketOrders(userId, token).catch(err =>
    console.error(`❌ [Shiprocket] Background Sync Failed for ${userId}:`, err.message)
  );
}

/**
 * Sync Shiprocket orders AND shipments to database
 * Fetches incrementally page by page to avoid memory issues
 */
async function syncShiprocketOrders(userId, token, options = {}) {
  try {
    console.log(`\n🔄 [Shiprocket] Starting Sync Process for user: ${userId}`);
    console.log(`   📦 Using Shipments API (includes freight charges)`);

    // Default: Last 12 months
    const defaultStartDate = new Date();
    defaultStartDate.setMonth(defaultStartDate.getMonth() - 12);

    const startDate = options.startDate || defaultStartDate.toISOString().split('T')[0];
    const endDate = options.endDate || new Date().toISOString().split('T')[0];

    console.log(`📅 Sync Range: ${startDate} to ${endDate}`);

    // Fetch ALL shipments (Shipments API has everything we need)
    const shipmentsData = await fetchShiprocketShipments(token, {
      startDate,
      endDate,
      maxPages: options.maxPages || 50,
      perPage: options.perPage || 250
    });

    const shipments = shipmentsData.shipments || [];
    console.log(`   📊 Fetched ${shipments.length} shipments from API`);

    // Save to DynamoDB
    const saveResult = await saveShiprocketDataToDB(userId, shipments);
    
    console.log(`✅ [Shiprocket] Sync Complete! Total Records: ${saveResult.saved}`);
    return { success: true, totalRecords: saveResult.saved };

  } catch (error) {
    console.error(`❌ [Shiprocket] Sync Error:`, error.message);
    throw error;
  }
}



/**
 * Save Shiprocket order/shipment to database
 */
async function saveShiprocketOrder(shipmentData) {
  const command = new PutCommand({
    TableName: SHIPMENTS_TABLE,
    Item: shipmentData,
    // Use conditional put to avoid duplicates
    ConditionExpression: 'attribute_not_exists(shipmentId) OR syncedAt < :newSyncTime',
    ExpressionAttributeValues: {
      ':newSyncTime': shipmentData.syncedAt
    }
  });

  try {
    await dynamoDB.send(command);
  } catch (error) {
    // Ignore conditional check failures (duplicate records)
    if (error.name !== 'ConditionalCheckFailedException') {
      throw error;
    }
  }
}

/**
 * Update sync status in database
 */
async function updateSyncStatus(userId, statusData) {
  try {
    const command = new PutCommand({
      TableName: process.env.SYNC_STATUS_TABLE || 'shiprocket_sync_status',
      Item: {
        userId,
        ...statusData,
        updatedAt: new Date().toISOString()
      }
    });

    await dynamoDB.send(command);
  } catch (error) {
    console.error('Error updating sync status:', error.message);
  }
}

/**
 * Get Shiprocket orders from database (for dashboard)
 */
async function getShiprocketOrdersFromDB(userId, startDate, endDate) {
  try {
    console.log(`📊 Fetching Shiprocket orders from database for user: ${userId}`);
    console.log(`📅 Date range: ${startDate} to ${endDate}`);

    // Fetch all orders for the user with pagination
    let allOrders = [];
    let lastEvaluatedKey = null;

    do {
      const command = new QueryCommand({
        TableName: SHIPMENTS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'parsedOrderDate BETWEEN :startDate AND :endDate AND source = :source',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':startDate': startDate,
          ':endDate': endDate,
          ':source': 'shiprocket_orders_api'
        },
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
      });

      const result = await dynamoDB.send(command);
      allOrders = allOrders.concat(result.Items || []);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`📦 Found ${allOrders.length} Shiprocket orders in database for date range`);

    return allOrders;
  } catch (error) {
    console.error('Error fetching Shiprocket orders from database:', error.message);
    return [];
  }
}

/**
 * Get sync status
 */
async function getSyncStatus(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.SYNC_STATUS_TABLE || 'shiprocket_sync_status',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await dynamoDB.send(command);
    return result.Items?.[0] || null;
  } catch (error) {
    console.error('Error getting sync status:', error.message);
    return null;
  }
}

/**
 * Get Shiprocket data from DynamoDB with date filtering
 * Optimized for dashboard display - returns cached data if available
 * @param {string} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of shipment records from DB
 */
async function getShiprocketDataFromDB(userId, startDate, endDate) {
  try {
    console.log(`📊 Fetching Shiprocket data from DynamoDB...`);
    console.log(`   User: ${userId}, Range: ${startDate} to ${endDate}`);

    let filteredShipments = [];
    let lastEvaluatedKey = null;
    let totalScanned = 0;

    do {
      const command = new QueryCommand({
        TableName: SHIPMENTS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        // Fetch only necessary fields if possible, but we need most for the dashboard
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
      });

      const result = await dynamoDB.send(command);
      const items = result.Items || [];
      totalScanned += items.length;

      // Filter inside loop to avoid memory explosion
      for (const shipment of items) {
        // Filter by date range
        if (startDate && endDate) {
          const orderDate = shipment.parsedOrderDate ||
            (shipment.orderDate ? parseShiprocketDate(shipment.orderDate) : null);

          if (orderDate && orderDate >= startDate && orderDate <= endDate) {
            filteredShipments.push(shipment);
          }
        } else {
          // No date filter, keep all
          filteredShipments.push(shipment);
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`   📦 Found ${filteredShipments.length} shipments in DB (scanned ${totalScanned})`);
    return filteredShipments;
  } catch (error) {
    console.error('❌ Error fetching Shiprocket data from DynamoDB:', error.message);
    return [];
  }
}

/**
 * Save Shiprocket shipments to DynamoDB for caching
 * @param {string} userId - User ID
 * @param {Array} shipments - Array of shipment objects to save
 * @returns {Promise<{success: boolean, saved: number}>}
 */
/**
 * Save Shiprocket shipments to DynamoDB for caching
 * 
 * AUTOMATIC STORAGE FUNCTION:
 * This function persists the data fetched from the API into DynamoDB.
 * It is called automatically by getShiprocketDataWithCache() whenever fresh data is fetched.
 * This effectively creates a "background" store of data that makes future requests instance.
 * 
 * @param {string} userId - User ID
 * @param {Array} shipments - Array of shipment objects to save
 * @returns {Promise<{success: boolean, saved: number}>}
 */
async function saveShiprocketDataToDB(userId, shipments) {
  if (!shipments || shipments.length === 0) {
    console.log(`⚠️ No shipments to save to DB`);
    return { success: true, saved: 0 };
  }

  console.log(`💾 Saving ${shipments.length} Shiprocket shipments to DynamoDB...`);

  let savedCount = 0;
  const batchSize = 10; // Process 10 items in parallel (Safety limit)

  // Helper to save single shipment
  const saveShipment = async (shipment) => {
    try {
      // Generate a unique shipment ID if not present
      const shipmentId = shipment.shipmentId ||
        shipment.orderId ||
        `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const item = {
        userId,
        shipmentId: shipmentId.toString(),

        // Order identification
        orderId: (shipment.orderId || shipmentId).toString(),
        channelOrderId: shipment.channelOrderId?.toString() || null,
        shiprocketOrderId: shipment.shiprocketOrderId?.toString() || null,

        // Revenue data
        total: parseFloat(shipment.total || 0),
        orderValue: parseFloat(shipment.orderValue || 0),
        totalAmount: parseFloat(shipment.totalAmount || 0),
        amount: parseFloat(shipment.amount || 0),
        tax: parseFloat(shipment.tax || 0),

        // Payment info
        paymentMethod: shipment.paymentMethod || null,
        paymentStatus: shipment.paymentStatus || null,
        codCharges: parseFloat(shipment.codCharges || 0),

        // Customer info
        customerName: shipment.customerName || null,
        customerEmail: shipment.customerEmail || null,
        customerPhone: shipment.customerPhone || null,
        customerCity: shipment.customerCity || null,
        customerState: shipment.customerState || null,
        customerPincode: shipment.customerPincode || null,

        // Status
        status: shipment.status || null,
        statusCode: shipment.statusCode || null,
        masterStatus: shipment.masterStatus || null,
        shipmentStatus: shipment.shipmentStatus || null,

        // Shipment details
        awbCode: shipment.awbCode || null,
        courierName: shipment.courierName || null,
        weight: parseFloat(shipment.weight || 0),
        dimensions: shipment.dimensions || null,

        // Shipping costs
        shippingCharges: parseFloat(shipment.shippingCharges || 0),
        totalCharges: parseFloat(shipment.totalCharges || 0),
        freightCharges: parseFloat(shipment.freightCharges || 0),
        appliedWeightAmount: parseFloat(shipment.appliedWeightAmount || 0),

        // Dates
        orderDate: shipment.orderDate || null,
        parsedOrderDate: shipment.parsedOrderDate || parseShiprocketDate(shipment.orderDate),
        createdAt: shipment.createdAt || null,
        updatedAt: shipment.updatedAt || null,
        pickupDate: shipment.pickupDate || null,
        deliveredDate: shipment.deliveredDate || null,
        etd: shipment.etd || null,

        // Metadata
        source: shipment.source || 'shiprocket_api',
        channelName: shipment.channelName || null,
        syncedAt: new Date().toISOString(),

        // Tracking
        trackingUrl: shipment.trackingUrl || null
      };

      const command = new PutCommand({
        TableName: SHIPMENTS_TABLE,
        Item: item
      });

      await dynamoDB.send(command);
      return true; // Success
    } catch (error) {
      // Log but don't fail on individual record errors
      console.warn(`   ⚠️ Failed to save shipment ${shipment.shipmentId || shipment.orderId}:`, error.message);
      return false; // Failed
    }
  };

  for (let i = 0; i < shipments.length; i += batchSize) {
    const batch = shipments.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(s => saveShipment(s)));
    savedCount += results.filter(r => r).length;
  }

  console.log(`   ✅ Saved ${savedCount} of ${shipments.length} shipments to DynamoDB`);
  return { success: true, saved: savedCount };
}

/**
 * Get sync metadata for Shiprocket data
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} Sync metadata or null
 */
async function getShiprocketSyncMeta(userId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.SHIPROCKET_SYNC_META_TABLE || 'shiprocket_sync_meta',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await dynamoDB.send(command);
    return result.Items?.[0] || null;
  } catch (error) {
    // Table might not exist - that's okay, return null
    console.log(`📝 Sync meta table not found or error: ${error.message}`);
    return null;
  }
}

/**
 * Save sync metadata after successful API fetch
 * @param {string} userId - User ID
 * @param {object} metadata - Sync metadata
 */
async function saveShiprocketSyncMeta(userId, metadata) {
  try {
    const command = new PutCommand({
      TableName: process.env.SHIPROCKET_SYNC_META_TABLE || 'shiprocket_sync_meta',
      Item: {
        userId,
        lastSyncAt: new Date().toISOString(),
        recordCount: metadata.recordCount || 0,
        startDate: metadata.startDate || null,
        endDate: metadata.endDate || null,
        ...metadata
      }
    });

    await dynamoDB.send(command);
    console.log(`📝 Saved Shiprocket sync metadata`);
  } catch (error) {
    // Non-critical - log and continue
    console.warn(`⚠️ Could not save sync metadata: ${error.message}`);
  }
}

/**
 * Get Shiprocket data with intelligent caching
 * 
 * Strategy:
 * 1. Check if data exists in DynamoDB for the date range
 * 2. If data exists and was synced within CACHE_TTL, return cached data
 * 3. Otherwise, fetch from Shiprocket API and save to DB
 * 
 * @param {string} userId - User ID
 * @param {string} token - Shiprocket API token
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {object} options - Additional options
 * @returns {Promise<{success: boolean, shipments: Array, source: string}>}
 */
/**
 * Get Shiprocket data with intelligent caching
 * 
 * CRITICAL FOR ONBOARDING & DASHBOARD SPEED:
 * This function implements the "Lazy Load" + "Background Store" pattern.
 * 
 * Scenario 1: User just finished Onboarding (Step 5)
 * - Database is empty (no cache).
 * - This function detects "No cached data".
 * - It fetches fresh data from Shiprocket API (User waits a few seconds).
 * - It AUTOMATICALLY STORES this data to DynamoDB via saveShiprocketDataToDB().
 * - Next time, data loads instantly from DynamoDB.
 * 
 * Scenario 2: Recurring User
 * - Data exists in DynamoDB.
 * - Checks if data is fresh (within CACHE_TTL_HOURS).
 * - If fresh, returns DynamoDB data immediately (Fast).
 * - If stale, fetches API + Updates DynamoDB (Background refresh).
 * 
 * @param {string} userId - User ID
 * @param {string} token - Shiprocket API token
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {object} options - Additional options
 * @returns {Promise<{success: boolean, shipments: Array, source: string}>}
 */
async function getShiprocketDataWithCache(userId, token, startDate, endDate, options = {}) {
  const CACHE_TTL_HOURS = options.cacheTTLHours || 1; // Cache valid for 1 hour by default
  const forceRefresh = options.forceRefresh || false;

  console.log(`\n🚀 Fetching Shiprocket data with cache strategy...`);
  console.log(`   User: ${userId}`);
  console.log(`   Date Range: ${startDate} to ${endDate}`);
  console.log(`   Force Refresh: ${forceRefresh}`);
  console.log(`   Cache TTL: ${CACHE_TTL_HOURS} hours`);

  try {
    // Step 1: Check cache (DynamoDB Storage)
    // This is where we look for data potentially stored by background syncs.
    if (!forceRefresh) {
      const cachedData = await getShiprocketDataFromDB(userId, startDate, endDate);

      if (cachedData.length > 0) {
        // Check if cache is still fresh by looking at the most recent syncedAt
        const latestSync = cachedData.reduce((latest, item) => {
          const syncTime = item.syncedAt ? new Date(item.syncedAt).getTime() : 0;
          return syncTime > latest ? syncTime : latest;
        }, 0);

        const cacheAgeHours = (Date.now() - latestSync) / (1000 * 60 * 60);
        console.log(`   📊 Cache age: ${cacheAgeHours.toFixed(2)} hours`);

        if (cacheAgeHours < CACHE_TTL_HOURS) {
          console.log(`   ⚡ Returning cached data (${cachedData.length} records)`);
          return {
            success: true,
            shipments: cachedData,
            source: 'dynamodb_cache',
            cacheAge: cacheAgeHours
          };
        } else {
          console.log(`   ⏰ Cache is stale (${cacheAgeHours.toFixed(2)}h > ${CACHE_TTL_HOURS}h), fetching fresh data...`);
        }
      } else {
        console.log(`   📭 No cached data found (New user or first dashboard load), fetching from API...`);
      }
    }

    // Step 2: Fetch from Fresh Source (Shiprocket API)
    // If we are here, it means we need fresh data from the external API.
    if (!token) {
      console.log(`   ❌ No Shiprocket token provided`);
      return {
        success: false,
        shipments: [],
        source: 'none',
        error: 'No Shiprocket token'
      };
    }

    console.log(`   🌐 Fetching fresh data from Shiprocket API...`);
    const apiResult = await fetchOrdersDirectly(token, {
      startDate,
      endDate,
      maxPages: options.maxPages || 10,
      perPage: options.perPage || 250
    });

    if (!apiResult.success) {
      // If API fails but we have stale cache, return stale cache to avoid empty dashboard
      const staleCache = await getShiprocketDataFromDB(userId, startDate, endDate);
      if (staleCache.length > 0) {
        console.log(`   ⚠️ API failed, returning stale cache (${staleCache.length} records)`);
        return {
          success: true,
          shipments: staleCache,
          source: 'dynamodb_stale_cache',
          warning: 'API failed, using stale cache'
        };
      }

      return {
        success: false,
        shipments: [],
        source: 'api_failed',
        error: apiResult.error
      };
    }

    // Step 3: AUTOMATIC BACKGROUND STORAGE
    // This is the key part: We take the fresh data we just got and save it to DynamoDB.
    // This ensures the next request is fast and serves as our "Background Store".
    const shipments = apiResult.shipments || [];
    if (shipments.length > 0) {
      console.log(`   💾 AUTOMATICALLY STORING ${shipments.length} shipments to DynamoDB...`);
      await saveShiprocketDataToDB(userId, shipments);

      // Save sync metadata
      await saveShiprocketSyncMeta(userId, {
        recordCount: shipments.length,
        startDate,
        endDate
      });
    }

    console.log(`   ✅ Returning fresh API data (${shipments.length} records)`);
    return {
      success: true,
      shipments: shipments,
      source: 'shiprocket_api',
      freshData: true
    };

  } catch (error) {
    console.error(`   ❌ Error in getShiprocketDataWithCache:`, error.message);

    // Try to return cached data as fallback
    try {
      const fallbackCache = await getShiprocketDataFromDB(userId, startDate, endDate);
      if (fallbackCache.length > 0) {
        console.log(`   🔄 Returning fallback cache (${fallbackCache.length} records)`);
        return {
          success: true,
          shipments: fallbackCache,
          source: 'dynamodb_fallback',
          warning: `Error occurred, using fallback cache: ${error.message}`
        };
      }
    } catch (fallbackError) {
      console.error(`   ❌ Fallback cache also failed:`, fallbackError.message);
    }

    return {
      success: false,
      shipments: [],
      source: 'error',
      error: error.message
    };
  }
}

/**
 * Calculate shipping metrics from Shiprocket shipments data
 * Uses the SAME calculation logic as the dashboard
 * Returns: shipping spend, RTO count, delivered count, and revenue earned
 */
async function calculateShippingMetrics(token, options = {}) {
  try {
    console.log(`📊 Calculating shipping metrics...`);

    const {
      startDate,
      endDate,
      perPage = 250
    } = options;

    // Fetch all shipments from Shiprocket API with pagination
    let allShipments = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await axios.get(`${SHIPROCKET_API_BASE}/shipments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          page: currentPage,
          per_page: perPage,
          ...(startDate && { filter_by_date: `${startDate} to ${endDate}` })
        }
      });

      const shipments = response.data?.data || [];
      allShipments = allShipments.concat(shipments);

      console.log(`   📄 Page ${currentPage}: ${shipments.length} shipments`);

      // Check if there are more pages
      const pagination = response.data?.meta?.pagination;
      if (pagination && pagination.current_page < pagination.total_pages && shipments.length === perPage) {
        currentPage++;
      } else {
        hasMorePages = false;
      }

      // Safety limit
      if (currentPage > 50) {
        console.log(`   ⚠️ Reached page limit (50), stopping`);
        hasMorePages = false;
      }
    }

    console.log(`   ✅ Total shipments fetched: ${allShipments.length}`);

    // ========== USE DASHBOARD CALCULATION LOGIC ==========

    // Helper functions
    const getStatus = (record) => {
      return (record.status || '').toUpperCase().trim();
    };

    const getStatusCode = (record) => {
      return parseInt(record.status_code) || 0;
    };

    // Delivered Orders = COUNT(status = "DELIVERED")
    const deliveredRecords = allShipments.filter(r => {
      const status = getStatus(r);
      const code = getStatusCode(r);
      // Status code 6 = Delivered, 7 = Delivered (COD), 8 = Delivered (Prepaid)
      return status === 'DELIVERED' || code === 6 || code === 7 || code === 8;
    });
    const deliveredCount = deliveredRecords.length;

    // RTO Orders = COUNT(status IN ("RTO DELIVERED", "RTO INITIATED"))
    const rtoRecords = allShipments.filter(r => {
      const status = getStatus(r);
      const code = getStatusCode(r);
      // Status code 9 = RTO
      return status === 'RTO DELIVERED' || status === 'RTO INITIATED' ||
        status.includes('RTO') || code === 9;
    });
    const rtoCount = rtoRecords.length;

    // Shipping Charges = SUM(freight_charges) - from ALL shipped orders
    const shippingCharges = allShipments.reduce((sum, r) => {
      const charges = r.charges || {};
      const freight = parseFloat(charges.freight_charges || 0);
      return sum + freight;
    }, 0);

    // RTO Charges = SUM(freight_charges) from RTO orders only
    const rtoCharges = rtoRecords.reduce((sum, r) => {
      const charges = r.charges || {};
      const freight = parseFloat(charges.freight_charges || 0);
      return sum + freight;
    }, 0);

    // Revenue = SUM of delivered order totals (from COD charges for COD orders)
    let revenue = 0;
    deliveredRecords.forEach(r => {
      const charges = r.charges || {};
      const paymentMethod = (r.payment_method || '').toLowerCase();
      
      if (paymentMethod === 'cod') {
        const codCharges = parseFloat(charges.cod_charges || 0);
        revenue += codCharges;
      } else if (paymentMethod === 'prepaid') {
        // For prepaid, we would need order data, but for now use 0
        // In dashboard, this is matched with orders API
        revenue += 0;
      }
    });

    // Calculate rates
    const totalShipped = deliveredCount + rtoCount;
    const deliveryRate = totalShipped > 0 ? (deliveredCount / totalShipped) * 100 : 0;
    const rtoRate = totalShipped > 0 ? (rtoCount / totalShipped) * 100 : 0;

    // Count other statuses
    const canceledCount = allShipments.filter(s => getStatus(s) === 'CANCELED').length;
    const pendingCount = allShipments.filter(s => {
      const status = getStatus(s);
      return status === 'NEW' || status === 'PENDING' || status === 'PICKUP SCHEDULED';
    }).length;

    const metrics = {
      shippingSpend: parseFloat(shippingCharges.toFixed(2)),
      rtoDeliveredCount: rtoCount,
      deliveredCount: deliveredCount,
      revenueEarned: parseFloat(revenue.toFixed(2)),
      totalShipments: allShipments.length,
      canceledCount: canceledCount,
      pendingCount: pendingCount,
      // Additional useful metrics
      deliveryRate: parseFloat(deliveryRate.toFixed(2)),
      rtoRate: parseFloat(rtoRate.toFixed(2)),
      rtoCharges: parseFloat(rtoCharges.toFixed(2)),
      netShippingCost: parseFloat((shippingCharges - revenue).toFixed(2))
    };

    console.log(`   📊 Metrics calculated:`, metrics);

    return {
      success: true,
      metrics,
      dateRange: {
        startDate: startDate || 'all',
        endDate: endDate || 'all'
      }
    };

  } catch (error) {
    console.error(`❌ Error calculating shipping metrics:`, error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    throw error;
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
  getShipments,
  // New database-first caching functions
  getShiprocketDataFromDB,
  saveShiprocketDataToDB,
  getShiprocketDataWithCache,
  getShiprocketSyncMeta,
  saveShiprocketSyncMeta,
  startBackgroundSync,
  syncShiprocketOrders,
  // Shipping metrics
  calculateShippingMetrics
};
