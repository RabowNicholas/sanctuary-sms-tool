// End-to-end testing script for comprehensive system validation
import { config } from 'dotenv';
import { PrismaClient } from '@/generated/prisma';
import { runHealthCheck } from './health-check';
import { WebhookSimulator } from './webhook-simulator';
import readline from 'readline';

config();

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
  duration?: number;
}

interface E2ETestConfig {
  userPhoneNumber: string;
  twilioPhoneNumber: string;
  baseUrl: string;
  skipHealthCheck?: boolean;
}

class EndToEndTester {
  private prisma: PrismaClient;
  private config: E2ETestConfig;
  private results: TestResult[] = [];

  constructor(config: E2ETestConfig) {
    this.prisma = new PrismaClient();
    this.config = config;
  }

  private async addResult(testName: string, passed: boolean, message: string, details?: any, duration?: number): Promise<void> {
    this.results.push({ testName, passed, message, details, duration });
    
    const icon = passed ? '✅' : '❌';
    const durationText = duration ? ` (${duration}ms)` : '';
    console.log(`${icon} ${testName}${durationText}: ${message}`);
    
    if (details && !passed) {
      console.log(`   Details:`, details);
    }
  }

  async testDashboardAPI(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.config.baseUrl}/api/dashboard/stats`);
      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        await this.addResult(
          'Dashboard API', 
          true, 
          'API responding correctly', 
          data, 
          duration
        );
      } else {
        await this.addResult(
          'Dashboard API', 
          false, 
          `API returned ${response.status}`, 
          { status: response.status, statusText: response.statusText }, 
          duration
        );
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.addResult(
        'Dashboard API', 
        false, 
        'API connection failed', 
        { error: error.message }, 
        duration
      );
    }
  }

  async testSubscriberCreation(): Promise<string | null> {
    const startTime = Date.now();
    
    try {
      // Check if subscriber already exists
      const existingSubscriber = await this.prisma.subscriber.findUnique({
        where: { phoneNumber: this.config.userPhoneNumber },
      });

      if (existingSubscriber) {
        const duration = Date.now() - startTime;
        await this.addResult(
          'Subscriber Exists', 
          true, 
          'Test subscriber found in database', 
          { id: existingSubscriber.id, active: existingSubscriber.isActive }, 
          duration
        );
        return existingSubscriber.id;
      }

      // Create subscriber via API
      const response = await fetch(`${this.config.baseUrl}/api/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: this.config.userPhoneNumber }),
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        const subscriber = await response.json();
        await this.addResult(
          'Subscriber Creation', 
          true, 
          'Subscriber created successfully', 
          { id: subscriber.id }, 
          duration
        );
        return subscriber.id;
      } else {
        const errorData = await response.json();
        await this.addResult(
          'Subscriber Creation', 
          false, 
          'Failed to create subscriber', 
          errorData, 
          duration
        );
        return null;
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.addResult(
        'Subscriber Creation', 
        false, 
        'Subscriber creation error', 
        { error: error.message }, 
        duration
      );
      return null;
    }
  }

  async testWebhookFlow(): Promise<void> {
    const simulator = new WebhookSimulator(this.config.baseUrl);
    
    // Test opt-in webhook
    const startTime = Date.now();
    try {
      const result = await simulator.simulateWebhook({
        from: this.config.userPhoneNumber,
        to: this.config.twilioPhoneNumber,
        body: 'TRIBE',
      });

      const duration = Date.now() - startTime;
      
      if (result.status === 200) {
        await this.addResult(
          'Webhook Processing', 
          true, 
          'TRIBE opt-in webhook processed', 
          { status: result.status }, 
          duration
        );
      } else {
        await this.addResult(
          'Webhook Processing', 
          false, 
          `Webhook returned ${result.status}`, 
          result, 
          duration
        );
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.addResult(
        'Webhook Processing', 
        false, 
        'Webhook simulation failed', 
        { error: error.message }, 
        duration
      );
    }
  }

  async testBroadcastAPI(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const testMessage = 'Test broadcast message for manual testing';
      
      const response = await fetch(`${this.config.baseUrl}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage }),
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        const result = await response.json();
        await this.addResult(
          'Broadcast API', 
          true, 
          `Broadcast sent to ${result.sentTo} subscribers`, 
          { sentTo: result.sentTo, cost: result.totalCost }, 
          duration
        );
      } else {
        const errorData = await response.json();
        await this.addResult(
          'Broadcast API', 
          false, 
          'Broadcast failed', 
          errorData, 
          duration
        );
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.addResult(
        'Broadcast API', 
        false, 
        'Broadcast API error', 
        { error: error.message }, 
        duration
      );
    }
  }

  async testMessageStorage(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const messageCount = await this.prisma.message.count({
        where: { phoneNumber: this.config.userPhoneNumber },
      });

      const duration = Date.now() - startTime;
      
      await this.addResult(
        'Message Storage', 
        true, 
        `Found ${messageCount} messages for test number`, 
        { messageCount }, 
        duration
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.addResult(
        'Message Storage', 
        false, 
        'Failed to query messages', 
        { error: error.message }, 
        duration
      );
    }
  }

  async testSubscriberManagement(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test getting all subscribers
      const response = await fetch(`${this.config.baseUrl}/api/subscribers`);
      
      if (response.ok) {
        const subscribers = await response.json();
        const testSubscriber = subscribers.find((s: any) => s.phoneNumber === this.config.userPhoneNumber);
        
        const duration = Date.now() - startTime;
        
        if (testSubscriber) {
          await this.addResult(
            'Subscriber Management', 
            true, 
            'Test subscriber found in API response', 
            { 
              id: testSubscriber.id, 
              active: testSubscriber.isActive,
              messageCount: testSubscriber._count?.messages || 0
            }, 
            duration
          );
        } else {
          await this.addResult(
            'Subscriber Management', 
            false, 
            'Test subscriber not found in API response', 
            { totalSubscribers: subscribers.length }, 
            duration
          );
        }
      } else {
        const duration = Date.now() - startTime;
        await this.addResult(
          'Subscriber Management', 
          false, 
          `Subscriber API returned ${response.status}`, 
          { status: response.status }, 
          duration
        );
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.addResult(
        'Subscriber Management', 
        false, 
        'Subscriber API error', 
        { error: error.message }, 
        duration
      );
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Running End-to-End Tests...\n');
    console.log(`📱 Test Phone: ${this.config.userPhoneNumber}`);
    console.log(`📞 Twilio Phone: ${this.config.twilioPhoneNumber}`);
    console.log(`🌐 Base URL: ${this.config.baseUrl}`);
    console.log(`📅 Started: ${new Date().toLocaleString()}\n`);

    const overallStartTime = Date.now();

    // Run health check first (unless skipped)
    if (!this.config.skipHealthCheck) {
      console.log('🏥 Running System Health Check...');
      const healthStatus = await runHealthCheck();
      
      if (healthStatus !== 'HEALTHY') {
        console.log('\n⚠️  System health issues detected. Continuing with tests...\n');
      } else {
        console.log('\n✅ System health check passed\n');
      }
    }

    console.log('🎯 Running Core Tests...\n');

    // Core system tests
    await this.testDashboardAPI();
    await this.testSubscriberCreation();
    await this.testSubscriberManagement();
    await this.testWebhookFlow();
    await this.testMessageStorage();
    await this.testBroadcastAPI();

    const overallDuration = Date.now() - overallStartTime;

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log(`\n📈 Results: ${passed}/${total} tests passed`);
    console.log(`⏱️  Total Duration: ${overallDuration}ms`);
    console.log(`🎯 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`   • ${result.testName}: ${result.message}`);
      });
    }

    console.log('\n🎯 Next Steps for Manual Testing:');
    if (passed === total) {
      console.log('✅ All automated tests passed! Ready for manual testing:');
      console.log('   1. Set up ngrok for webhook testing');
      console.log('   2. Configure Twilio webhook URL');
      console.log('   3. Send real SMS messages to test end-to-end');
      console.log('   4. Test dashboard functionality in browser');
      console.log('   5. Verify Slack integration (if configured)');
    } else {
      console.log('⚠️  Some tests failed. Fix issues before manual testing:');
      console.log('   1. Review failed test details above');
      console.log('   2. Check application logs');
      console.log('   3. Verify environment configuration');
      console.log('   4. Re-run tests after fixes');
    }

    console.log('\n📚 Testing Resources:');
    console.log('   • Webhook Simulator: npx tsx manual-testing/webhook-simulator.ts');
    console.log('   • Health Check: npx tsx manual-testing/health-check.ts');
    console.log('   • Dashboard: http://localhost:3000');
    console.log('   • Ngrok Setup: manual-testing/ngrok-setup.md');
  }

  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

async function promptForConfig(): Promise<E2ETestConfig> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const userPhoneNumber = await new Promise<string>((resolve) => {
    rl.question('📱 Enter your phone number (+1XXXXXXXXXX): ', (answer) => {
      resolve(answer.trim());
    });
  });

  const twilioPhoneNumber = await new Promise<string>((resolve) => {
    rl.question('📞 Enter your Twilio phone number (+1XXXXXXXXXX): ', (answer) => {
      resolve(answer.trim());
      rl.close();
    });
  });

  return {
    userPhoneNumber,
    twilioPhoneNumber,
    baseUrl: 'http://localhost:3000',
  };
}

async function runEndToEndTest(): Promise<void> {
  console.log('🚀 End-to-End SMS System Test\n');
  console.log('This comprehensive test validates all system components');
  console.log('including APIs, database, webhooks, and integrations.\n');

  try {
    // Get configuration
    const config = await promptForConfig();

    // Run tests
    const tester = new EndToEndTester(config);
    await tester.runAllTests();
    await tester.cleanup();

  } catch (error: any) {
    console.error('\n❌ End-to-end test failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   • Ensure application is running on localhost:3000');
    console.log('   • Check database connectivity');
    console.log('   • Verify environment variables');
    console.log('   • Run individual test scripts first');
  }
}

// Command line interface
if (require.main === module) {
  runEndToEndTest().catch(console.error);
}

export { EndToEndTester, runEndToEndTest };