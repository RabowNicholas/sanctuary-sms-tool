# 🧪 Manual Testing Suite for SMS System

This directory contains comprehensive testing tools to validate your SMS system end-to-end with your real phone number.

## 📁 Testing Tools

### 🏥 `health-check.ts`
**System health verification**
```bash
npx tsx manual-testing/health-check.ts
```
- ✅ Database connectivity
- ✅ Twilio configuration  
- ✅ Slack integration
- ✅ API endpoints
- ✅ Environment setup

### 🔧 `test-setup.ts`
**Prepare your phone number for testing**
```bash
npx tsx manual-testing/test-setup.ts
# Or with phone number directly:
npx tsx manual-testing/test-setup.ts +15551234567
```
- 📱 Adds your phone as test subscriber
- ✅ Validates phone number format
- 📋 Provides testing instructions
- 🔄 Reactivates if already exists

### 🎭 `webhook-simulator.ts`
**Test SMS flows without real messages**
```bash
npx tsx manual-testing/webhook-simulator.ts
```
- 🔸 Opt-in flow simulation (TRIBE)
- 🔸 Regular message handling
- 🔸 Opt-out flow (STOP)
- 🔸 Edge cases and error handling
- 📊 Interactive scenario selection

### 🚀 `end-to-end-test.ts`
**Comprehensive system validation**
```bash
npx tsx manual-testing/end-to-end-test.ts
```
- 🏥 Health check integration
- 📊 API endpoint testing
- 👥 Subscriber management
- 📡 Webhook processing
- 💬 Message storage
- 📢 Broadcast functionality

### 🧹 `cleanup.ts`
**Remove test data after testing**
```bash
npx tsx manual-testing/cleanup.ts
# Or clean specific number:
npx tsx manual-testing/cleanup.ts +15551234567
# Or clean all test data:
npx tsx manual-testing/cleanup.ts --all
```

### 📖 `ngrok-setup.md`
**Complete webhook configuration guide**
- 🌐 ngrok installation and setup
- 📞 Twilio webhook configuration
- 🔧 Troubleshooting guide
- 🎯 Testing scenarios

## 🎯 Testing Workflow

### Phase 1: System Verification
```bash
# 1. Check system health
npx tsx manual-testing/health-check.ts

# 2. Start your application  
npm run dev

# 3. Add your phone number for testing
npx tsx manual-testing/test-setup.ts
```

### Phase 2: Simulated Testing
```bash
# 4. Test webhook flows (no real SMS)
npx tsx manual-testing/webhook-simulator.ts

# 5. Run comprehensive tests
npx tsx manual-testing/end-to-end-test.ts
```

### Phase 3: Real SMS Testing
```bash
# 6. Set up ngrok tunnel
ngrok http 3000

# 7. Configure Twilio webhook (see ngrok-setup.md)
# Webhook URL: https://your-ngrok-url.ngrok.io/api/webhooks/sms

# 8. Test real SMS flows:
# • Send "TRIBE" to opt-in
# • Send regular messages  
# • Test broadcast from dashboard
# • Send "STOP" to opt-out
```

### Phase 4: Cleanup
```bash
# 9. Remove test data
npx tsx manual-testing/cleanup.ts
```

## 🎬 Testing Scenarios

### 📱 Opt-in Flow
1. **Send "TRIBE"** from your phone to Twilio number
2. **Expected:** Welcome message response
3. **Verify:** Subscriber created in dashboard

### 💬 Two-way Messaging  
1. **Send any message** after opt-in
2. **Expected:** Message appears in Slack thread
3. **Verify:** No auto-response sent

### 📢 Broadcast Testing
1. **Create broadcast** in dashboard
2. **Expected:** SMS received on your phone
3. **Verify:** Message logged in system

### 🛑 Opt-out Flow
1. **Send "STOP"** from your phone
2. **Expected:** Opt-out confirmation
3. **Verify:** Subscriber marked inactive

## 🔧 Troubleshooting

### Common Issues

#### ❌ Database Connection Failed
```bash
# Check database status
npx tsx manual-testing/health-check.ts

# Verify environment variables
cat .env | grep DATABASE_URL
```

#### ❌ Twilio Configuration Missing
```bash
# Check Twilio credentials
cat .env | grep TWILIO_
```

#### ❌ Application Not Running
```bash
# Start application
npm run dev

# Check if port 3000 is available
lsof -i :3000
```

#### ❌ Webhook Not Receiving
```bash
# Verify ngrok setup
ngrok http 3000

# Check Twilio console webhook URL
# Should be: https://your-ngrok-url.ngrok.io/api/webhooks/sms
```

### Debug Tools

#### ngrok Inspector
- **URL:** http://localhost:4040
- **View:** All webhook requests
- **Replay:** Failed requests
- **Monitor:** Response times

#### Application Logs
```bash
# Terminal running npm run dev
# Shows webhook processing logs
```

#### Twilio Console
- **Monitor → Logs → Webhooks**
- **View delivery attempts**
- **Check error details**

## 📊 Test Coverage

### ✅ Automated Tests Cover
- Database connectivity
- API endpoint functionality  
- Subscriber CRUD operations
- Webhook payload processing
- Message storage and retrieval
- Broadcast API functionality
- Cost calculations
- Error handling

### 📱 Manual Tests Cover
- Real SMS delivery
- Twilio webhook integration
- Slack notifications
- Dashboard user interface
- End-to-end message flow
- Network connectivity
- Production environment

## 🚨 Safety Measures

### ⚠️ Production Database
- Tests use your production database
- Only your phone number is added
- Clean up after testing
- No bulk test data created

### 💰 SMS Costs
- Real SMS messages cost money
- Twilio charges apply
- Monitor usage in Twilio console
- Use simulation mode when possible

### 🔒 Security
- Never commit phone numbers to git
- Keep Twilio credentials secure
- Use webhook verification in production
- Clean up test data regularly

## 📚 Quick Reference

### Essential Commands
```bash
# Health check
npx tsx manual-testing/health-check.ts

# Setup testing
npx tsx manual-testing/test-setup.ts

# Simulate webhooks  
npx tsx manual-testing/webhook-simulator.ts

# End-to-end tests
npx tsx manual-testing/end-to-end-test.ts

# Cleanup
npx tsx manual-testing/cleanup.ts
```

### Important URLs
- **Dashboard:** http://localhost:3000
- **Subscribers:** http://localhost:3000/dashboard/subscribers
- **ngrok Inspector:** http://localhost:4040
- **Twilio Console:** https://console.twilio.com

### Test Phone Numbers
- **Your Phone:** +1XXXXXXXXXX (for testing)
- **Twilio Phone:** +1XXXXXXXXXX (from console)

---

## 🎉 Ready to Test!

1. **Start with health check:** `npx tsx manual-testing/health-check.ts`
2. **Follow the workflow above** for comprehensive testing
3. **Use ngrok-setup.md** for webhook configuration
4. **Clean up when done:** `npx tsx manual-testing/cleanup.ts`

Your SMS system is ready for real-world testing! 🚀📱