/**
 * AI Calling Agent Demo
 * 
 * PURPOSE: Example usage of the AI calling agent
 * 
 * This demo shows how to:
 * 1. Make an outbound AI call
 * 2. Handle different call scenarios
 * 3. Test API endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

/**
 * Demo: Initiate an AI call
 */
async function demoInitiateCall() {
  try {
    console.log('📞 Demo: Initiating AI Call...\n');

    const callData = {
      phoneNumber: '+1234567890', // Replace with actual test number
      purpose: 'Customer Support',
      initialMessage: 'Hello! This is an AI assistant from your company. I\'m calling to help you with any questions you might have.',
      customerName: 'John Doe',
      customPrompt: 'You are a helpful customer support agent. Be friendly and professional.',
      voiceId: 'Joanna'
    };

    const response = await axios.post(`${BASE_URL}/api/calling-agent/initiate`, callData);
    
    console.log('✅ Call initiated successfully!');
    console.log('Response:', response.data);
    
    return response.data.sessionId;

  } catch (error) {
    console.error('❌ Call initiation failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Demo: Test text-to-speech
 */
async function demoTextToSpeech() {
  try {
    console.log('🎵 Demo: Testing Text-to-Speech...\n');

    const ttsData = {
      text: 'Hello! This is a test of our AI calling system. How does this sound?',
      voiceId: 'Joanna'
    };

    const response = await axios.post(`${BASE_URL}/api/calling-agent/test-tts`, ttsData, {
      responseType: 'arraybuffer'
    });

    console.log('✅ TTS generation successful!');
    console.log(`📊 Audio size: ${response.data.length} bytes`);
    console.log('🎧 Audio file would be saved as MP3');

  } catch (error) {
    console.error('❌ TTS test failed:', error.response?.data || error.message);
  }
}

/**
 * Demo: Test AI response
 */
async function demoAIResponse() {
  try {
    console.log('🤖 Demo: Testing AI Response Generation...\n');

    const aiData = {
      prompt: 'I want to return a product I bought last week',
      systemPrompt: 'You are a customer service agent. Be helpful and ask for order details.'
    };

    const response = await axios.post(`${BASE_URL}/api/calling-agent/test-ai`, aiData);
    
    console.log('✅ AI response generated successfully!');
    console.log(`👤 Customer: "${response.data.prompt}"`);
    console.log(`🤖 AI Agent: "${response.data.response}"`);

  } catch (error) {
    console.error('❌ AI test failed:', error.response?.data || error.message);
  }
}

/**
 * Demo: Get available voices
 */
async function demoGetVoices() {
  try {
    console.log('🎙️ Demo: Getting Available Voices...\n');

    const response = await axios.get(`${BASE_URL}/api/calling-agent/voices`);
    
    console.log('✅ Available voices retrieved!');
    console.log('🎵 Voices:', Object.keys(response.data.voices));
    console.log(`🔧 Default voice: ${response.data.default}`);

  } catch (error) {
    console.error('❌ Get voices failed:', error.response?.data || error.message);
  }
}

/**
 * Demo: Get active calls
 */
async function demoGetActiveCalls() {
  try {
    console.log('📊 Demo: Getting Active Calls...\n');

    const response = await axios.get(`${BASE_URL}/api/calling-agent/calls`);
    
    console.log('✅ Active calls retrieved!');
    console.log(`📞 Active calls count: ${response.data.count}`);
    
    if (response.data.activeCalls.length > 0) {
      console.log('📋 Active calls:');
      response.data.activeCalls.forEach(call => {
        console.log(`  - Session: ${call.sessionId}`);
        console.log(`    Phone: ${call.phoneNumber}`);
        console.log(`    Status: ${call.status}`);
        console.log(`    Customer: ${call.customerName || 'Unknown'}`);
      });
    } else {
      console.log('📭 No active calls');
    }

  } catch (error) {
    console.error('❌ Get active calls failed:', error.response?.data || error.message);
  }
}

/**
 * Run all demos
 */
async function runAllDemos() {
  console.log('🚀 AI Calling Agent Demo Suite');
  console.log('===============================\n');

  // Test basic functionality first
  await demoGetVoices();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await demoTextToSpeech();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await demoAIResponse();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await demoGetActiveCalls();
  console.log('\n' + '='.repeat(50) + '\n');

  // Uncomment to test actual calling (requires valid phone number)
  // const sessionId = await demoInitiateCall();
  // if (sessionId) {
  //   console.log(`\n📋 Call session created: ${sessionId}`);
  // }

  console.log('✅ Demo completed!');
  console.log('\n📝 To test actual calling:');
  console.log('1. Update the phone number in demoInitiateCall()');
  console.log('2. Uncomment the call initiation code');
  console.log('3. Make sure your Twilio webhook URLs are configured');
}

/**
 * Example call scenarios
 */
const CALL_SCENARIOS = {
  customerSupport: {
    purpose: 'Customer Support',
    initialMessage: 'Hello! I\'m calling from customer support to help resolve any issues you might have.',
    customPrompt: 'You are a customer support agent. Be empathetic, ask for order numbers, and offer solutions.'
  },
  
  salesFollowUp: {
    purpose: 'Sales Follow-up',
    initialMessage: 'Hi! I\'m following up on your recent inquiry about our products. Do you have any questions?',
    customPrompt: 'You are a sales representative. Be friendly, highlight product benefits, and try to schedule a demo.'
  },
  
  appointmentReminder: {
    purpose: 'Appointment Reminder',
    initialMessage: 'Hello! This is a reminder about your upcoming appointment tomorrow at 2 PM.',
    customPrompt: 'You are confirming an appointment. Be brief, confirm the time, and ask if they need to reschedule.'
  },
  
  surveyCall: {
    purpose: 'Customer Survey',
    initialMessage: 'Hi! We\'d love to get your feedback on our recent service. Do you have 2 minutes for a quick survey?',
    customPrompt: 'You are conducting a customer satisfaction survey. Ask 3-5 short questions and thank them for their time.'
  }
};

// Export for use in other files
module.exports = {
  demoInitiateCall,
  demoTextToSpeech,
  demoAIResponse,
  demoGetVoices,
  demoGetActiveCalls,
  runAllDemos,
  CALL_SCENARIOS
};

// Run demos if this file is executed directly
if (require.main === module) {
  runAllDemos().catch(console.error);
}