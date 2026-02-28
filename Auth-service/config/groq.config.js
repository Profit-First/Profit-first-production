/**
 * Groq AI Configuration
 * 
 * PURPOSE: Configure Groq AI service for ultra-fast AI responses
 * 
 * WHAT IS GROQ?
 * Groq provides the fastest LLM inference in the world (500+ tokens/sec)
 * Uses open-source models like Llama 3.1, Mixtral, Gemma
 * 
 * WHY GROQ?
 * - Fastest inference speed (10x faster than others)
 * - Free tier: 30 requests/min, 14,400 tokens/min
 * - Great for real-time chat applications
 * - Fallback when Bedrock is unavailable
 * 
 * MODELS AVAILABLE:
 * - Llama 3.1 70B: Best quality (recommended)
 * - Llama 3.1 8B: Fastest, good quality
 * - Mixtral 8x7B: Great for reasoning
 * - Gemma 7B: Lightweight, fast
 */

const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Groq Model IDs (Updated December 2024)
 */
const GROQ_MODELS = {
  // Llama 3.3 models (Latest - December 2024)
  LLAMA_3_3_70B: 'llama-3.3-70b-versatile',  // NEW - Best quality (RECOMMENDED)
  
  // Llama 3.1 models (Still supported)
  LLAMA_3_1_70B: 'llama-3.1-70b-versatile',  // DEPRECATED - use 3.3 instead
  LLAMA_3_1_8B: 'llama-3.1-8b-instant',      // Fast, still works
  
  // Llama 3 models (Older)
  LLAMA_3_70B: 'llama3-70b-8192',            // Alternative
  LLAMA_3_8B: 'llama3-8b-8192',              // Alternative
  
  // Mixtral models (Mistral AI)
  MIXTRAL_8X7B: 'mixtral-8x7b-32768',        // Great reasoning
  
  // Gemma models (Google)
  GEMMA_7B: 'gemma-7b-it',                   // Lightweight
  GEMMA_2_9B: 'gemma2-9b-it'                 // Newer version
};

/**
 * Generate AI response using Groq
 * 
 * @param {string} prompt - User prompt/question
 * @param {string} systemPrompt - System instructions (optional)
 * @param {string} model - Model ID (default: Llama 3.1 70B)
 * @returns {Promise<string>} AI response text
 */
async function generateGroqResponse(prompt, systemPrompt = null, model = GROQ_MODELS.LLAMA_3_3_70B) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      throw new Error('GROQ_API_KEY not found in environment variables');
    }

    const messages = [];
    
    // Add system prompt if provided
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }
    
    // Add user prompt
    messages.push({
      role: 'user',
      content: prompt
    });

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 1,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    } else {
      throw new Error('Invalid response format from Groq API');
    }
  } catch (error) {
    console.error('❌ Groq API Error:', error.response?.data || error.message);
    throw new Error(`GROQ_ERROR: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Check if Groq is available
 * 
 * @returns {Promise<boolean>} True if Groq is working
 */
async function checkGroqAvailability() {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return false;

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODELS.LLAMA_3_1_8B, // Use fastest model for health check
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 second timeout for health check
      }
    );

    return response.status === 200;
  } catch (error) {
    console.error('⚠️ Groq health check failed:', error.message);
    return false;
  }
}

module.exports = {
  generateGroqResponse,
  checkGroqAvailability,
  GROQ_MODELS
};
