/**
 * AI Calling Agent Service
 * 
 * PURPOSE: Main service for handling AI-powered phone calls
 * 
 * FEATURES:
 * - Initiate outbound calls
 * - Handle inbound calls
 * - Real-time conversation management
 * - Call recording and transcription
 * - Integration with CRM/database
 */

const {
  twilioClient,
  CALLING_AGENT_CONFIG,
  POLLY_VOICES,
  textToSpeech,
  generateAIResponse,
  makeOutboundCall,
  saveAudioFile
} = require('../config/calling-agent.config');

class CallingAgentService {
  constructor() {
    this.activeCalls = new Map(); // Store active call sessions
    this.conversationHistory = new Map(); // Store conversation context
  }

  /**
   * Initiate an outbound AI call
   * 
   * @param {Object} callData - Call configuration
   * @returns {Promise<Object>} Call result
   */
  async initiateCall(callData) {
    try {
      const {
        phoneNumber,
        purpose,
        initialMessage,
        customerName,
        customPrompt,
        voiceId
      } = callData;

      // Validate required fields
      if (!phoneNumber || !initialMessage) {
        throw new Error('Phone number and initial message are required');
      }

      // Generate webhook URL for this call
      const webhookUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/calling-agent/webhook`;

      // Create call session
      const sessionId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store call context
      this.activeCalls.set(sessionId, {
        phoneNumber,
        purpose,
        customerName,
        customPrompt,
        voiceId: voiceId || POLLY_VOICES.JOANNA,
        startTime: new Date(),
        status: 'initiating'
      });

      // Initialize conversation history
      this.conversationHistory.set(sessionId, []);

      // Make the call
      const callResult = await makeOutboundCall(
        phoneNumber,
        initialMessage,
        `${webhookUrl}?sessionId=${sessionId}`
      );

      // Update call session
      const callSession = this.activeCalls.get(sessionId);
      callSession.callSid = callResult.callSid;
      callSession.status = 'active';

      console.log(`🤖 AI Call initiated for ${customerName || phoneNumber}`);
      console.log(`📋 Purpose: ${purpose}`);
      console.log(`🆔 Session ID: ${sessionId}`);

      return {
        success: true,
        sessionId,
        callSid: callResult.callSid,
        message: 'AI call initiated successfully'
      };

    } catch (error) {
      console.error('❌ Call Initiation Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle incoming call webhook from Twilio
   * 
   * @param {Object} twilioData - Twilio webhook data
   * @param {string} sessionId - Call session ID
   * @returns {string} TwiML response
   */
  async handleCallWebhook(twilioData, sessionId) {
    try {
      const callSession = this.activeCalls.get(sessionId);
      
      if (!callSession) {
        console.error(`❌ Call session not found: ${sessionId}`);
        return this.generateErrorTwiML();
      }

      const { CallStatus, CallSid } = twilioData;
      
      console.log(`📞 Call Status: ${CallStatus} for session ${sessionId}`);

      switch (CallStatus) {
        case 'ringing':
          return this.generateInitialTwiML(callSession);
          
        case 'in-progress':
          return this.generateConversationTwiML(callSession);
          
        case 'completed':
        case 'busy':
        case 'no-answer':
        case 'failed':
          await this.handleCallEnd(sessionId, CallStatus);
          return this.generateEndTwiML();
          
        default:
          return this.generateContinueTwiML(callSession);
      }

    } catch (error) {
      console.error('❌ Webhook Error:', error);
      return this.generateErrorTwiML();
    }
  }

  /**
   * Handle speech input from caller
   * 
   * @param {Object} speechData - Twilio speech recognition data
   * @param {string} sessionId - Call session ID
   * @returns {string} TwiML response
   */
  async handleSpeechInput(speechData, sessionId) {
    try {
      const { SpeechResult, Confidence } = speechData;
      const callSession = this.activeCalls.get(sessionId);
      
      if (!callSession) {
        return this.generateErrorTwiML();
      }

      console.log(`🎤 Speech Input (${Confidence}): ${SpeechResult}`);

      // Get conversation history
      const history = this.conversationHistory.get(sessionId) || [];

      // Add user input to history
      history.push({
        role: 'user',
        content: SpeechResult,
        timestamp: new Date(),
        confidence: Confidence
      });

      // Generate AI response
      const aiResponse = await generateAIResponse(SpeechResult, history);

      // Add AI response to history
      history.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      });

      // Update conversation history
      this.conversationHistory.set(sessionId, history);

      // Generate TwiML with AI response
      return this.generateSpeechTwiML(aiResponse, sessionId);

    } catch (error) {
      console.error('❌ Speech Input Error:', error);
      return this.generateErrorTwiML();
    }
  }

  /**
   * Generate initial TwiML for call start
   */
  generateInitialTwiML(callSession) {
    const { initialMessage } = callSession;
    const twilioVoice = 'alice'; // Twilio's built-in voice
    
    return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="${twilioVoice}">${this.escapeXml(initialMessage)}</Say>
      <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/calling-agent/speech" method="POST">
        <Say voice="${twilioVoice}">How can I help you today?</Say>
      </Gather>
      <Say voice="${twilioVoice}">I didn't hear anything. Let me try again.</Say>
      <Redirect>/api/calling-agent/webhook</Redirect>
    </Response>`;
  }

  /**
   * Generate TwiML for ongoing conversation
   */
  generateConversationTwiML(callSession) {
    const twilioVoice = 'alice';
    
    return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/calling-agent/speech" method="POST">
        <Say voice="${twilioVoice}">I'm listening. Please go ahead.</Say>
      </Gather>
      <Say voice="${twilioVoice}">I didn't catch that. Could you please repeat?</Say>
      <Redirect>/api/calling-agent/webhook</Redirect>
    </Response>`;
  }

  /**
   * Generate TwiML with AI speech response
   */
  generateSpeechTwiML(aiResponse, sessionId) {
    const callSession = this.activeCalls.get(sessionId);
    // Use Twilio's built-in voices since Polly isn't working yet
    const twilioVoice = 'alice'; // Twilio's default female voice
    
    return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="${twilioVoice}">${this.escapeXml(aiResponse)}</Say>
      <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/calling-agent/speech?sessionId=${sessionId}" method="POST">
        <Say voice="${twilioVoice}">Is there anything else I can help you with?</Say>
      </Gather>
      <Say voice="${twilioVoice}">Thank you for calling. Have a great day!</Say>
      <Hangup/>
    </Response>`;
  }

  /**
   * Escape XML special characters
   */
  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate continue TwiML
   */
  generateContinueTwiML(callSession) {
    const { voiceId } = callSession;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/calling-agent/speech" method="POST">
        <Say voice="${voiceId}">I'm here to help. What would you like to know?</Say>
      </Gather>
    </Response>`;
  }

  /**
   * Generate error TwiML
   */
  generateErrorTwiML() {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="Joanna">I'm sorry, there was a technical issue. Please try calling again later.</Say>
      <Hangup/>
    </Response>`;
  }

  /**
   * Generate end call TwiML
   */
  generateEndTwiML() {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="Joanna">Thank you for calling. Goodbye!</Say>
      <Hangup/>
    </Response>`;
  }

  /**
   * Handle call end cleanup
   */
  async handleCallEnd(sessionId, status) {
    try {
      const callSession = this.activeCalls.get(sessionId);
      const history = this.conversationHistory.get(sessionId);

      if (callSession) {
        callSession.endTime = new Date();
        callSession.status = status;
        callSession.duration = callSession.endTime - callSession.startTime;

        console.log(`📞 Call ended: ${sessionId}`);
        console.log(`⏱️ Duration: ${Math.round(callSession.duration / 1000)}s`);
        console.log(`📊 Status: ${status}`);

        // Save call record to database (implement as needed)
        await this.saveCallRecord(sessionId, callSession, history);

        // Cleanup
        this.activeCalls.delete(sessionId);
        this.conversationHistory.delete(sessionId);
      }
    } catch (error) {
      console.error('❌ Call End Error:', error);
    }
  }

  /**
   * Save call record to database
   */
  async saveCallRecord(sessionId, callSession, history) {
    try {
      // Implement database saving logic here
      console.log(`💾 Saving call record for session: ${sessionId}`);
      
      // Example: Save to DynamoDB, PostgreSQL, etc.
      const callRecord = {
        sessionId,
        callSid: callSession.callSid,
        phoneNumber: callSession.phoneNumber,
        customerName: callSession.customerName,
        purpose: callSession.purpose,
        startTime: callSession.startTime,
        endTime: callSession.endTime,
        duration: callSession.duration,
        status: callSession.status,
        conversationHistory: history
      };

      // TODO: Implement actual database save
      console.log('📋 Call record prepared for saving:', callRecord);
      
    } catch (error) {
      console.error('❌ Save Call Record Error:', error);
    }
  }

  /**
   * Get active calls
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.entries()).map(([sessionId, session]) => ({
      sessionId,
      ...session
    }));
  }

  /**
   * Get call history
   */
  getCallHistory(sessionId) {
    return this.conversationHistory.get(sessionId) || [];
  }
}

module.exports = new CallingAgentService();