import axiosInstance from "../../axios";

const aiCalling = {
  /**
   * Make an AI-powered order status confirmation call
   * @param {Object} callData - Call configuration
   * @param {string} callData.customerName - Customer's name
   * @param {string} callData.phoneNumber - Customer's phone number (with country code)
   * @param {string} callData.orderId - Order ID
   * @param {string} callData.orderStatus - Order status (pending, confirmed, etc.)
   * @param {string} callData.language - Language code (e.g., 'hi-IN', 'en-IN')
   * @returns {Promise<Object>} Call result with success status and call ID
   */
  makeOrderStatusCall: async (callData) => {
    try {
      const response = await axiosInstance.post("/calling-agent/order-status", callData);
      return {
        success: true,
        callId: response.data.callId,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error("AI Calling Error:", error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || "Failed to initiate call"
      };
    }
  },

  /**
   * Make an AI-powered abandoned cart recovery call
   * @param {Object} callData - Call configuration
   * @param {string} callData.customerName - Customer's name
   * @param {string} callData.phoneNumber - Customer's phone number
   * @param {string} callData.cartValue - Cart value
   * @param {string} callData.language - Language code
   * @returns {Promise<Object>} Call result
   */
  makeAbandonedCartCall: async (callData) => {
    try {
      const response = await axiosInstance.post("/calling-agent/abandoned-cart", callData);
      return {
        success: true,
        callId: response.data.callId,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error("AI Calling Error:", error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || "Failed to initiate call"
      };
    }
  },

  /**
   * Get call history
   * @returns {Promise<Object>} Call history data
   */
  getCallHistory: async () => {
    try {
      const response = await axiosInstance.get("/calling-agent/history");
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error("Get Call History Error:", error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || "Failed to fetch call history"
      };
    }
  }
};

export default aiCalling;
