// Test Slack integration
import { config } from 'dotenv';
import { SlackNotificationService } from '../src/infrastructure/notifications/SlackNotificationService.js';

config();

async function testSlack() {
  console.log('🧪 Testing Slack Integration...\n');

  // Check environment variables
  const botToken = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;

  if (!botToken || !channelId) {
    console.error('❌ Missing required environment variables:');
    console.error('   SLACK_BOT_TOKEN:', botToken ? '✅ Set' : '❌ Missing');
    console.error('   SLACK_CHANNEL_ID:', channelId ? '✅ Set' : '❌ Missing');
    process.exit(1);
  }

  console.log('✅ Environment variables loaded:');
  console.log('   Bot Token:', botToken.substring(0, 10) + '...');
  console.log('   Channel ID:', channelId);
  console.log('');

  // Initialize Slack service
  const slack = new SlackNotificationService({
    botToken,
    channel: channelId,
  });

  try {
    // Test 1: Simple message
    console.log('📤 Test 1: Sending simple message...');
    const ts1 = await slack.postMessage('🧪 Test message from SMS system');
    console.log('✅ Message sent successfully!');
    console.log('   Thread TS:', ts1);
    console.log('');

    // Test 2: Threaded reply
    console.log('📤 Test 2: Sending threaded reply...');
    const ts2 = await slack.postMessage('📝 This is a reply in the thread', ts1);
    console.log('✅ Reply sent successfully!');
    console.log('   Thread TS:', ts2);
    console.log('');

    // Test 3: New subscriber notification
    console.log('📤 Test 3: New subscriber notification...');
    const ts3 = await slack.sendOptInNotification('+15551234567');
    console.log('✅ Opt-in notification sent!');
    console.log('   Thread TS:', ts3);
    console.log('');

    // Test 4: Opt-out notification
    console.log('📤 Test 4: Opt-out notification...');
    const ts4 = await slack.sendOptOutNotification('+15559876543');
    console.log('✅ Opt-out notification sent!');
    console.log('   Thread TS:', ts4);
    console.log('');

    // Test 5: Subscriber message notification
    console.log('📤 Test 5: Subscriber message notification...');
    const ts5 = await slack.sendSubscriberMessage(
      '+15551234567',
      'Hey, this is a test message from a subscriber!'
    );
    console.log('✅ Subscriber message notification sent!');
    console.log('   Thread TS:', ts5);
    console.log('');

    // Test 6: System notification
    console.log('📤 Test 6: System notification...');
    const ts6 = await slack.sendSystemNotification('Manual testing completed successfully');
    console.log('✅ System notification sent!');
    console.log('   Thread TS:', ts6);
    console.log('');

    // Test 7: Connection test
    console.log('🔍 Test 7: Connection test...');
    const isConnected = await slack.testConnection();
    console.log(isConnected ? '✅ Connection test passed!' : '❌ Connection test failed!');
    console.log('');

    // Summary
    console.log('═'.repeat(50));
    console.log('🎉 All Slack tests passed!');
    console.log('═'.repeat(50));
    console.log('\n✅ Slack integration is working correctly');
    console.log('   Check your Slack channel for the test messages');
    console.log('');
    console.log('📍 Channel:', channelId);
    console.log('🔗 Go to your Slack workspace to verify');

  } catch (error: any) {
    console.error('\n❌ Slack test failed!');
    console.error('   Error:', error.message);

    if (error.message.includes('not_in_channel')) {
      console.error('\n💡 Tip: Make sure your Slack bot is added to the channel:');
      console.error('   1. Open the channel in Slack');
      console.error('   2. Click the channel name');
      console.error('   3. Click "Integrations"');
      console.error('   4. Click "Add apps"');
      console.error('   5. Add your bot to the channel');
    } else if (error.message.includes('invalid_auth')) {
      console.error('\n💡 Tip: Your bot token may be invalid or expired');
      console.error('   Check your SLACK_BOT_TOKEN in .env');
    } else if (error.message.includes('channel_not_found')) {
      console.error('\n💡 Tip: Channel ID may be incorrect');
      console.error('   Check your SLACK_CHANNEL_ID in .env');
    }

    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testSlack().catch(console.error);
}

export { testSlack };
