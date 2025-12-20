/**
 * AWS Connect Calling Agent Script for Profit First
 * 
 * This script defines the conversation flow and responses for:
 * 1. Order Confirmation Calls
 * 2. Abandoned Cart Reminder Calls
 */

const CALLING_SCRIPTS = {
  // Order Confirmation Script
  ORDER_CONFIRMATION: {
    greeting: `Namaste! Main Profit First se bol rahi hoon. Kya main {{customerName}} se baat kar rahi hoon?`,
    
    confirmIdentity: {
      yes: `Bahut achha! Main aapke order confirmation ke liye call kar rahi hoon.`,
      no: `Koi baat nahi. Kya aap {{customerName}} ko phone de sakte hain?`
    },

    orderDetails: `Aapne {{orderDate}} ko {{productName}} order kiya tha. Aapka order number hai {{orderNumber}}.`,

    deliveryInfo: `Aapka order {{estimatedDelivery}} tak deliver ho jayega {{deliveryAddress}} pe.`,

    paymentConfirmation: `Aapne {{paymentAmount}} rupees ka payment successfully kar diya hai {{paymentMethod}} se.`,

    thankYou: `Profit First choose karne ke liye dhanyavaad! Agar koi sawal ho to humari customer care team {{supportNumber}} pe available hai.`,

    closing: `Aapka din shubh ho. Namaste!`,

    // Fallback responses
    fallback: {
      didNotUnderstand: `Maaf kijiye, main samajh nahi payi. Kya aap phir se keh sakte hain?`,
      needHelp: `Agar aapko koi help chahiye to aap humari customer support team ko {{supportNumber}} pe call kar sakte hain.`,
      wrongNumber: `Shayad galat number lag gaya. Maaf kijiye. Aapka din shubh ho!`
    }
  },

  // Abandoned Cart Reminder Script
  ABANDONED_CART: {
    greeting: `Namaste! Main Profit First se bol rahi hoon. Kya main {{customerName}} se baat kar rahi hoon?`,

    confirmIdentity: {
      yes: `Ji, main aapko yaad dilane ke liye call kar rahi hoon.`,
      no: `Theek hai. Kya main {{customerName}} se baat kar sakti hoon?`
    },

    cartReminder: `Aapne hamare website pe {{productName}} apne cart mein add kiya tha lekin order complete nahi kiya.`,

    offerIncentive: `Aaj hi order complete karne pe aapko {{discountPercent}}% discount milega! Offer code hai: {{offerCode}}`,

    urgency: `Ye offer sirf aaj ke liye valid hai. Stock bhi limited hai.`,

    helpWithOrder: `Kya aapko order complete karne mein koi problem aa rahi hai? Main help kar sakti hoon.`,

    responses: {
      willOrderLater: `Bilkul! Jab bhi aap ready ho, website pe ja kar {{offerCode}} code use kar sakte hain. Offer aaj tak valid hai.`,
      notInterested: `Koi baat nahi! Agar future mein interest ho to hum yahan hain. Dhanyavaad!`,
      needMoreInfo: `Main aapko customer support team se connect kar deti hoon. Wo aapko puri details de denge. Number hai {{supportNumber}}.`,
      priceIssue: `Main samajh sakti hoon. Isliye humne aapke liye special {{discountPercent}}% discount offer rakha hai. Aaj order karne pe ye discount automatically apply ho jayega.`
    },

    closing: `Profit First mein interest dikhane ke liye shukriya! Aapka din shubh ho. Namaste!`,

    // Fallback responses
    fallback: {
      didNotUnderstand: `Maaf kijiye, main clearly sun nahi payi. Kya aap repeat kar sakte hain?`,
      technicalIssue: `Agar website pe koi technical problem hai to please {{supportNumber}} pe call karein. Humari team turant help karegi.`,
      wrongNumber: `Sorry for the disturbance. Aapka din achha ho!`
    }
  },

  // Common responses for both scripts
  COMMON: {
    supportNumber: '1800-XXX-XXXX', // Replace with actual support number
    website: 'www.profitfirst.co.in',
    businessHours: 'Subah 9 baje se raat 9 baje tak',
    
    handleObjections: {
      busy: `Main samajh sakti hoon aap busy hain. Kya main 2-3 ghante baad call kar sakti hoon?`,
      notInterested: `Bilkul theek hai. Aapka time dene ke liye dhanyavaad. Namaste!`,
      callback: `Zaroor! Kab call karna theek rahega? Subah ya shaam?`
    }
  }
};

/**
 * Generate dynamic script with customer data
 */
function generateScript(scriptType, customerData) {
  const script = CALLING_SCRIPTS[scriptType];
  if (!script) {
    throw new Error(`Invalid script type: ${scriptType}`);
  }

  // Replace placeholders with actual customer data
  const replacePlaceholders = (text) => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return customerData[key] || match;
    });
  };

  // Process all script sections
  const processedScript = {};
  for (const [key, value] of Object.entries(script)) {
    if (typeof value === 'string') {
      processedScript[key] = replacePlaceholders(value);
    } else if (typeof value === 'object') {
      processedScript[key] = {};
      for (const [subKey, subValue] of Object.entries(value)) {
        processedScript[key][subKey] = typeof subValue === 'string' 
          ? replacePlaceholders(subValue) 
          : subValue;
      }
    }
  }

  return processedScript;
}

/**
 * Get conversation flow based on call type
 */
function getConversationFlow(callType) {
  const flows = {
    ORDER_CONFIRMATION: [
      'greeting',
      'confirmIdentity',
      'orderDetails',
      'deliveryInfo',
      'paymentConfirmation',
      'thankYou',
      'closing'
    ],
    ABANDONED_CART: [
      'greeting',
      'confirmIdentity',
      'cartReminder',
      'offerIncentive',
      'urgency',
      'helpWithOrder',
      'closing'
    ]
  };

  return flows[callType] || [];
}

module.exports = {
  CALLING_SCRIPTS,
  generateScript,
  getConversationFlow
};
