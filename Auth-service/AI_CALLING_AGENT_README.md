# AI Calling Agent 🤖📞

An intelligent calling agent powered by **Twilio**, **AWS Polly**, and **Groq API** for automated voice conversations.

## 🚀 Features

- **Real-time AI Conversations**: Ultra-fast responses using Groq's LLM inference
- **Natural Voice Synthesis**: High-quality text-to-speech with AWS Polly
- **Twilio Integration**: Reliable telephony infrastructure
- **Multi-voice Support**: 15+ voice options (male/female, accents)
- **Call Recording**: Automatic conversation logging
- **Webhook Handling**: Real-time call event processing
- **Conversation Memory**: Context-aware responses

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Twilio Voice  │    │  Your Server    │    │   Groq API      │
│   (Phone Calls) │◄──►│  (Node.js)      │◄──►│  (AI Responses) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   AWS Polly     │
                       │ (Text-to-Speech)│
                       └─────────────────┘
```

## 📋 Prerequisites

1. **Twilio Account**
   - Account SID
   - Auth Token  
   - Phone Number

2. **AWS Account**
   - Access Key ID
   - Secret Access Key
   - Polly service enabled

3. **Groq API Key**
   - Sign up at [console.groq.com](https://console.groq.com)
   - Get free API key (30 requests/min)

## ⚙️ Setup

### 1. Environment Variables

Add to your `.env` file:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Groq API Configuration  
GROQ_API_KEY=your_groq_api_key

# AWS Polly Configuration (uses existing AWS credentials)
POLLY_VOICE_ID=Joanna
POLLY_OUTPUT_FORMAT=mp3
POLLY_SAMPLE_RATE=22050
```

### 2. Install Dependencies

```bash
npm install twilio @aws-sdk/client-polly
```

### 3. Configure Twilio Webhooks

In your Twilio Console, set webhook URLs:

- **Voice URL**: `https://yourdomain.com/api/calling-agent/webhook`
- **Status Callback**: `https://yourdomain.com/api/calling-agent/webhook`

## 🎯 Usage

### Making an Outbound Call

```javascript
const callData = {
  phoneNumber: '+1234567890',
  purpose: 'Customer Support',
  initialMessage: 'Hello! This is an AI assistant calling to help you.',
  customerName: 'John Doe',
  voiceId: 'Joanna'
};

const response = await fetch('/api/calling-agent/initiate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(callData)
});
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/calling-agent/initiate` | Start an AI call |
| `POST` | `/api/calling-agent/webhook` | Twilio webhook handler |
| `POST` | `/api/calling-agent/speech` | Handle speech input |
| `GET` | `/api/calling-agent/calls` | Get active calls |
| `GET` | `/api/calling-agent/voices` | Get available voices |
| `POST` | `/api/calling-agent/test-tts` | Test text-to-speech |
| `POST` | `/api/calling-agent/test-ai` | Test AI responses |

## 🎵 Available Voices

### English (US)
- **Joanna** (Female, neutral) - *Default*
- **Matthew** (Male, neutral)
- **Kendra** (Female, neutral)
- **Justin** (Male, young adult)
- **Joey** (Male, neutral)

### English (British)
- **Amy** (Female, British)
- **Emma** (Female, British)  
- **Brian** (Male, British)

### English (Australian)
- **Nicole** (Female, Australian)
- **Russell** (Male, Australian)

### English (Indian)
- **Aditi** (Female, Indian)
- **Raveena** (Female, Indian)

## 🧪 Testing

### Run Test Suite
```bash
node test-calling-agent.js
```

### Run Demo
```bash
node examples/calling-agent-demo.js
```

### Test Individual Components

**Test Text-to-Speech:**
```bash
curl -X POST http://localhost:3000/api/calling-agent/test-tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "voiceId": "Joanna"}'
```

**Test AI Response:**
```bash
curl -X POST http://localhost:3000/api/calling-agent/test-ai \
  -H "Content-Type: application/json" \
  -d '{"prompt": "How can I help you?"}'
```

## 📞 Call Flow

1. **Initiate Call** → Twilio dials number
2. **Call Answered** → Play initial message
3. **Listen for Speech** → Capture user input
4. **Generate AI Response** → Process with Groq
5. **Convert to Speech** → AWS Polly TTS
6. **Play Response** → Continue conversation
7. **End Call** → Save conversation log

## 🔧 Configuration

### Custom AI Prompts

```javascript
const customPrompt = `
You are a customer service agent for XYZ Company.
- Be friendly and professional
- Ask for order numbers when needed
- Offer to escalate to human if needed
- Keep responses under 30 seconds
`;
```

### Voice Settings

```javascript
const voiceConfig = {
  voiceId: 'Matthew',        // Male voice
  speechRate: 'medium',      // slow, medium, fast
  volume: 'medium',          // soft, medium, loud
  engine: 'neural'           // standard, neural
};
```

## 📊 Call Scenarios

### Customer Support
```javascript
{
  purpose: 'Customer Support',
  initialMessage: 'Hello! I\'m calling to help resolve any issues.',
  customPrompt: 'Be empathetic and solution-focused.'
}
```

### Sales Follow-up
```javascript
{
  purpose: 'Sales Follow-up', 
  initialMessage: 'Hi! Following up on your product inquiry.',
  customPrompt: 'Highlight benefits and offer demos.'
}
```

### Appointment Reminder
```javascript
{
  purpose: 'Appointment Reminder',
  initialMessage: 'Reminder: Your appointment is tomorrow at 2 PM.',
  customPrompt: 'Confirm time and ask about rescheduling.'
}
```

## 🚨 Error Handling

The system gracefully handles:
- **Network Issues**: Automatic retries
- **API Failures**: Fallback responses  
- **Call Drops**: Proper cleanup
- **Invalid Input**: Error messages
- **Rate Limits**: Queue management

## 📈 Monitoring

### Active Calls
```bash
curl http://localhost:3000/api/calling-agent/calls
```

### Call History
```bash
curl http://localhost:3000/api/calling-agent/history/SESSION_ID
```

## 🔒 Security

- **Input Validation**: All user inputs sanitized
- **Rate Limiting**: Prevents abuse
- **Webhook Verification**: Validates Twilio requests
- **Environment Variables**: Secure credential storage
- **HTTPS Required**: Encrypted communication

## 💰 Cost Optimization

### Groq API (Free Tier)
- 30 requests/minute
- 14,400 tokens/minute
- Perfect for small-medium usage

### AWS Polly Pricing
- $4.00 per 1M characters
- Neural voices: $16.00 per 1M characters
- First 5M characters free (12 months)

### Twilio Pricing
- Outbound calls: ~$0.013/minute (US)
- Phone number: $1/month
- Recording: $0.0025/minute

## 🛠️ Troubleshooting

### Common Issues

**"GROQ_API_KEY not found"**
```bash
# Add to .env file
GROQ_API_KEY=your_actual_api_key
```

**"Twilio webhook failed"**
- Check webhook URL is publicly accessible
- Verify HTTPS (required for production)
- Check Twilio console for error logs

**"AWS Polly access denied"**
- Verify AWS credentials
- Check IAM permissions for Polly
- Ensure correct region

### Debug Mode

Enable detailed logging:
```javascript
process.env.DEBUG_CALLING_AGENT = 'true';
```

## 🚀 Production Deployment

1. **Use HTTPS**: Required for Twilio webhooks
2. **Set Webhook URLs**: Update Twilio console
3. **Monitor Logs**: Set up error tracking
4. **Scale Considerations**: Handle concurrent calls
5. **Backup Strategy**: Store conversation logs

## 📚 Resources

- [Twilio Voice API Docs](https://www.twilio.com/docs/voice)
- [AWS Polly Developer Guide](https://docs.aws.amazon.com/polly/)
- [Groq API Documentation](https://console.groq.com/docs)
- [TwiML Reference](https://www.twilio.com/docs/voice/twiml)

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Review Twilio console logs
3. Test individual components
4. Check environment variables

---

**Ready to make your first AI call?** 🎉

Run the test suite and start building intelligent voice experiences!