/**
 * AI Provider Configuration & Smart Fallback
 * 
 * PURPOSE: Unified AI interface with automatic fallback
 * 
 * PRIORITY ORDER:
 * 1. Bedrock (AWS Claude) - if AI_PROVIDER=bedrock or auto
 * 2. Groq (Llama 3.1) - if Bedrock fails or AI_PROVIDER=groq
 * 3. Template responses - if both fail
 * 
 * CONFIGURATION:
 * Set AI_PROVIDER in .env:
 * - "bedrock" = Only use Bedrock (fail if unavailable)
 * - "groq" = Only use Groq (fail if unavailable)
 * - "auto" = Try Bedrock first, fallback to Groq (recommended)
 */

const { InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { initializeBedrock } = require('./bedrock.config');
const { generateGroqResponse, GROQ_MODELS } = require('./groq.config');

// Track provider availability
let bedrockAvailable = true;
let groqAvailable = true;
let lastBedrockCheck = null;
let lastGroqCheck = null;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Get AI provider from environment
 * @returns {string} 'bedrock' | 'groq' | 'auto'
 */
function getAIProvider() {
  return process.env.AI_PROVIDER || 'auto';
}

/**
 * Generate AI response using Bedrock (Amazon Nova Pro)
 */
async function generateBedrockResponse(prompt, systemPrompt = null) {
  const now = Date.now();
  
  // Check if we should skip Bedrock
  if (!bedrockAvailable && lastBedrockCheck && (now - lastBedrockCheck) < CHECK_INTERVAL) {
    throw new Error('BEDROCK_UNAVAILABLE');
  }

  try {
    const bedrockClient = initializeBedrock();
    
    // Build messages array for Nova
    const messages = [];
    
    if (systemPrompt) {
      messages.push({
        role: 'user',
        content: [{ text: systemPrompt }]
      });
      messages.push({
        role: 'assistant',
        content: [{ text: 'I understand. I will follow these instructions.' }]
      });
    }
    
    messages.push({
      role: 'user',
      content: [{ text: prompt }]
    });
    
    const command = new InvokeModelCommand({
      modelId: 'amazon.nova-pro-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        messages: messages,
        inferenceConfig: {
          max_new_tokens: 2048,
          temperature: 0.7,
          top_p: 0.9
        }
      })
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Bedrock is working
    bedrockAvailable = true;
    lastBedrockCheck = now;
    
    return responseBody.output.message.content[0].text;
  } catch (error) {
    console.error('❌ Bedrock (Nova) error:', error.message);
    bedrockAvailable = false;
    lastBedrockCheck = now;
    throw new Error('BEDROCK_UNAVAILABLE');
  }
}

/**
 * Generate AI response using Groq (Llama)
 */
async function generateGroqAIResponse(prompt, systemPrompt = null) {
  const now = Date.now();
  
  // Check if we should skip Groq
  if (!groqAvailable && lastGroqCheck && (now - lastGroqCheck) < CHECK_INTERVAL) {
    throw new Error('GROQ_UNAVAILABLE');
  }

  try {
    const response = await generateGroqResponse(prompt, systemPrompt, GROQ_MODELS.LLAMA_3_3_70B);
    
    // Groq is working
    groqAvailable = true;
    lastGroqCheck = now;
    
    return response;
  } catch (error) {
    console.error('❌ Groq error:', error.message);
    groqAvailable = false;
    lastGroqCheck = now;
    throw new Error('GROQ_UNAVAILABLE');
  }
}

/**
 * Smart AI Response Generator with Automatic Fallback
 * 
 * @param {string} prompt - User prompt/question
 * @param {string} systemPrompt - System instructions (optional)
 * @returns {Promise<{response: string, provider: string}>} AI response and provider used
 */
async function generateAIResponse(prompt, systemPrompt = null) {
  const provider = getAIProvider();
  
  // Strategy 1: Bedrock only
  if (provider === 'bedrock') {
    try {
      const response = await generateBedrockResponse(prompt, systemPrompt);
      console.log('✅ Using Bedrock (Claude 3 Sonnet)');
      return { response, provider: 'bedrock' };
    } catch (error) {
      throw new Error('Bedrock unavailable and no fallback allowed');
    }
  }
  
  // Strategy 2: Groq only
  if (provider === 'groq') {
    try {
      const response = await generateGroqAIResponse(prompt, systemPrompt);
      console.log('✅ Using Groq (Llama 3.1 70B)');
      return { response, provider: 'groq' };
    } catch (error) {
      throw new Error('Groq unavailable and no fallback allowed');
    }
  }
  
  // Strategy 3: Auto (try Bedrock first, fallback to Groq)
  if (provider === 'auto') {
    // Try Bedrock first
    try {
      const response = await generateBedrockResponse(prompt, systemPrompt);
      console.log('✅ Using Bedrock (Amazon Nova Pro)');
      return { response, provider: 'bedrock' };
    } catch (bedrockError) {
      console.log('⚠️ Bedrock (Nova) unavailable, trying Groq...');
      
      // Fallback to Groq
      try {
        const response = await generateGroqAIResponse(prompt, systemPrompt);
        console.log('✅ Using Groq (Llama 3.1 70B) as fallback');
        return { response, provider: 'groq' };
      } catch (groqError) {
        console.log('❌ Both Bedrock and Groq unavailable');
        throw new Error('ALL_AI_PROVIDERS_UNAVAILABLE');
      }
    }
  }
  
  throw new Error(`Invalid AI_PROVIDER: ${provider}`);
}

/**
 * Get current AI provider status
 * @returns {Object} Status of all providers
 */
function getAIStatus() {
  return {
    configured: getAIProvider(),
    bedrock: {
      available: bedrockAvailable,
      lastCheck: lastBedrockCheck ? new Date(lastBedrockCheck).toISOString() : null
    },
    groq: {
      available: groqAvailable,
      lastCheck: lastGroqCheck ? new Date(lastGroqCheck).toISOString() : null
    }
  };
}

module.exports = {
  generateAIResponse,
  getAIStatus,
  getAIProvider
};
