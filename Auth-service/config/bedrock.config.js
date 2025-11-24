/**
 * AWS Bedrock Configuration
 * 
 * PURPOSE: Configure AWS Bedrock AI service for natural language processing
 * 
 * WHAT IS BEDROCK?
 * AWS Bedrock is a managed service that provides access to foundation models
 * (AI models) from companies like Anthropic (Claude), Amazon (Titan, Nova), etc.
 * 
 * WHY SEPARATE REGION?
 * - Main app data: ap-south-1 (Mumbai) - where DynamoDB tables are
 * - Bedrock AI: us-east-1 (N. Virginia) - where AI models are available
 * - Not all AWS regions support Bedrock, so we use us-east-1
 * 
 * MODELS AVAILABLE:
 * - Claude 3 Sonnet: Best for business analytics (currently used)
 * - Amazon Nova Pro: Newest Amazon model
 * - Titan: Amazon's embedding and text models
 * 
 * SINGLETON PATTERN:
 * Client is initialized once and reused for all requests (performance optimization)
 */

const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');

// Singleton instance - created once, reused for all AI requests
let bedrockClient = null;

/**
 * Initialize Bedrock Client
 * 
 * REGION: us-east-1 (N. Virginia)
 * - Separate from main AWS_REGION (ap-south-1)
 * - Required because Bedrock AI models are only available in specific regions
 * 
 * CREDENTIALS:
 * Uses same AWS credentials as main app (from .env file)
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * 
 * SINGLETON PATTERN:
 * Only creates client once, then reuses it for better performance
 * 
 * @returns {BedrockRuntimeClient} Bedrock client instance for AI model invocation
 */
const initializeBedrock = () => {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION || 'us-east-1', // Bedrock uses us-east-1
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
  }
  return bedrockClient;
};

/**
 * Bedrock Model IDs
 */
const BEDROCK_MODELS = {
  // Embedding models
  TITAN_EMBED: 'amazon.titan-embed-text-v1',
  TITAN_EMBED_V2: 'amazon.titan-embed-text-v2:0',
  COHERE_EMBED: 'cohere.embed-english-v3',
  COHERE_EMBED_MULTILINGUAL: 'cohere.embed-multilingual-v3',
  
  // Amazon Nova models (newest, most powerful)
  NOVA_PRO: 'amazon.nova-pro-v1:0',
  NOVA_LITE: 'amazon.nova-lite-v1:0',
  NOVA_MICRO: 'amazon.nova-micro-v1:0',
  
  // Text generation models
  TITAN_TEXT: 'amazon.titan-text-express-v1',
  CLAUDE_V2: 'anthropic.claude-v2',
  CLAUDE_V3_SONNET: 'anthropic.claude-3-sonnet-20240229-v1:0',
  CLAUDE_INSTANT: 'anthropic.claude-instant-v1',
  
  // DeepSeek models
  DEEPSEEK_R1: 'deepseek-ai.DeepSeek-R1',
  DEEPSEEK_V3: 'deepseek-ai.DeepSeek-V3'
};

module.exports = {
  initializeBedrock,
  BEDROCK_MODELS
};
