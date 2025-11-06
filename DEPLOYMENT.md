# 🚀 Production Deployment Guide

Complete guide to deploy your SMS Broadcast System to production using Vercel.

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] Neon PostgreSQL database (or other PostgreSQL provider)
- [ ] Twilio account with phone number and Messaging Service
- [ ] Slack workspace and bot token (optional)
- [ ] GitHub account
- [ ] Vercel account (free tier works)

---

## Step 1: Prepare Your Code

### 1.1 Commit All Changes

```bash
# Check git status
git status

# Add all files
git add .

# Commit changes
git commit -m "Production ready - SMS broadcast system with two-way messaging"

# Push to GitHub
git push origin main
```

### 1.2 Generate Secure Secrets

Generate a strong NextAuth secret:

```bash
openssl rand -base64 32
```

Copy the output - you'll need it for environment variables.

Generate a hashed admin password (recommended for production):

```bash
node -e "console.log(require('bcryptjs').hashSync('your-strong-password-here', 10))"
```

Copy the bcrypt hash (starts with `$2a$10$...`).

---

## Step 2: Deploy to Vercel

### 2.1 Import Project

1. Go to https://vercel.com
2. Click **"Add New Project"**
3. **Import your GitHub repository**
4. Select your repository: `sanctuary-texting-system`
5. Click **"Import"**

### 2.2 Configure Build Settings

Vercel should auto-detect Next.js. Verify these settings:

- **Framework Preset:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

### 2.3 Add Environment Variables

Click **"Environment Variables"** and add the following:

#### Database
```
DATABASE_URL = [Copy from your .env file - your Neon PostgreSQL connection string]
```

#### Twilio
```
TWILIO_ACCOUNT_SID = [Copy from your .env file - starts with AC]
TWILIO_AUTH_TOKEN = [Copy from your .env file]
TWILIO_MESSAGING_SERVICE_SID = [Copy from your .env file - starts with MG]
```

#### Slack (Optional)
```
SLACK_BOT_TOKEN = [Copy from your .env file - starts with xoxb-]
SLACK_CHANNEL_ID = [Copy from your .env file - starts with C]
```

#### Authentication
```
NEXTAUTH_SECRET = [paste the output from openssl rand -base64 32]
NEXTAUTH_URL = https://your-app-name.vercel.app
ADMIN_USERNAME = admin
ADMIN_PASSWORD_HASH = [paste your bcrypt hash from earlier]
```

**⚠️ IMPORTANT:** Use `ADMIN_PASSWORD_HASH` in production, NOT `ADMIN_PASSWORD`

#### SMS Notifications
```
ADMIN_PHONE_NUMBER = [Your phone number in format: +1XXXXXXXXXX]
ENABLE_SMS_NOTIFICATIONS = true
```

#### Application
```
NODE_ENV = production
```

### 2.4 Deploy

1. Click **"Deploy"**
2. Wait 2-3 minutes for build to complete
3. You'll get a URL like: `https://your-app-name.vercel.app`

---

## Step 3: Database Setup

Your Neon database should already be set up from development, but verify:

### 3.1 Check Database Schema

```bash
# Test database connection
npx tsx manual-testing/health-check.ts
```

If you need to regenerate the schema:

```bash
npm run db:push
```

### 3.2 Verify Database Connection

1. Go to https://console.neon.tech
2. Open your project
3. Navigate to **"SQL Editor"**
4. Run: `SELECT COUNT(*) FROM "Subscriber";`

Should return your subscriber count.

---

## Step 4: Configure Twilio Webhook

### 4.1 Update Webhook URL

1. Go to https://console.twilio.com
2. Navigate to **Phone Numbers → Manage → Active Numbers**
3. Click your phone number
4. Scroll to **"Messaging Configuration"**
5. Under **"A MESSAGE COMES IN"**:
   - Webhook URL: `https://your-app-name.vercel.app/api/webhooks/sms`
   - HTTP Method: **POST**
6. Click **"Save"**

### 4.2 Test Webhook

Send "TRIBE" to your Twilio number from your phone.

Check Vercel logs:
1. Go to Vercel dashboard
2. Click your project
3. Go to **"Deployments"**
4. Click latest deployment
5. Go to **"Functions"** tab
6. You should see webhook logs

---

## Step 5: Test Everything

### 5.1 Test Opt-In

From your phone, send:
```
TRIBE
```

**Expected:**
- You get auto-response: "Welcome! You're subscribed..."
- Slack notification (if enabled)
- You appear in dashboard subscribers list

### 5.2 Test Regular Message

Send any message (not TRIBE/STOP):
```
Hey, this is a test message!
```

**Expected:**
- You receive SMS notification on your admin phone
- Notification includes link to conversation
- Message appears in dashboard
- Slack notification (if enabled)

### 5.3 Test Dashboard Access

1. Go to: `https://your-app-name.vercel.app/dashboard`
2. Login with:
   - Username: `admin`
   - Password: [your password, not the hash]
3. Verify stats load correctly
4. Click on your phone number in recent messages
5. Verify conversation opens

### 5.4 Test Reply

1. Open conversation in dashboard
2. Type a reply
3. Click **"Send"**

**Expected:**
- You receive the SMS on your phone
- Message appears in conversation thread
- Cost is calculated correctly

### 5.5 Test Broadcast

1. Go to dashboard home
2. Type a broadcast message
3. Click **"Send to X Subscribers"**

**Expected:**
- All active subscribers receive the message
- Success message shows count and cost
- Messages appear in dashboard feed

---

## Step 6: Production Checklist

After deployment, verify:

- [ ] Dashboard is accessible at production URL
- [ ] Login works with admin credentials
- [ ] Stats load correctly
- [ ] Twilio webhook receives messages
- [ ] SMS notifications work
- [ ] Conversation view loads
- [ ] Reply functionality works
- [ ] Broadcast works
- [ ] Opt-in (TRIBE) works
- [ ] Opt-out (STOP) works
- [ ] Slack notifications work (if enabled)

---

## 🔒 Security Best Practices

### Production Security

1. **Never use plain text passwords**
   - Always use `ADMIN_PASSWORD_HASH` in production
   - Remove `ADMIN_PASSWORD` from production environment

2. **Rotate secrets regularly**
   - Change `NEXTAUTH_SECRET` every 90 days
   - Rotate Twilio auth token if compromised

3. **Monitor webhook signatures (recommended)**

   Add Twilio signature validation to webhook:

   ```typescript
   // In src/app/api/webhooks/sms/route.ts
   import { validateRequest } from 'twilio';

   const twilioSignature = request.headers.get('x-twilio-signature');
   const url = `${process.env.NEXTAUTH_URL}/api/webhooks/sms`;
   const params = Object.fromEntries(formData);

   const isValid = validateRequest(
     process.env.TWILIO_AUTH_TOKEN!,
     twilioSignature!,
     url,
     params
   );

   if (!isValid) {
     return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
   }
   ```

4. **Enable rate limiting**
   - Use Vercel's built-in rate limiting
   - Or add custom rate limiting middleware

5. **Set up error monitoring**
   - Add Sentry: https://sentry.io
   - Monitor webhook errors in Vercel logs

### Environment Variable Security

- Never commit `.env` to git (already in `.gitignore`)
- Use Vercel's encrypted environment variables
- Limit who has access to Vercel project settings

---

## 📊 Monitoring & Logs

### Vercel Logs

View real-time logs:
1. Go to Vercel dashboard
2. Click your project
3. Go to **"Logs"** or **"Functions"**
4. Filter by function: `/api/webhooks/sms`

### Twilio Logs

Monitor SMS delivery:
1. Go to https://console.twilio.com
2. Navigate to **"Monitor → Logs → Messaging"**
3. View all sent/received messages
4. Check delivery status

### Neon Database Logs

Monitor database performance:
1. Go to https://console.neon.tech
2. Open your project
3. Go to **"Monitoring"**
4. Check connection count, query performance

### Slack Logs (Optional)

Check Slack notifications:
1. Open your Slack workspace
2. Go to `#tribe-convos` channel
3. Verify message threading works

---

## 🚨 Troubleshooting

### Issue: Webhook Not Receiving Messages

**Symptoms:** Send SMS, nothing happens

**Solutions:**
1. Check Twilio webhook configuration
   - URL should be: `https://your-app.vercel.app/api/webhooks/sms`
   - Method should be: **POST**

2. Check Vercel function logs
   - Go to Vercel → Functions
   - Look for `/api/webhooks/sms` errors

3. Test webhook directly:
   ```bash
   curl -X POST https://your-app.vercel.app/api/webhooks/sms \
     -d "From=+15551234567" \
     -d "Body=TRIBE" \
     -d "MessageSid=SM123" \
     -d "To=+15559876543"
   ```

### Issue: Database Connection Failed

**Symptoms:** Dashboard won't load, errors mention Prisma

**Solutions:**
1. Verify `DATABASE_URL` in Vercel environment variables
2. Check Neon database is active (not paused)
3. Regenerate Prisma client:
   ```bash
   npm run db:generate
   npm run build
   git commit -am "Regenerate Prisma client"
   git push
   ```

### Issue: Admin Login Not Working

**Symptoms:** "Invalid username or password"

**Solutions:**
1. Verify `ADMIN_USERNAME` matches what you're typing
2. If using `ADMIN_PASSWORD_HASH`:
   - Make sure you're entering the **original password**, not the hash
   - Regenerate hash if needed:
     ```bash
     node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
     ```
3. Check `NEXTAUTH_SECRET` is set and matches across all environments

### Issue: SMS Notifications Not Arriving

**Symptoms:** Messages work, but you don't get notifications

**Solutions:**
1. Verify `ADMIN_PHONE_NUMBER` is correct in Vercel
   - Format: `+1XXXXXXXXXX` (US numbers only)
2. Check `ENABLE_SMS_NOTIFICATIONS` is set to `true`
3. Check Twilio logs for notification delivery status
4. Verify you're not texting from the same number as `ADMIN_PHONE_NUMBER`

### Issue: High Twilio Costs

**Symptoms:** Unexpected charges

**Solutions:**
1. Check Twilio console for usage
2. Verify you're not in a notification loop
3. Consider disabling notifications:
   ```
   ENABLE_SMS_NOTIFICATIONS = false
   ```
4. Monitor subscriber count in dashboard

### Issue: Vercel Build Fails

**Symptoms:** Deployment shows "Build Error"

**Solutions:**
1. Check build logs in Vercel
2. Ensure all dependencies are in `package.json`
3. Run locally to verify:
   ```bash
   npm run build
   ```
4. Common issues:
   - Missing environment variables
   - TypeScript errors
   - Prisma schema issues

---

## 🔄 Updating Production

When you make changes:

### Method 1: Git Push (Recommended)

```bash
# Make changes locally
# Test thoroughly

# Commit and push
git add .
git commit -m "Your change description"
git push origin main

# Vercel auto-deploys from main branch
```

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Rollback Deployment

If something breaks:

1. Go to Vercel dashboard
2. Click **"Deployments"**
3. Find last working deployment
4. Click **"..."** → **"Promote to Production"**

---

## 📈 Scaling Considerations

### Current Setup (Free Tier)
- **Vercel:** Free tier supports ~100 req/min
- **Neon:** Free tier supports 1 database, 3 GB storage
- **Twilio:** Pay-as-you-go (~$0.0083 per SMS)

### When to Upgrade

**Upgrade Vercel ($20/month) when:**
- More than 100 concurrent users
- Need custom domains
- Need more function execution time

**Upgrade Neon ($19/month) when:**
- Database size exceeds 3 GB
- Need better performance
- Need more concurrent connections

**Optimize Twilio costs:**
- Use Messaging Services with multiple phone numbers
- Consider messaging limits per subscriber
- Monitor usage in Twilio console

---

## 🎯 Production URL

Your production app will be at:
```
https://your-app-name.vercel.app
```

**Important URLs:**
- Dashboard: `https://your-app-name.vercel.app/dashboard`
- Webhook: `https://your-app-name.vercel.app/api/webhooks/sms`
- Login: `https://your-app-name.vercel.app/login`

---

## 📞 Support Resources

- **Vercel Docs:** https://vercel.com/docs
- **Twilio Docs:** https://www.twilio.com/docs
- **Neon Docs:** https://neon.tech/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs

---

## ✅ Final Checklist

Before going live to users:

- [ ] Deployed to Vercel successfully
- [ ] All environment variables configured
- [ ] Twilio webhook configured and tested
- [ ] Database connected and working
- [ ] Admin login works
- [ ] Broadcast tested and working
- [ ] Two-way messaging tested
- [ ] SMS notifications working
- [ ] Slack notifications working (if enabled)
- [ ] Changed default admin password
- [ ] Using `ADMIN_PASSWORD_HASH` in production
- [ ] Monitoring/logs configured
- [ ] Tested from real phone number
- [ ] Reviewed Twilio pricing
- [ ] Set up billing alerts in Twilio

---

**🎉 Congratulations!** Your SMS Broadcast System is now live in production!

Monitor your first few days closely and check:
- Twilio costs
- Vercel function usage
- Database performance
- User feedback

For issues or questions, check the Troubleshooting section above.
