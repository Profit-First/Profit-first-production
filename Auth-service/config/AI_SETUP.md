# AI Configuration Guide

## Overview

The chatbot now supports **multiple AI providers** with automatic fallback:

```
Priority 1: AWS Bedrock (Claude 3 Sonnet)
    ↓ (if unavailable)
Priority 2: Groq (Llama 3.1 70B) - FREE
    ↓ (if unavailable)
Priority 3: Template Responses (Statistical)
```

---

## Configuration

### Environment Variables (.env)

```env
# AI Provider Selection
AI_PROVIDER=auto  # Options: "bedrock" | "groq" | "auto"

# AWS Bedrock (Claude)
BEDROCK_REGION=us-east-1
BEDROCK_API_KEY=your_bedrock_key

# Groq (Llama 3.1)
GROQ_API_KEY=your_groq_key
```

---

## AI Provider Options

### 1. `AI_PROVIDER=auto` (Recommended)
- **Tries Bedrock first** (best quality)
- **Falls back to Groq** if Bedrock fails (fast & free)
- **Falls back to templates** if both fail
- **Best for production** - maximum reliability

### 2. `AI_PROVIDER=bedrock`
- **Only uses Bedrock** (AWS Claude)
- Fails if Bedrock unavailable
- Best for: When you want guaranteed Claude quality

### 3. `AI_PROVIDER=groq`
- **Only uses Groq** (Llama 3.1)
- Fails if Groq unavailable
- Best for: Development, testing, free tier

---

## Groq Free Tier Limits

✅ **30 requests per minute**  
✅ **14,400 tokens per minute**  
✅ **Unlimited total requests**  
✅ **500+ tokens/second** (fastest in market!)

**Perfect for:**
- Development & testing
- Low-traffic production apps
- Backup/fallback provider

---

## How It Works

### File Structure

```
config/
├── bedrock.config.js    # AWS Bedrock setup (unchanged)
├── groq.config.js       # Groq API setup (NEW)
└── ai.config.js         # Smart fallback logic (NEW)

services/
├── ai-chat.service.js   # Uses smart AI fallback
└── prediction.service.js # Uses smart AI fallback
```

### Smart Fallback Logic

```javascript
// ai.config.js handles everything automatically
const { generateAIResponse } = require('./config/ai.config');

// This will try Bedrock → Groq → Templates
const result = await generateAIResponse(prompt);
console.log(`Using: ${result.provider}`); // "bedrock" or "groq"
```

---

## Testing

### Test Bedrock Only
```env
AI_PROVIDER=bedrock
```

### Test Groq Only
```env
AI_PROVIDER=groq
```

### Test Auto Fallback
```env
AI_PROVIDER=auto
```

Then restart backend:
```bash
npm run dev
```

---

## Monitoring

Check which provider is being used in logs:

```
✅ Using Bedrock (Claude 3 Sonnet)
⚠️ Bedrock unavailable, trying Groq...
✅ Using Groq (Llama 3.1 70B) as fallback
```

---

## Cost Comparison

| Provider | Model | Cost/1M tokens | Speed | Quality |
|----------|-------|----------------|-------|---------|
| **Bedrock** | Claude 3 Sonnet | $3.00 | Fast | ⭐⭐⭐⭐⭐ |
| **Groq** | Llama 3.1 70B | **FREE** | **Fastest** | ⭐⭐⭐⭐ |

---

## Troubleshooting

### Chatbot not responding?

1. **Check logs** for AI provider errors
2. **Verify API keys** in .env
3. **Test Groq directly**: Set `AI_PROVIDER=groq`
4. **Check rate limits**: Groq free tier = 30 req/min

### Groq rate limit exceeded?

```
Error: Rate limit exceeded (30 requests/min)
```

**Solutions:**
- Wait 1 minute
- Upgrade to Groq paid tier
- Switch to Bedrock: `AI_PROVIDER=bedrock`

---

## Production Recommendations

### For High Traffic
```env
AI_PROVIDER=bedrock  # Use paid Bedrock for reliability
```

### For Low Traffic / Testing
```env
AI_PROVIDER=auto  # Use free Groq as backup
```

### For Development
```env
AI_PROVIDER=groq  # Use free Groq only
```

---

## API Keys

### Get Groq API Key
1. Go to: https://console.groq.com
2. Sign up (free)
3. Create API key
4. Add to `.env`: `GROQ_API_KEY=gsk_...`

### Get Bedrock API Key
1. AWS Console → Bedrock
2. Enable Claude 3 Sonnet model
3. Create API key
4. Add to `.env`: `BEDROCK_API_KEY=...`

---

## Support

- **Groq Docs**: https://console.groq.com/docs
- **Bedrock Docs**: https://docs.aws.amazon.com/bedrock/
- **Issues**: Check backend logs for detailed errors
