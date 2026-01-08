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
    if (currentPage === 1) {
      console.log(`🔍 Orders API response structure:`, {
        totalOrders: orders.length,
        hasData: !!data.data,
        firstOrderId: orders[0]?.id,
        firstOrderTotal: orders[0]?.total,
        firstOrderStatus: orders[0]?.status,
        firstOrderStatusCode: orders[0]?.status_code
      });
    }
    
    if (orders.length === 0) {
      console.log(`      ⚠️  No more orders found, stopping pagination`);
      hasMorePages = false;
    } else {
      // Process each order
      orders.forEach(order => {
        // Create a record for each shipment in the order
        const shipments = order.shipments && order.shipments.length > 0 
          ? order.shipments 
          : [{ id: `order-${order.id}`, awb: null, courier: 'No Shipment' }];
        
        shipments.forEach(shipment => {
          allOrders.push({
            // Order identification
            orderId: order.channel_order_id?.toString() || order.id?.toString(),
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
            
            // Shipping costs (will be updated from shipments API)
            shippingCharges: 0,
            totalCharges: 0,
            freightCharges: 0,
            
            // Source
            source: 'orders_api',
            channelName: order.channel_name
          });
        });
      });
      
      // Check pagination
      if (orders.length < perPage) {
        console.log(`      ✅ Last page reached (${orders.length} < ${perPage})`);
        hasMorePages = false;
      } else {
        currentPage++;
      }
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
        allShipments.push({
          shipmentId: shipment.id?.toString(),
          orderId: shipment.order_id?.toString(),
          awbCode: shipment.awb,
          status: shipment.status,
          
          // Shipping costs from charges object
          freightCharges: parseFloat(shipment.charges?.freight_charges || 0),
          codCharges: parseFloat(shipment.charges?.cod_charges || 0),
          appliedWeightAmount: parseFloat(shipment.charges?.applied_weight_amount || 0),
          
          // Use freight_charges as main shipping cost
          shippingCharges: parseFloat(shipment.charges?.freight_charges || 0),
          totalCharges: parseFloat(shipment.charges?.freight_charges || 0),
          
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
  
  // Merge data
  const mergedData = orders.map(order => {
    const matchingShipment = shipmentsMap.get(order.shipmentId);
    
    if (matchingShipment) {
      // Merge shipping costs from shipments API
      return {
        ...order,
        shippingCharges: matchingShipment.shippingCharges,
        totalCharges: matchingShipment.totalCharges,
        freightCharges: matchingShipment.freightCharges,
        appliedWeightAmount: matchingShipment.appliedWeightAmount,
        
        // Update status if shipment has more recent status
        shipmentStatus: matchingShipment.status,
        
        source: 'merged_apis'
      };
    }
    
    // If no matching shipment, return order without estimated shipping
    return {
      ...order,
      shippingCharges: order.shippingCharges || 0, // No estimate - actual data only
      totalCharges: order.totalCharges || 0,
      freightCharges: 0,
      source: 'orders_api_only'
    };
  });
  
  console.log(`   ✅ Merged data: ${mergedData.length} records`);
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
async function syncShiprocketOrders(userId, token, options = {}) {
  try {
    console.log(`\n🔄 Starting Shiprocket orders sync for user: ${userId}`);
    
    // Default to last 3 months
    const defaultStartDate = new Date();
    defaultStartDate.setMonth(defaultStartDate.getMonth() - 3);
    
    const syncOptions = {
      startDate: options.startDate || defaultStartDate.toISOString().split('T')[0],
      endDate: options.endDate || new Date().toISOString().split('T')[0],
      maxPages: options.maxPages || 50, // Increased for 3 months of data
      perPage: 50, // Reduced per page for rate limiting
      rateLimitDelay: options.rateLimitDelay || 1000, // 1 second between requests
      ...options
    };
    
    console.log(`📅 Sync date range: ${syncOptions.startDate} to ${syncOptions.endDate}`);
    console.log(`⚡ Rate limit: ${syncOptions.rateLimitDelay}ms between requests`);
    
    let allShipments = [];
    let currentPage = 1;
    let hasMorePages = true;
    let totalSaved = 0;
    
    while (hasMorePages && currentPage <= syncOptions.maxPages) {
      console.log(`📄 Fetching page ${currentPage}/${syncOptions.maxPages}...`);
      
      const params = {
        per_page: syncOptions.perPage,
        page: currentPage
      };
      
      // Add date filters - Shiprocket API format
      if (syncOptions.startDate) {
        const [year, month, day] = syncOptions.startDate.split('-');
        params.created_after = `${day}-${month}-${year}`;
      }
      if (syncOptions.endDate) {
        const [year, month, day] = syncOptions.endDate.split('-');
        params.created_before = `${day}-${month}-${year}`;
      }
      
      try {
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
        
        if (orders.length === 0) {
          hasMorePages = false;
        } else {
          // Filter orders by date range on client side for accuracy
          const filteredOrders = orders.filter(order => {
            if (!syncOptions.startDate || !syncOptions.endDate) return true;
            
            const orderDate = order.channel_created_at || order.created_at;
            if (!orderDate) return true;
            
            try {
              let parsedDate;
              if (orderDate.includes(',')) {
                const datePart = orderDate.split(',')[0].trim();
                parsedDate = new Date(datePart + ' UTC');
              } else {
                parsedDate = new Date(orderDate);
              }
              
              const orderDateStr = parsedDate.toISOString().split('T')[0];
              return orderDateStr >= syncOptions.startDate && orderDateStr <= syncOptions.endDate;
            } catch (error) {
              console.warn(`Failed to parse order date: ${orderDate}`);
              return true;
            }
          });
          
          console.log(`   📅 Filtered ${filteredOrders.length} orders within date range`);
          
          // Convert and save orders to database
          for (const order of filteredOrders) {
            try {
              // Each order can have multiple shipments
              const shipments = (order.shipments || []).map(shipment => ({
                userId,
                
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
                
                // Status mapping
                status: mapShiprocketStatus(order.status, order.status_code),
                statusCode: order.status_code,
                
                // Dates
                pickupDate: shipment.pickup_scheduled_date,
                deliveredDate: shipment.delivered_date,
                rtoDeliveredDate: shipment.rto_delivered_date,
                orderDate: order.channel_created_at || order.created_at,
                createdAt: order.created_at,
                
                // Revenue fields
                orderValue: parseFloat(order.total || 0),
                totalAmount: parseFloat(order.total || 0),
                amount: parseFloat(order.total || 0),
                total: parseFloat(order.total || 0),
                codCharges: order.payment_method === 'cod' ? parseFloat(order.total || 0) : 0,
                
                // Shipping costs (not available in orders endpoint)
                shippingCharges: 0,
                totalCharges: 0,
                
                // Metadata
                syncedAt: new Date().toISOString(),
                source: 'shiprocket_orders_api',
                
                // Parse order date for filtering
                parsedOrderDate: (() => {
                  const dateStr = order.channel_created_at || order.created_at;
                  if (!dateStr) return null;
                  
                  try {
                    if (dateStr.includes(',')) {
                      const datePart = dateStr.split(',')[0].trim();
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
                
                trackingUrl: null,
                etd: shipment.etd
              }));
              
              // Save each shipment to database
              for (const shipmentData of shipments) {
                if (shipmentData.shipmentId) { // Only save if we have a shipment ID
                  await saveShiprocketOrder(shipmentData);
                  totalSaved++;
                }
              }
              
            } catch (saveError) {
              console.error(`Error processing order ${order.id}:`, saveError.message);
            }
          }
          
          // Check if there are more pages
          if (orders.length < syncOptions.perPage) {
            hasMorePages = false;
          } else {
            currentPage++;
            
            // Rate limiting - wait between requests
            if (hasMorePages && syncOptions.rateLimitDelay > 0) {
              console.log(`   ⏳ Rate limiting: waiting ${syncOptions.rateLimitDelay}ms...`);
              await new Promise(resolve => setTimeout(resolve, syncOptions.rateLimitDelay));
            }
          }
        }
        
      } catch (apiError) {
        console.error(`API error on page ${currentPage}:`, apiError.message);
        
        // If rate limited, wait longer and retry
        if (apiError.response?.status === 429) {
          console.log(`   🚫 Rate limited, waiting 5 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue; // Retry same page
        }
        
        // For other errors, continue to next page
        currentPage++;
      }
    }
    
    console.log(`✅ Sync completed: ${totalSaved} shipments saved across ${currentPage - 1} pages`);
    
    // Update sync status
    await updateSyncStatus(userId, {
      lastSyncAt: new Date().toISOString(),
      totalRecords: totalSaved,
      dateRange: `${syncOptions.startDate} to ${syncOptions.endDate}`,
      status: 'completed'
    });
    
    return {
      success: true,
      totalSaved,
      pages: currentPage - 1,
      dateRange: `${syncOptions.startDate} to ${syncOptions.endDate}`
    };
    
  } catch (error) {
    console.error('❌ Shiprocket orders sync failed:', error.message);
    
    // Update sync status with error
    await updateSyncStatus(userId, {
      lastSyncAt: new Date().toISOString(),
      status: 'failed',
      error: error.message
    });
    
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
