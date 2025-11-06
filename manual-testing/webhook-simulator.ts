// Webhook simulator for testing SMS flows without real Twilio webhooks
import { config } from 'dotenv';
import readline from 'readline';

config();

interface WebhookSimulation {
  from: string;
  to: string;
  body: string;
  messageSid?: string;
}

interface SimulationScenario {
  name: string;
  description: string;
  webhook: WebhookSimulation;
  expectedOutcome: string;
}

class WebhookSimulator {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async simulateWebhook(simulation: WebhookSimulation): Promise<any> {
    const webhookPayload = {
      MessageSid: simulation.messageSid || `SM${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
      From: simulation.from,
      To: simulation.to,
      Body: simulation.body,
      NumSegments: '1',
      SmsStatus: 'received',
      AccountSid: process.env.TWILIO_ACCOUNT_SID || 'ACtest123',
    };

    console.log(`📡 Simulating webhook: ${simulation.from} → ${simulation.to}`);
    console.log(`💬 Message: "${simulation.body}"`);

    try {
      const response = await fetch(`${this.baseUrl}/api/webhooks/sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(webhookPayload).toString(),
      });

      const responseText = await response.text();
      
      console.log(`📊 Response Status: ${response.status}`);
      console.log(`📝 Response Body: ${responseText}`);

      return {
        status: response.status,
        body: responseText,
        headers: Object.fromEntries(response.headers.entries()),
      };

    } catch (error: any) {
      console.error(`❌ Webhook simulation failed: ${error.message}`);
      throw error;
    }
  }

  getTestScenarios(userPhoneNumber: string, twilioNumber: string): SimulationScenario[] {
    return [
      {
        name: 'Opt-in with TRIBE keyword',
        description: 'New user sends TRIBE to opt into the system',
        webhook: {
          from: userPhoneNumber,
          to: twilioNumber,
          body: 'TRIBE',
        },
        expectedOutcome: 'Welcome message sent, subscriber created as active'
      },
      {
        name: 'Opt-in with lowercase tribe',
        description: 'Test case insensitive keyword matching',
        webhook: {
          from: userPhoneNumber.replace(userPhoneNumber.slice(-4), '9999'), // Different number
          to: twilioNumber,
          body: 'tribe',
        },
        expectedOutcome: 'Welcome message sent, subscriber created'
      },
      {
        name: 'Regular message from subscriber',
        description: 'Existing subscriber sends a regular message',
        webhook: {
          from: userPhoneNumber,
          to: twilioNumber,
          body: 'Hello, this is a test message from a subscriber',
        },
        expectedOutcome: 'Message forwarded to Slack, no auto-reply'
      },
      {
        name: 'Opt-out with STOP',
        description: 'User opts out of the system',
        webhook: {
          from: userPhoneNumber,
          to: twilioNumber,
          body: 'STOP',
        },
        expectedOutcome: 'Opt-out confirmation sent, subscriber marked inactive'
      },
      {
        name: 'Message from unknown number',
        description: 'Non-subscriber sends a message',
        webhook: {
          from: '+15557777777',
          to: twilioNumber,
          body: 'Hello from unknown number',
        },
        expectedOutcome: 'Instructions sent to join with TRIBE keyword'
      },
      {
        name: 'Long message test',
        description: 'Test message that exceeds single SMS segment',
        webhook: {
          from: userPhoneNumber,
          to: twilioNumber,
          body: 'This is a very long message that should exceed the typical SMS segment length of 160 characters. It is designed to test how the system handles multi-segment messages and ensures proper processing and storage of longer content.',
        },
        expectedOutcome: 'Multi-segment message processed and forwarded to Slack'
      },
      {
        name: 'Empty message test',
        description: 'Test handling of empty message body',
        webhook: {
          from: userPhoneNumber,
          to: twilioNumber,
          body: '',
        },
        expectedOutcome: 'Empty message handled gracefully'
      },
      {
        name: 'Special characters test',
        description: 'Test message with emojis and special characters',
        webhook: {
          from: userPhoneNumber,
          to: twilioNumber,
          body: 'Test with emojis 🚀📱💬 and special chars: @#$%^&*()',
        },
        expectedOutcome: 'Special characters preserved and forwarded'
      }
    ];
  }
}

async function promptForNumbers(): Promise<{ userPhone: string; twilioPhone: string }> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const userPhone = await new Promise<string>((resolve) => {
    rl.question('📱 Enter your phone number (test subscriber): ', (answer) => {
      resolve(answer.trim());
    });
  });

  const twilioPhone = await new Promise<string>((resolve) => {
    rl.question('📞 Enter your Twilio phone number: ', (answer) => {
      resolve(answer.trim());
      rl.close();
    });
  });

  return { userPhone, twilioPhone };
}

async function selectScenario(scenarios: SimulationScenario[]): Promise<SimulationScenario | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n📋 Available Test Scenarios:');
  scenarios.forEach((scenario, index) => {
    console.log(`   ${index + 1}. ${scenario.name}`);
    console.log(`      ${scenario.description}`);
  });
  console.log(`   ${scenarios.length + 1}. Run all scenarios`);
  console.log('   0. Exit');

  const choice = await new Promise<string>((resolve) => {
    rl.question('\n🎯 Select scenario (number): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  const choiceNum = parseInt(choice);
  
  if (choiceNum === 0) {
    return null;
  } else if (choiceNum === scenarios.length + 1) {
    return { name: 'ALL_SCENARIOS', description: 'Run all test scenarios', webhook: { from: '', to: '', body: '' }, expectedOutcome: '' };
  } else if (choiceNum >= 1 && choiceNum <= scenarios.length) {
    return scenarios[choiceNum - 1];
  } else {
    console.log('❌ Invalid choice');
    return null;
  }
}

async function runWebhookSimulator(): Promise<void> {
  console.log('🎭 SMS Webhook Simulator\n');
  console.log('This tool simulates Twilio SMS webhooks for testing');
  console.log('your application without sending real SMS messages.\n');

  try {
    // Get phone numbers
    const { userPhone, twilioPhone } = await promptForNumbers();
    
    // Initialize simulator
    const simulator = new WebhookSimulator();
    const scenarios = simulator.getTestScenarios(userPhone, twilioPhone);

    while (true) {
      // Select scenario
      const selectedScenario = await selectScenario(scenarios);
      
      if (!selectedScenario) {
        console.log('👋 Exiting webhook simulator');
        break;
      }

      if (selectedScenario.name === 'ALL_SCENARIOS') {
        // Run all scenarios
        console.log('\n🚀 Running all test scenarios...\n');
        
        for (let i = 0; i < scenarios.length; i++) {
          const scenario = scenarios[i];
          console.log(`\n📍 Scenario ${i + 1}/${scenarios.length}: ${scenario.name}`);
          console.log(`   ${scenario.description}`);
          console.log(`   Expected: ${scenario.expectedOutcome}`);
          
          try {
            const result = await simulator.simulateWebhook(scenario.webhook);
            console.log(`   ✅ Status: ${result.status}`);
            
            // Wait a bit between scenarios
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error: any) {
            console.log(`   ❌ Failed: ${error.message}`);
          }
        }
        
        console.log('\n🎉 All scenarios completed!');
        break;
        
      } else {
        // Run single scenario
        console.log(`\n🎬 Running: ${selectedScenario.name}`);
        console.log(`📖 Description: ${selectedScenario.description}`);
        console.log(`🎯 Expected: ${selectedScenario.expectedOutcome}\n`);

        try {
          const result = await simulator.simulateWebhook(selectedScenario.webhook);
          
          console.log('\n✅ Simulation completed successfully!');
          console.log('\n📊 Results:');
          console.log(`   Status Code: ${result.status}`);
          console.log(`   Response: ${result.body}`);
          
          if (result.status === 200) {
            console.log('\n🎯 Next Steps:');
            console.log('   • Check your dashboard for updates');
            console.log('   • Verify database changes');
            console.log('   • Check Slack channel (if configured)');
            console.log('   • Review application logs');
          } else {
            console.log('\n⚠️  Unexpected response - check logs for details');
          }
          
        } catch (error: any) {
          console.error(`\n❌ Simulation failed: ${error.message}`);
        }
      }

      console.log('\n' + '='.repeat(50));
    }

  } catch (error: any) {
    console.error('\n❌ Webhook simulator error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   • Ensure the application is running on localhost:3000');
    console.log('   • Check database connectivity');
    console.log('   • Verify environment variables are set');
    console.log('   • Run health-check.ts first');
  }
}

// Command line interface
if (require.main === module) {
  runWebhookSimulator().catch(console.error);
}

export { WebhookSimulator, runWebhookSimulator };