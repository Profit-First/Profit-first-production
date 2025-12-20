const { generateScript, getConversationFlow, CALLING_SCRIPTS } = require('../config/calling-agent-script');

/**
 * Get script for order confirmation call
 */
exports.getOrderConfirmationScript = async (req, res) => {
  try {
    const { orderId, customerName, orderNumber, orderDate, productName, estimatedDelivery, deliveryAddress, paymentAmount, paymentMethod } = req.body;

    if (!orderId || !customerName) {
      return res.status(400).json({ 
        error: 'Order ID and customer name are required' 
      });
    }

    const customerData = {
      customerName,
      orderNumber: orderNumber || orderId,
      orderDate: orderDate || new Date().toLocaleDateString('hi-IN'),
      productName: productName || 'aapka product',
      estimatedDelivery: estimatedDelivery || '3-5 business days',
      deliveryAddress: deliveryAddress || 'aapke registered address',
      paymentAmount: paymentAmount || 'total amount',
      paymentMethod: paymentMethod || 'online payment',
      supportNumber: CALLING_SCRIPTS.COMMON.supportNumber
    };

    const script = generateScript('ORDER_CONFIRMATION', customerData);
    const flow = getConversationFlow('ORDER_CONFIRMATION');

    res.json({
      success: true,
      callType: 'ORDER_CONFIRMATION',
      script,
      conversationFlow: flow,
      customerData
    });

  } catch (error) {
    console.error('Error generating order confirmation script:', error);
    res.status(500).json({ 
      error: 'Failed to generate script',
      message: error.message 
    });
  }
};

/**
 * Get script for abandoned cart reminder call
 */
exports.getAbandonedCartScript = async (req, res) => {
  try {
    const { cartId, customerName, productName, discountPercent, offerCode } = req.body;

    if (!cartId || !customerName) {
      return res.status(400).json({ 
        error: 'Cart ID and customer name are required' 
      });
    }

    const customerData = {
      customerName,
      productName: productName || 'products',
      discountPercent: discountPercent || '10',
      offerCode: offerCode || 'CART10',
      supportNumber: CALLING_SCRIPTS.COMMON.supportNumber
    };

    const script = generateScript('ABANDONED_CART', customerData);
    const flow = getConversationFlow('ABANDONED_CART');

    res.json({
      success: true,
      callType: 'ABANDONED_CART',
      script,
      conversationFlow: flow,
      customerData
    });

  } catch (error) {
    console.error('Error generating abandoned cart script:', error);
    res.status(500).json({ 
      error: 'Failed to generate script',
      message: error.message 
    });
  }
};

/**
 * Get all available scripts (for reference)
 */
exports.getAllScripts = async (req, res) => {
  try {
    res.json({
      success: true,
      scripts: {
        orderConfirmation: CALLING_SCRIPTS.ORDER_CONFIRMATION,
        abandonedCart: CALLING_SCRIPTS.ABANDONED_CART,
        common: CALLING_SCRIPTS.COMMON
      }
    });
  } catch (error) {
    console.error('Error fetching scripts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch scripts',
      message: error.message 
    });
  }
};

/**
 * Test script generation with sample data
 */
exports.testScript = async (req, res) => {
  try {
    const { scriptType } = req.params;

    const sampleData = {
      ORDER_CONFIRMATION: {
        customerName: 'Rahul Kumar',
        orderNumber: 'PF12345',
        orderDate: '28 November 2025',
        productName: 'Premium Business Planner',
        estimatedDelivery: '2 December 2025',
        deliveryAddress: 'Mumbai, Maharashtra',
        paymentAmount: '₹1,299',
        paymentMethod: 'UPI',
        supportNumber: '1800-XXX-XXXX'
      },
      ABANDONED_CART: {
        customerName: 'Priya Sharma',
        productName: 'Profit First Book Bundle',
        discountPercent: '15',
        offerCode: 'CART15',
        supportNumber: '1800-XXX-XXXX'
      }
    };

    const data = sampleData[scriptType];
    if (!data) {
      return res.status(400).json({ 
        error: 'Invalid script type. Use ORDER_CONFIRMATION or ABANDONED_CART' 
      });
    }

    const script = generateScript(scriptType, data);
    const flow = getConversationFlow(scriptType);

    res.json({
      success: true,
      callType: scriptType,
      script,
      conversationFlow: flow,
      sampleData: data
    });

  } catch (error) {
    console.error('Error testing script:', error);
    res.status(500).json({ 
      error: 'Failed to test script',
      message: error.message 
    });
  }
};
