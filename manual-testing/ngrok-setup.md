# 🌐 Ngrok Setup Guide for SMS Webhook Testing

This guide will walk you through setting up ngrok to test your SMS system with real Twilio webhooks.

## Prerequisites

- ✅ SMS application running on `localhost:3000`
- ✅ Twilio account with phone number
- ✅ Test subscriber added to your system

## Step 1: Install ngrok

### Option A: npm (Recommended)
```bash
npm install -g ngrok
```

### Option B: Download Binary
1. Go to [ngrok.com](https://ngrok.com)
2. Sign up for free account
3. Download ngrok for your platform
4. Extract and add to PATH

### Option C: Homebrew (macOS)
```bash
brew install ngrok/ngrok/ngrok
```

## Step 2: Authenticate ngrok (Optional but Recommended)

1. Sign up at [ngrok.com](https://ngrok.com)
2. Get your auth token from dashboard
3. Configure ngrok:
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

**Benefits of authentication:**
- Longer session duration
- Custom subdomain (paid plans)
- Enhanced security features

## Step 3: Start Your Application

Ensure your SMS application is running:
```bash
cd /Users/nicholasrabow/Desktop/sanctuary
npm run dev
```

Verify it's accessible at: http://localhost:3000

## Step 4: Start ngrok Tunnel

### Basic Command
```bash
ngrok http 3000
```

### Advanced Command with Webhook Verification
```bash
ngrok http 3000 --verify-webhook twilio --verify-webhook-secret YOUR_TWILIO_AUTH_TOKEN
```

Replace `YOUR_TWILIO_AUTH_TOKEN` with your actual Twilio auth token from `.env` file.

### Sample ngrok Output
```
ngrok                                                                                                                                                                 
                                                                                                                                                                      
Session Status                online                                                                                                                                    
Account                       your-email@example.com (Plan: Free)                                                                                                       
Version                       3.5.0                                                                                                                                     
Region                        United States (us)                                                                                                                        
Latency                       -                                                                                                                                         
Web Interface                 http://127.0.0.1:4040                                                                                                                    
Forwarding                    https://abc123-def456.ngrok-free.app -> http://localhost:3000                                                                           

Connections                   ttl     opn     rt1     rt5     p50     p90                                                                                               
                              0       0       0.00    0.00    0.00    0.00                                                                                              
```

**Important:** Copy the `https://` URL (e.g., `https://abc123-def456.ngrok-free.app`)

## Step 5: Configure Twilio Webhook

1. **Go to Twilio Console**
   - Visit [console.twilio.com](https://console.twilio.com)
   - Navigate to **Phone Numbers → Manage → Active Numbers**

2. **Select Your Phone Number**
   - Click on the phone number you want to use for testing

3. **Configure Messaging Webhook**
   - Scroll to the **Messaging** section
   - Set **Webhook URL** to: `https://YOUR_NGROK_URL.ngrok-free.app/api/webhooks/sms`
   - Set **HTTP Method** to: `HTTP POST`
   - Click **Save Configuration**

### Example Webhook URL
```
https://abc123-def456.ngrok-free.app/api/webhooks/sms
```

## Step 6: Test the Setup

### 6.1 Test Webhook Delivery
1. Send "TRIBE" from your phone to your Twilio number
2. Check ngrok terminal for incoming requests
3. Check your application logs
4. Verify response SMS received

### 6.2 Monitor with ngrok Inspector
1. Open: http://localhost:4040
2. View all incoming webhook requests
3. Inspect request/response details
4. Replay requests for debugging

### Sample ngrok Request Log
```
POST /api/webhooks/sms          200 OK
├── From: +15551234567
├── To: +15559876543  
├── Body: TRIBE
└── MessageSid: SM123abc...
```

## Step 7: Testing Scenarios

### 7.1 Opt-in Flow Test
```
📱 Send: "TRIBE"
📞 Expected: Welcome message response
🎯 Verify: Subscriber created in dashboard
```

### 7.2 Regular Message Test
```
📱 Send: "Hello, this is a test message"
📞 Expected: Message forwarded to Slack
🎯 Verify: No auto-response
```

### 7.3 Opt-out Flow Test
```
📱 Send: "STOP"
📞 Expected: Opt-out confirmation
🎯 Verify: Subscriber marked inactive
```

### 7.4 Broadcast Test
```
🌐 Action: Send broadcast from dashboard
📱 Expected: SMS received on your phone
🎯 Verify: Message logged in system
```

## Step 8: Troubleshooting

### Common Issues

#### ❌ ngrok not found
```bash
# Fix: Install ngrok
npm install -g ngrok
```

#### ❌ Tunnel not accessible
```bash
# Fix: Check if port 3000 is in use
lsof -i :3000
# Kill process if needed
kill -9 PID
```

#### ❌ Webhook not receiving requests
1. Verify ngrok URL is correct in Twilio console
2. Check ngrok tunnel is active
3. Ensure `/api/webhooks/sms` endpoint exists
4. Check Twilio console error logs

#### ❌ Invalid webhook signature
1. Use webhook verification in ngrok:
```bash
ngrok http 3000 --verify-webhook twilio --verify-webhook-secret YOUR_AUTH_TOKEN
```

#### ❌ Application not responding
1. Check application is running on port 3000
2. Test directly: curl http://localhost:3000/api/dashboard/stats
3. Check application logs for errors

### Debugging Tools

#### ngrok Inspector (http://localhost:4040)
- View all HTTP requests
- Inspect headers and payload
- Replay requests
- Monitor response times

#### Twilio Console Logs
- Go to Monitor → Logs → Webhooks
- View webhook delivery attempts
- Check error details

#### Application Logs
```bash
# View application logs
npm run dev
# Check webhook processing logs in terminal
```

## Step 9: Advanced Configuration

### Custom Subdomain (Paid Plans)
```bash
ngrok http 3000 --subdomain=your-custom-name
```

### Configuration File
Create `~/.ngrok2/ngrok.yml`:
```yaml
version: "2"
authtoken: YOUR_AUTH_TOKEN
tunnels:
  sms-webhook:
    proto: http
    addr: 3000
    subdomain: your-custom-name
```

Start with config:
```bash
ngrok start sms-webhook
```

### Multiple Tunnels
```bash
# Terminal 1: Development server
ngrok http 3000

# Terminal 2: Testing server  
ngrok http 3001
```

## Step 10: Production Considerations

### Security
- ✅ Use webhook signature verification
- ✅ Implement rate limiting
- ✅ Validate all input data
- ✅ Use HTTPS only

### Performance
- ✅ Monitor response times via ngrok inspector
- ✅ Optimize webhook processing
- ✅ Handle webhook retries properly

### Reliability
- ✅ Implement proper error handling
- ✅ Log all webhook events
- ✅ Set up monitoring/alerts

## Quick Reference

### Essential Commands
```bash
# Start application
npm run dev

# Start ngrok (basic)
ngrok http 3000

# Start ngrok (with verification)
ngrok http 3000 --verify-webhook twilio --verify-webhook-secret YOUR_TOKEN

# View inspector
open http://localhost:4040
```

### Important URLs
- **Application:** http://localhost:3000
- **Dashboard:** http://localhost:3000/dashboard
- **Webhook Endpoint:** /api/webhooks/sms
- **ngrok Inspector:** http://localhost:4040
- **Twilio Console:** https://console.twilio.com

### Test Phone Numbers Format
- **Your Phone:** +1XXXXXXXXXX
- **Twilio Phone:** +1XXXXXXXXXX (from console)

## Support

If you encounter issues:
1. Run the health check: `npx tsx manual-testing/health-check.ts`
2. Test with webhook simulator: `npx tsx manual-testing/webhook-simulator.ts`
3. Check application logs and ngrok inspector
4. Verify Twilio console configuration

---

**🎉 You're ready to test your SMS system with real webhooks!**

Start with sending "TRIBE" to your Twilio number and watch the magic happen. 🚀