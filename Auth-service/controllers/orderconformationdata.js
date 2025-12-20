/**
 * Order Confirmation Data Controller
 * 
 * Fetches customer order data from Shopify for order confirmation calls
 * Returns list of orders with customer details, order status, and payment info
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Get Order Confirmation Data
 * 
 * Fetches Shopify orders for the authenticated user
 * Filters and formats data for order confirmation display
 * 
 * @route GET /api/order-confirmation/data
 * @access Private (requires authentication)
 */
exports.getOrderConfirmationData = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated"
      });
    }

    console.log(`📦 Fetching order confirmation data for user: ${userId}`);

    // Get date range from query params (default: last 30 days)
    const { startDate, endDate } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    console.log(`📅 Date range: ${start.toISOString()} to ${end.toISOString()}`);

    // Query Shopify orders from DynamoDB
    const params = {
      TableName: process.env.SHOPIFY_ORDERS_TABLE || "ShopifyOrders",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId
      },
      ScanIndexForward: false // Sort by newest first
    };

    const result = await docClient.send(new QueryCommand(params));
    
    console.log(`✅ Found ${result.Items?.length || 0} orders in database`);
    
    // Log sample order structure for debugging
    if (result.Items && result.Items.length > 0) {
      console.log('📋 Sample order structure:', {
        orderId: result.Items[0].orderId,
        hasCustomer: !!result.Items[0].customer,
        hasCustomerName: !!result.Items[0].customerName,
        hasCustomerPhone: !!result.Items[0].customerPhone,
        hasShippingAddress: !!result.Items[0].shippingAddress,
        customerKeys: result.Items[0].customer ? Object.keys(result.Items[0].customer) : [],
        shippingKeys: result.Items[0].shippingAddress ? Object.keys(result.Items[0].shippingAddress) : []
      });
    }

    if (!result.Items || result.Items.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          orders: [],
          stats: {
            totalOrders: 0,
            confirmed: 0,
            cancelled: 0,
            pending: 0,
            modified: 0,
            confirmationRate: 0,
            totalValue: 0
          }
        }
      });
    }

    // Filter orders by date range
    const filteredOrders = result.Items.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= start && orderDate <= end;
    });

    console.log(`📊 ${filteredOrders.length} orders within date range`);

    // Transform orders for frontend with proper customer data extraction
    const orders = filteredOrders.map(order => {
      // Extract customer information from multiple possible locations
      const customer = order.customer || {};
      const shippingAddress = order.shippingAddress || order.shipping_address || {};
      const billingAddress = order.billingAddress || order.billing_address || {};
      
      // Get customer name - try multiple sources
      let customerName = "Unknown Customer";
      if (order.customerName) {
        customerName = order.customerName;
      } else if (customer.first_name || customer.last_name) {
        customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
      } else if (shippingAddress.first_name || shippingAddress.last_name) {
        customerName = `${shippingAddress.first_name || ''} ${shippingAddress.last_name || ''}`.trim();
      } else if (shippingAddress.name) {
        customerName = shippingAddress.name;
      } else if (billingAddress.first_name || billingAddress.last_name) {
        customerName = `${billingAddress.first_name || ''} ${billingAddress.last_name || ''}`.trim();
      } else if (billingAddress.name) {
        customerName = billingAddress.name;
      } else if (customer.name) {
        customerName = customer.name;
      }
      
      // Get customer phone - try multiple sources
      let customerPhone = "N/A";
      if (order.customerPhone) {
        customerPhone = order.customerPhone;
      } else if (customer.phone) {
        customerPhone = customer.phone;
      } else if (shippingAddress.phone) {
        customerPhone = shippingAddress.phone;
      } else if (billingAddress.phone) {
        customerPhone = billingAddress.phone;
      } else if (order.phone) {
        customerPhone = order.phone;
      }
      
      // Format phone number (remove spaces, add +91 if needed for Indian numbers)
      if (customerPhone && customerPhone !== "N/A") {
        customerPhone = customerPhone.replace(/\s+/g, '');
        // Add +91 if it's a 10-digit Indian number without country code
        if (customerPhone.length === 10 && !customerPhone.startsWith('+')) {
          customerPhone = `+91${customerPhone}`;
        }
      }
      
      // Get line items
      const lineItems = order.lineItems || order.line_items || [];
      const itemCount = lineItems.length;
      
      // Get total price
      const totalPrice = parseFloat(order.totalPrice || order.total_price || 0);
      
      return {
        orderId: order.orderId || order.id,
        orderNumber: order.orderNumber || order.name || order.order_number,
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: order.customerEmail || customer.email || order.email || "N/A",
        totalPrice: totalPrice,
        currency: order.currency || "INR",
        financialStatus: order.financialStatus || order.financial_status || "pending",
        fulfillmentStatus: order.fulfillmentStatus || order.fulfillment_status || null,
        createdAt: order.createdAt || order.created_at,
        lineItems: lineItems,
        shippingAddress: shippingAddress,
        billingAddress: billingAddress,
        tags: order.tags || "",
        note: order.note || "",
        // Additional fields for order confirmation
        paymentMethod: determinePaymentMethod(order),
        orderStatus: determineOrderStatus(order),
        itemCount: itemCount,
        // Call tracking fields
        callStatus: order.callStatus || "pending", // pending, called, confirmed, cancelled
        callAttempts: order.callAttempts || 0,
        lastCallDate: order.lastCallDate || null,
        callNotes: order.callNotes || ""
      };
    });

    // Log sample transformed order for verification
    if (orders.length > 0) {
      console.log('✅ Sample transformed order:', {
        orderId: orders[0].orderId,
        orderNumber: orders[0].orderNumber,
        customerName: orders[0].customerName,
        customerPhone: orders[0].customerPhone,
        totalPrice: orders[0].totalPrice,
        itemCount: orders[0].itemCount,
        paymentMethod: orders[0].paymentMethod,
        orderStatus: orders[0].orderStatus
      });
    }

    // Calculate statistics
    const stats = calculateStats(orders);

    console.log(`📈 Stats calculated:`, stats);

    return res.status(200).json({
      success: true,
      data: {
        orders,
        stats,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching order confirmation data:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch order confirmation data",
      message: error.message
    });
  }
};

/**
 * Update Order Call Status
 * 
 * Updates the call status after an order confirmation call
 * 
 * @route PUT /api/order-confirmation/update-status
 * @access Private
 */
exports.updateOrderCallStatus = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { orderId, callStatus, callNotes } = req.body;

    if (!userId || !orderId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    console.log(`📞 Updating call status for order ${orderId}: ${callStatus}`);

    // Update order in DynamoDB
    const params = {
      TableName: process.env.SHOPIFY_ORDERS_TABLE || "ShopifyOrders",
      Key: {
        userId: userId,
        orderId: orderId
      },
      UpdateExpression: "SET callStatus = :status, lastCallDate = :date, callAttempts = if_not_exists(callAttempts, :zero) + :one, callNotes = :notes",
      ExpressionAttributeValues: {
        ":status": callStatus,
        ":date": new Date().toISOString(),
        ":zero": 0,
        ":one": 1,
        ":notes": callNotes || ""
      },
      ReturnValues: "ALL_NEW"
    };

    const result = await docClient.send(new UpdateCommand(params));

    console.log(`✅ Order call status updated successfully`);

    return res.status(200).json({
      success: true,
      data: result.Attributes
    });

  } catch (error) {
    console.error("❌ Error updating order call status:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update order call status",
      message: error.message
    });
  }
};

/**
 * Helper Functions
 */

// Determine payment method from order data
function determinePaymentMethod(order) {
  const financialStatus = order.financialStatus || order.financial_status;
  const gateway = order.gateway || order.payment_gateway_names?.[0] || "";
  
  if (financialStatus === "paid" || financialStatus === "partially_paid") {
    return "Prepaid";
  }
  
  if (gateway.toLowerCase().includes("cod") || gateway.toLowerCase().includes("cash")) {
    return "COD";
  }
  
  // Check tags for COD
  const tags = (order.tags || "").toLowerCase();
  if (tags.includes("cod") || tags.includes("cash on delivery")) {
    return "COD";
  }
  
  return "COD"; // Default to COD for Indian market
}

// Determine order status for confirmation
function determineOrderStatus(order) {
  const financialStatus = order.financialStatus || order.financial_status;
  const fulfillmentStatus = order.fulfillmentStatus || order.fulfillment_status;
  const callStatus = order.callStatus;

  // If call status is set, use that
  if (callStatus === "confirmed") return "confirmed";
  if (callStatus === "cancelled") return "cancelled";
  
  // Otherwise determine from order status
  if (fulfillmentStatus === "fulfilled") return "confirmed";
  if (financialStatus === "refunded" || financialStatus === "voided") return "cancelled";
  if (financialStatus === "paid" && !fulfillmentStatus) return "confirmed";
  
  return "pending";
}

// Calculate statistics from orders
function calculateStats(orders) {
  const totalOrders = orders.length;
  const confirmed = orders.filter(o => o.orderStatus === "confirmed").length;
  const cancelled = orders.filter(o => o.orderStatus === "cancelled").length;
  const pending = orders.filter(o => o.orderStatus === "pending").length;
  const modified = orders.filter(o => o.callNotes && o.callNotes.includes("modified")).length;
  
  const totalValue = orders.reduce((sum, order) => sum + order.totalPrice, 0);
  const confirmationRate = totalOrders > 0 ? ((confirmed / totalOrders) * 100).toFixed(1) : 0;

  return {
    totalOrders,
    confirmed,
    cancelled,
    pending,
    modified,
    confirmationRate: parseFloat(confirmationRate),
    totalValue: totalValue.toFixed(2)
  };
}
