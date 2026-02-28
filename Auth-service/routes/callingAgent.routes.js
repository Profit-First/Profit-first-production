/**
 * AI Calling Agent Routes
 * 
 * PURPOSE: API endpoints for AI calling agent functionality
 * 
 * ENDPOINTS:
 * - POST /api/calling-agent/initiate - Start an AI call
 * - POST /api/calling-agent/webhook - Twilio webhook handler
 * - POST /api/calling-agent/speech - Handle speech input
 * - GET /api/calling-agent/calls - Get active calls
 * - GET /api/calling-agent/history/:sessionId - Get call history
 */

const express = require('express');
const router = express.Router();
const callingAgentService = require('../services/callingAgent.service');
const { POLLY_VOICES } = require('../config/calling-agent.config');

/**
 * POST /api/calling-agent/initiate
 * Initiate an outbound AI call
 */
router.post('/initiate', async (req, res) => {
  try {
    const {
      phoneNumber,
      purpose,
      initialMessage,
      customerName,
      customPrompt,
      voiceId
    } = req.body;

    // Validate required fields
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    if (!initialMessage) {
      return res.status(400).json({
        success: false,
        error: 'Initial message is required'
      });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s+/g, ''))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // Validate voice ID if provided
    if (voiceId && !Object.values(POLLY_VOICES).includes(voiceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid voice ID'
      });
    }

    const result = await callingAgentService.initiateCall({
      phoneNumber: phoneNumber.replace(/\s+/g, ''), // Remove spaces
      purpose: purpose || 'General inquiry',
      initialMessage,
      customerName,
      customPrompt,
      voiceId
    });

    res.json(result);

  } catch (error) {
    console.error('❌ Initiate Call Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate call'
    });
  }
});

/**
 * POST /api/calling-agent/webhook
 * Twilio webhook handler for call events
 */
router.post('/webhook', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const twilioData = req.body;

    console.log('📞 Twilio Webhook:', {
      sessionId,
      callStatus: twilioData.CallStatus,
      callSid: twilioData.CallSid
    });

    const twimlResponse = await callingAgentService.handleCallWebhook(
      twilioData,
      sessionId
    );

    res.type('text/xml');
    res.send(twimlResponse);

  } catch (error) {
    console.error('❌ Webhook Error:', error);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="Joanna">I'm sorry, there was an error. Please try again later.</Say>
      <Hangup/>
    </Response>`);
  }
});

/**
 * POST /api/calling-agent/speech
 * Handle speech input from Twilio
 */
router.post('/speech', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const speechData = req.body;

    console.log('🎤 Speech Input:', {
      sessionId,
      speechResult: speechData.SpeechResult,
      confidence: speechData.Confidence
    });

    const twimlResponse = await callingAgentService.handleSpeechInput(
      speechData,
      sessionId
    );

    res.type('text/xml');
    res.send(twimlResponse);

  } catch (error) {
    console.error('❌ Speech Handler Error:', error);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="Joanna">I'm sorry, I didn't understand that. Could you please repeat?</Say>
      <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/calling-agent/speech" method="POST">
        <Say voice="Joanna">I'm listening.</Say>
      </Gather>
    </Response>`);
  }
});

/**
 * GET /api/calling-agent/calls
 * Get all active calls
 */
router.get('/calls', async (req, res) => {
  try {
    const activeCalls = callingAgentService.getActiveCalls();
    
    res.json({
      success: true,
      activeCalls,
      count: activeCalls.length
    });

  } catch (error) {
    console.error('❌ Get Calls Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active calls'
    });
  }
});

/**
 * GET /api/calling-agent/history/:sessionId
 * Get conversation history for a specific call
 */
router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = callingAgentService.getCallHistory(sessionId);
    
    res.json({
      success: true,
      sessionId,
      history,
      messageCount: history.length
    });

  } catch (error) {
    console.error('❌ Get History Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get call history'
    });
  }
});

/**
 * GET /api/calling-agent/voices
 * Get available Polly voices
 */
router.get('/voices', async (req, res) => {
  try {
    res.json({
      success: true,
      voices: POLLY_VOICES,
      default: POLLY_VOICES.JOANNA
    });

  } catch (error) {
    console.error('❌ Get Voices Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get available voices'
    });
  }
});

/**
 * POST /api/calling-agent/test-tts
 * Test text-to-speech functionality
 */
router.post('/test-tts', async (req, res) => {
  try {
    const { text, voiceId } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const { textToSpeech } = require('../config/calling-agent.config');
    const audioBuffer = await textToSpeech(text, voiceId);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Content-Disposition': 'attachment; filename="tts-test.mp3"'
    });

    res.send(audioBuffer);

  } catch (error) {
    console.error('❌ TTS Test Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate speech'
    });
  }
});

/**
 * POST /api/calling-agent/test-ai
 * Test AI response generation
 */
router.post('/test-ai', async (req, res) => {
  try {
    const { prompt, systemPrompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const { generateAIResponse } = require('../config/calling-agent.config');
    const response = await generateAIResponse(prompt, [], systemPrompt);

    res.json({
      success: true,
      prompt,
      response,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ AI Test Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI response'
    });
  }
});

module.exports = router;