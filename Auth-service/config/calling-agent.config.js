/**
 * AI Calling Agent Configuration
 * 
 * PURPOSE: Configure AI-powered calling agent using Twilio, AWS Polly, and Groq
 * 
 * COMPONENTS:
 * - Twilio: Voice calls and telephony
 * - AWS Polly: Text-to-speech conversion
 * - Groq: Ultra-fast AI responses
 * 
 * FEATURES:
 * - Real-time voice conversations
 * - Natural language processing
 * - Dynamic response generation
 * - Call recording and transcription
 */

const twilio = require('twilio');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const { generateGroqResponse, GROQ_MODELS } = require('./groq.config');
const fs = require('fs');
const path = require('path');

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Initialize AWS Polly client
const pollyClient = new PollyClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

/**
 * AI Calling Agent Configuration
 */
const CALLING_AGENT_CONFIG = {
  // Voice settings
  voice: {
    pollyVoiceId: process.env.POLLY_VOICE_ID || 'Joanna',
    outputFormat: process.env.POLLY_OUTPUT_FORMAT || 'mp3',
    sampleRate: process.env.POLLY_SAMPLE_RATE || '22050',
    speechRate: 'medium',
    volume: 'medium'
  },
  
  // AI settings
  ai: {
    model: GROQ_MODELS.LLAMA_3_3_70B,
    temperature: 0.7,
    maxTokens: 150, // Keep responses concise for voice
    systemPrompt: `You are a helpful AI assistant making a phone call. 
    Keep your responses conversational, natural, and under 30 seconds when spoken.
    Be friendly, professional, and to the point. 
    Ask clarifying questions when needed.
    If the person wants to end the call, politely say goodbye.`
  },
  
  // Call settings
  call: {
    timeout: 30, // seconds
    recordCall: true,
    transcribeCall: true,
    maxCallDuration: 300 // 5 minutes
  }
};

/**
 * Convert text to speech using AWS Polly (with fallback)
 * 
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - Polly voice ID (optional)
 * @returns {Promise<Buffer>} Audio buffer
 */
async function textToSpeech(text, voiceId = null) {
  try {
    const voice = voiceId || CALLING_AGENT_CONFIG.voice.pollyVoiceId;
    
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: CALLING_AGENT_CONFIG.voice.outputFormat,
      VoiceId: voice,
      SampleRate: CALLING_AGENT_CONFIG.voice.sampleRate,
      Engine: 'neural' // Use neural engine for better quality
    });

    const response = await pollyClient.send(command);
    
    if (response.AudioStream) {
      const chunks = [];
      for await (const chunk of response.AudioStream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
    
    throw new Error('No audio stream received from Polly');
  } catch (error) {
    console.error('⚠️ Polly TTS Error (using Twilio fallback):', error.message);
    
    // Return null to indicate we should use Twilio's built-in TTS
    return null;
  }
}

/**
 * Generate AI response for conversation
 * 
 * @param {string} userInput - What the user said
 * @param {Array} conversationHistory - Previous conversation context
 * @returns {Promise<string>} AI response text
 */
async function generateAIResponse(userInput, conversationHistory = []) {
  try {
    // Build conversation context
    let contextPrompt = CALLING_AGENT_CONFIG.ai.systemPrompt;
    
    if (conversationHistory.length > 0) {
      contextPrompt += '\n\nConversation so far:\n';
      conversationHistory.forEach((msg, index) => {
        contextPrompt += `${msg.role}: ${msg.content}\n`;
      });
    }
    
    const response = await generateGroqResponse(
      userInput,
      contextPrompt,
      CALLING_AGENT_CONFIG.ai.model
    );
    
    return response;
  } catch (error) {
    console.error('❌ AI Response Error:', error);
    // Fallback response
    return "I'm sorry, I'm having trouble processing that. Could you please repeat?";
  }
}

/**
 * Make an outbound call
 * 
 * @param {string} toNumber - Phone number to call
 * @param {string} initialMessage - First message to say
 * @param {string} webhookUrl - URL for handling call events
 * @returns {Promise<Object>} Call details
 */
async function makeOutboundCall(toNumber, initialMessage, webhookUrl) {
  try {
    const call = await twilioClient.calls.create({
      to: toNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: webhookUrl, // TwiML webhook URL
      record: CALLING_AGENT_CONFIG.call.recordCall,
      timeout: CALLING_AGENT_CONFIG.call.timeout
    });
    
    console.log(`📞 Outbound call initiated: ${call.sid}`);
    return {
      callSid: call.sid,
      status: call.status,
      to: toNumber,
      initialMessage
    };
  } catch (error) {
    console.error('❌ Outbound Call Error:', error);
    throw new Error(`CALL_ERROR: ${error.message}`);
  }
}

/**
 * Save audio file to local storage
 * 
 * @param {Buffer} audioBuffer - Audio data
 * @param {string} filename - File name
 * @returns {Promise<string>} File path
 */
async function saveAudioFile(audioBuffer, filename) {
  try {
    const audioDir = path.join(__dirname, '../audio');
    
    // Create audio directory if it doesn't exist
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    const filePath = path.join(audioDir, filename);
    fs.writeFileSync(filePath, audioBuffer);
    
    return filePath;
  } catch (error) {
    console.error('❌ Audio Save Error:', error);
    throw new Error(`AUDIO_SAVE_ERROR: ${error.message}`);
  }
}

/**
 * Available Polly voices for different languages/accents
 */
const POLLY_VOICES = {
  // English (US)
  JOANNA: 'Joanna',      // Female, neutral
  MATTHEW: 'Matthew',    // Male, neutral
  IVY: 'Ivy',           // Female, child
  JUSTIN: 'Justin',     // Male, young adult
  KENDRA: 'Kendra',     // Female, neutral
  KIMBERLY: 'Kimberly', // Female, neutral
  SALLI: 'Salli',       // Female, neutral
  JOEY: 'Joey',         // Male, neutral
  
  // English (British)
  AMY: 'Amy',           // Female, British
  EMMA: 'Emma',         // Female, British
  BRIAN: 'Brian',       // Male, British
  
  // English (Australian)
  NICOLE: 'Nicole',     // Female, Australian
  RUSSELL: 'Russell',   // Male, Australian
  
  // English (Indian)
  ADITI: 'Aditi',       // Female, Indian
  RAVEENA: 'Raveena'    // Female, Indian
};

module.exports = {
  twilioClient,
  pollyClient,
  CALLING_AGENT_CONFIG,
  POLLY_VOICES,
  textToSpeech,
  generateAIResponse,
  makeOutboundCall,
  saveAudioFile
};