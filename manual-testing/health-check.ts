// Comprehensive system health check for manual testing
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/index.js';

config();

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: any;
}

async function performHealthCheck(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  // 1. Database Health Check
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    
    const [subscriberCount, messageCount] = await Promise.all([
      prisma.subscriber.count(),
      prisma.message.count(),
    ]);
    
    results.push({
      service: 'Database (Neon PostgreSQL)',
      status: 'healthy',
      message: 'Connected successfully',
      details: {
        subscribers: subscriberCount,
        messages: messageCount,
        url: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown'
      }
    });
    
    await prisma.$disconnect();
  } catch (error: any) {
    results.push({
      service: 'Database (Neon PostgreSQL)',
      status: 'error',
      message: `Connection failed: ${error.message}`,
    });
  }

  // 2. Twilio Configuration Check
  const twilioConfig = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  };

  if (twilioConfig.accountSid && twilioConfig.authToken && twilioConfig.messagingServiceSid) {
    results.push({
      service: 'Twilio Configuration',
      status: 'healthy',
      message: 'All required credentials configured',
      details: {
        accountSid: twilioConfig.accountSid.substring(0, 10) + '...',
        messagingServiceSid: twilioConfig.messagingServiceSid,
        hasAuthToken: !!twilioConfig.authToken
      }
    });
  } else {
    results.push({
      service: 'Twilio Configuration',
      status: 'error',
      message: 'Missing required Twilio credentials',
      details: {
        hasAccountSid: !!twilioConfig.accountSid,
        hasAuthToken: !!twilioConfig.authToken,
        hasMessagingServiceSid: !!twilioConfig.messagingServiceSid
      }
    });
  }

  // 3. Slack Configuration Check
  const slackConfig = {
    botToken: process.env.SLACK_BOT_TOKEN,
    channel: process.env.SLACK_CHANNEL_ID,
  };

  if (slackConfig.botToken && slackConfig.channel) {
    results.push({
      service: 'Slack Configuration',
      status: 'healthy',
      message: 'Slack credentials configured',
      details: {
        channel: slackConfig.channel,
        hasToken: !!slackConfig.botToken
      }
    });
  } else {
    results.push({
      service: 'Slack Configuration',
      status: 'warning',
      message: 'Slack configuration missing (optional)',
      details: {
        hasToken: !!slackConfig.botToken,
        hasChannel: !!slackConfig.channel
      }
    });
  }

  // 4. API Endpoints Health Check
  try {
    const baseUrl = 'http://localhost:3000';
    
    // Test dashboard stats endpoint
    const statsResponse = await fetch(`${baseUrl}/api/dashboard/stats`);
    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      results.push({
        service: 'Dashboard API',
        status: 'healthy',
        message: 'API endpoints responding',
        details: statsData
      });
    } else {
      results.push({
        service: 'Dashboard API',
        status: 'error',
        message: `API not responding: ${statsResponse.status}`,
      });
    }
  } catch (error: any) {
    results.push({
      service: 'Dashboard API',
      status: 'error',
      message: `API connection failed: ${error.message}`,
    });
  }

  // 5. Environment Configuration Check
  const envCheck = {
    nodeEnv: process.env.NODE_ENV,
    nextauthSecret: process.env.NEXTAUTH_SECRET,
    adminPassword: process.env.ADMIN_PASSWORD,
  };

  if (envCheck.nodeEnv && envCheck.nextauthSecret) {
    results.push({
      service: 'Environment Configuration',
      status: 'healthy',
      message: 'Environment properly configured',
      details: {
        nodeEnv: envCheck.nodeEnv,
        hasAuthSecret: !!envCheck.nextauthSecret,
        hasAdminPassword: !!envCheck.adminPassword
      }
    });
  } else {
    results.push({
      service: 'Environment Configuration',
      status: 'warning',
      message: 'Some environment variables missing',
      details: envCheck
    });
  }

  return results;
}

async function runHealthCheck() {
  console.log('🏥 System Health Check Starting...\n');
  console.log('📅 ' + new Date().toLocaleString());
  console.log('🌍 Environment:', process.env.NODE_ENV || 'unknown');
  console.log('📍 Location: Manual Testing\n');

  const results = await performHealthCheck();
  
  let healthyCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  console.log('📊 Health Check Results:\n');
  
  results.forEach((result, index) => {
    const icon = result.status === 'healthy' ? '✅' : 
                 result.status === 'warning' ? '⚠️' : '❌';
    
    console.log(`${icon} ${result.service}`);
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Message: ${result.message}`);
    
    if (result.details) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 6));
    }
    console.log('');

    if (result.status === 'healthy') healthyCount++;
    else if (result.status === 'warning') warningCount++;
    else errorCount++;
  });

  console.log('📋 Summary:');
  console.log(`   ✅ Healthy: ${healthyCount}`);
  console.log(`   ⚠️  Warnings: ${warningCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📊 Total: ${results.length}`);

  const overallStatus = errorCount > 0 ? 'CRITICAL' : 
                       warningCount > 0 ? 'WARNING' : 'HEALTHY';
  
  console.log(`\n🎯 Overall System Status: ${overallStatus}`);
  
  if (overallStatus === 'HEALTHY') {
    console.log('\n🚀 System is ready for manual testing!');
    console.log('   Next steps:');
    console.log('   1. Run: npm run dev (if not already running)');
    console.log('   2. Setup ngrok for webhook testing');
    console.log('   3. Add your phone number as test subscriber');
    console.log('   4. Configure Twilio webhook URL');
  } else if (overallStatus === 'WARNING') {
    console.log('\n⚠️  System has warnings but may still function');
    console.log('   Review warnings above before proceeding');
  } else {
    console.log('\n❌ System has critical issues that must be resolved');
    console.log('   Fix errors above before manual testing');
  }

  return overallStatus;
}

// Run the health check
if (require.main === module) {
  runHealthCheck().catch(console.error);
}

export { runHealthCheck, performHealthCheck };