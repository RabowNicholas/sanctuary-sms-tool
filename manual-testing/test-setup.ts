// Manual test setup - adds your phone number for testing
import { config } from 'dotenv';
import { PrismaClient } from '@/generated/prisma';
import { Subscriber } from '@/domain/entities/Subscriber';
import readline from 'readline';

config();

interface TestSetupConfig {
  phoneNumber: string;
  testName?: string;
  skipConfirmation?: boolean;
}

async function promptForPhoneNumber(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('📱 Enter your phone number for testing (format: +1XXXXXXXXXX): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function confirmSetup(phoneNumber: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log(`\n📋 Test Setup Configuration:`);
    console.log(`   Phone Number: ${phoneNumber}`);
    console.log(`   Purpose: Manual SMS system testing`);
    console.log(`   Database: Production (will create real subscriber)`);
    console.log(`   Note: You can delete this after testing\n`);
    
    rl.question('✅ Proceed with setup? (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function setupTestSubscriber(config: TestSetupConfig): Promise<void> {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 Setting up test subscriber...\n');

    // Validate phone number format
    if (!Subscriber.isValidPhoneNumber(config.phoneNumber)) {
      throw new Error(`Invalid phone number format: ${config.phoneNumber}. Use +1XXXXXXXXXX for US numbers.`);
    }

    // Check if subscriber already exists
    const existingSubscriber = await prisma.subscriber.findUnique({
      where: { phoneNumber: config.phoneNumber },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    if (existingSubscriber) {
      console.log('👤 Subscriber already exists:');
      console.log(`   Phone: ${existingSubscriber.phoneNumber}`);
      console.log(`   Status: ${existingSubscriber.isActive ? 'Active' : 'Inactive'}`);
      console.log(`   Joined: ${existingSubscriber.joinedAt.toLocaleDateString()}`);
      console.log(`   Messages: ${existingSubscriber._count.messages}`);
      console.log(`   Slack Thread: ${existingSubscriber.slackThreadTs || 'None'}`);
      
      if (!existingSubscriber.isActive) {
        console.log('\n🔄 Reactivating subscriber for testing...');
        await prisma.subscriber.update({
          where: { id: existingSubscriber.id },
          data: { isActive: true },
        });
        console.log('✅ Subscriber reactivated');
      }
      
      console.log('\n✅ Test subscriber ready for manual testing!');
      return;
    }

    // Create new subscriber using domain entity
    const newSubscriber = Subscriber.create(config.phoneNumber);

    const createdSubscriber = await prisma.subscriber.create({
      data: {
        id: newSubscriber.id,
        phoneNumber: newSubscriber.phoneNumber,
        isActive: newSubscriber.isActive,
        joinedAt: newSubscriber.joinedAt,
      },
    });

    console.log('✅ Test subscriber created successfully!');
    console.log(`   ID: ${createdSubscriber.id}`);
    console.log(`   Phone: ${createdSubscriber.phoneNumber}`);
    console.log(`   Status: ${createdSubscriber.isActive ? 'Active' : 'Inactive'}`);
    console.log(`   Created: ${createdSubscriber.joinedAt.toLocaleString()}`);

  } catch (error: any) {
    console.error('❌ Test setup failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function displayTestingInstructions(phoneNumber: string): Promise<void> {
  console.log('\n📚 Manual Testing Instructions:');
  console.log('════════════════════════════════════════════════════');
  
  console.log('\n🚀 1. Start the Application:');
  console.log('   npm run dev');
  console.log('   Visit: http://localhost:3000');
  
  console.log('\n🌐 2. Setup ngrok for Webhooks:');
  console.log('   npm install -g ngrok  # if not installed');
  console.log('   ngrok http 3000');
  console.log('   Copy the https URL (e.g., https://abc123.ngrok.io)');
  
  console.log('\n📞 3. Configure Twilio Webhook:');
  console.log('   - Go to Twilio Console → Phone Numbers → Active Numbers');
  console.log('   - Select your Twilio phone number');
  console.log('   - Set Webhook URL: {ngrok_url}/api/webhooks/sms');
  console.log('   - Set Method: HTTP POST');
  console.log('   - Save configuration');
  
  console.log('\n🧪 4. Test Scenarios to Try:');
  console.log(`   📱 Your test number: ${phoneNumber}`);
  console.log('   📞 Twilio number: Check your Twilio console');
  console.log('');
  console.log('   🔸 Opt-in Test:');
  console.log(`     • Send "TRIBE" from ${phoneNumber} to your Twilio number`);
  console.log('     • Should receive welcome message');
  console.log('     • Check dashboard for subscriber creation');
  console.log('');
  console.log('   🔸 Broadcast Test:');
  console.log('     • Go to dashboard → Send Broadcast');
  console.log('     • Send test message to active subscribers');
  console.log(`     • Should receive SMS on ${phoneNumber}`);
  console.log('');
  console.log('   🔸 Two-way Conversation:');
  console.log('     • Reply to any broadcast message');
  console.log('     • Check Slack channel for message');
  console.log('     • Verify threaded conversation');
  console.log('');
  console.log('   🔸 Opt-out Test:');
  console.log(`     • Send "STOP" from ${phoneNumber}`);
  console.log('     • Should receive opt-out confirmation');
  console.log('     • Check dashboard - subscriber should be inactive');
  
  console.log('\n📊 5. Verification Points:');
  console.log('   ✅ Dashboard shows your subscriber');
  console.log('   ✅ Messages appear in message history');
  console.log('   ✅ Slack notifications work (if configured)');
  console.log('   ✅ Cost calculations are accurate');
  console.log('   ✅ Opt-in/opt-out flows work properly');
  
  console.log('\n🧹 6. Cleanup After Testing:');
  console.log('   • Delete test subscriber from dashboard');
  console.log('   • Or run: npx tsx manual-testing/cleanup.ts');
  console.log('   • Reset Twilio webhook URL if needed');
  
  console.log('\n⚠️  Important Notes:');
  console.log('   • This is your production database');
  console.log('   • Real SMS messages will be sent/received');
  console.log('   • Twilio charges apply for SMS usage');
  console.log('   • Clean up test data when finished');
  
  console.log('\n🎯 Ready to test! Start with step 1 above.');
}

async function runTestSetup(phoneNumber?: string): Promise<void> {
  console.log('🧪 Manual Test Setup for SMS System\n');
  console.log('This script will prepare your system for end-to-end testing');
  console.log('with your real phone number.\n');

  try {
    // Get phone number if not provided
    const testPhoneNumber = phoneNumber || await promptForPhoneNumber();

    // Confirm setup
    const confirmed = await confirmSetup(testPhoneNumber);
    if (!confirmed) {
      console.log('❌ Setup cancelled by user');
      return;
    }

    // Setup test subscriber
    await setupTestSubscriber({ 
      phoneNumber: testPhoneNumber,
      testName: 'Manual Testing'
    });

    // Display testing instructions
    await displayTestingInstructions(testPhoneNumber);

  } catch (error: any) {
    console.error('\n❌ Test setup failed:', error.message);
    console.log('\n💡 Common issues:');
    console.log('   • Invalid phone number format (use +1XXXXXXXXXX)');
    console.log('   • Database connection issues');
    console.log('   • Missing environment variables');
    console.log('\n🔧 Run health-check.ts first to diagnose issues');
    process.exit(1);
  }
}

// Command line interface
if (require.main === module) {
  const phoneArg = process.argv[2];
  runTestSetup(phoneArg).catch(console.error);
}

export { runTestSetup, setupTestSubscriber };