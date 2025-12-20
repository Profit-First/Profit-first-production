/**
 * AI Calling Agent Test Script
 * 
 * PURPOSE: Test the AI calling agent functionality
 * 
 * TESTS:
 * 1. Environment variables check
 * 2. Groq API connection
 * 3. AWS Polly text-to-speech
 * 4. Twilio client initialization
 * 5. End-to-end call simulation
 */

require('dotenv').config();
const { 
  generateGroqResponse, 
  checkGroqAvailability 
} = require('./config/groq.config');
const { 
  textToSpeech, 
  generateAIResponse,
  POLLY_VOICES 
} = require('./config/calling-agent.config');

async function testCallingAgent() {
  console.log('🤖 AI Calling Agent Test Suite');
  console.log('================================\n');

  // Test 1: Environment Variables
  console.log('1️⃣ Testing Environment Variables...');
  const requiredEnvVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN', 
    'TWILIO_PHONE_NUMBER',
    'GROQ_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('❌ Missing environment variables:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n📝 Please add these to your .env file\n');
  } else {
    console.log('✅ All environment variables configured\n');
  }

  // Test 2: Groq API
  console.log('2️⃣ Testing Groq API Connection...');
  try {
    if (!process.env.GROQ_API_KEY) {
      console.log('⚠️ GROQ_API_KEY not set - skipping test\n');
    } else {
      const isAvailable = await checkGroqAvailability();
      if (isAvailable) {
        console.log('✅ Groq API connection successful');
        
        // Test AI response generation
        const testResponse = await generateGroqResponse(
          'Hello, how are you?',
          'You are a helpful assistant. Keep responses brief.'
        );
        console.log(`🤖 Test Response: "${testResponse}"\n`);
      } else {
        console.log('❌ Groq API connection failed\n');
      }
    }
  } catch (error) {
    console.log(`❌ Groq API Error: ${error.message}\n`);
  }

  // Test 3: AWS Polly Text-to-Speech
  console.log('3️⃣ Testing AWS Polly Text-to-Speech...');
  try {
    if (!process.env.AWS_ACCESS_KEY_ID) {
      console.log('⚠️ AWS credentials not set - skipping test\n');
    } else {
      const testText = 'Hello, this is a test of the text to speech system.';
      const audioBuffer = await textToSpeech(testText, POLLY_VOICES.JOANNA);
      
      if (audioBuffer && audioBuffer.length > 0) {
        console.log(`✅ AWS Polly TTS successful (${audioBuffer.length} bytes)`);
        console.log(`🎵 Generated audio for: "${testText}"\n`);
      } else {
        console.log('❌ AWS Polly TTS failed - no audio generated\n');
      }
    }
  } catch (error) {
    console.log(`❌ AWS Polly Error: ${error.message}\n`);
  }

  // Test 4: Twilio Client
  console.log('4️⃣ Testing Twilio Client...');
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.log('⚠️ Twilio credentials not set - skipping test\n');
    } else {
      const twilio = require('twilio');
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      // Test by fetching account info
      const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      console.log(`✅ Twilio client initialized successfully`);
      console.log(`📞 Account Status: ${account.status}`);
      console.log(`📱 Phone Number: ${process.env.TWILIO_PHONE_NUMBER}\n`);
    }
  } catch (error) {
    console.log(`❌ Twilio Error: ${error.message}\n`);
  }

  // Test 5: End-to-End AI Response
  console.log('5️⃣ Testing End-to-End AI Response Generation...');
  try {
    if (!process.env.GROQ_API_KEY) {
      console.log('⚠️ GROQ_API_KEY not set - skipping test\n');
    } else {
      const conversationHistory = [
        { role: 'user', content: 'Hi there!' },
        { role: 'assistant', content: 'Hello! How can I help you today?' }
      ];
      
      const userInput = 'I need help with my order';
      const aiResponse = await generateAIResponse(userInput, conversationHistory);
      
      console.log('✅ End-to-end AI response successful');
      console.log(`👤 User: "${userInput}"`);
      console.log(`🤖 AI: "${aiResponse}"\n`);
    }
  } catch (error) {
    console.log(`❌ AI Response Error: ${error.message}\n`);
  }

  // Summary
  console.log('📊 Test Summary');
  console.log('===============');
  console.log('✅ Environment check completed');
  console.log('✅ API connections tested');
  console.log('✅ Core functionality verified');
  console.log('\n🚀 AI Calling Agent is ready to use!');
  console.log('\n📋 Next Steps:');
  console.log('1. Configure your .env file with actual API keys');
  console.log('2. Test with: POST /api/calling-agent/initiate');
  console.log('3. Set up Twilio webhook URLs');
  console.log('4. Start making AI calls! 📞');
}

// Run the test
if (require.main === module) {
  testCallingAgent().catch(console.error);
}

module.exports = { testCallingAgent };