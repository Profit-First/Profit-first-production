/**
 * Simple Call Test - Direct Twilio Call
 * 
 * This makes a simple call without webhooks for testing
 */

require('dotenv').config();
const twilio = require('twilio');

async function makeSimpleCall() {
  try {
    console.log('📞 Making a simple test call...');
    
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Create a simple TwiML that just says a message
    const twimlUrl = 'http://twimlets.com/message?Message%5B0%5D=Hello%21%20This%20is%20a%20test%20call%20from%20your%20AI%20system.%20The%20AI%20calling%20agent%20is%20working%20successfully.%20Thank%20you%20for%20testing.%20Goodbye%21';

    const call = await client.calls.create({
      to: '+919322023539',
      from: process.env.TWILIO_PHONE_NUMBER,
      url: twimlUrl
    });

    console.log('✅ Call initiated successfully!');
    console.log(`📞 Call SID: ${call.sid}`);
    console.log(`📱 To: +919322023539`);
    console.log(`📞 From: ${process.env.TWILIO_PHONE_NUMBER}`);
    console.log(`📊 Status: ${call.status}`);
    
    return call;

  } catch (error) {
    console.error('❌ Call failed:', error.message);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  makeSimpleCall()
    .then(() => {
      console.log('\n🎉 Test call completed! Check your phone.');
    })
    .catch(console.error);
}

module.exports = { makeSimpleCall };