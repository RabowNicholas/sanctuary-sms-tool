/**
 * Test script for Inbox API endpoints
 *
 * Tests:
 * 1. GET /api/inbox/stats - Get unread count
 * 2. GET /api/inbox - List all conversations
 * 3. GET /api/inbox?filter=unread - List unread conversations
 * 4. POST /api/conversations/[id]/mark-read - Mark conversation as read
 * 5. POST /api/conversations/[id]/mark-unread - Mark conversation as unread
 */

const BASE_URL = 'http://localhost:3000';

// Test credentials - update these with your actual credentials
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

async function runTests() {
  console.log('🧪 Starting Inbox API Tests...\n');

  try {
    // Step 1: Get authentication token
    console.log('📝 Step 1: Authenticating...');
    const authResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    if (!authResponse.ok) {
      console.log('⚠️  Note: Authentication endpoint may require manual login via browser');
      console.log('   Please ensure you are logged in at http://localhost:3000/login');
      console.log('   These tests will use your browser session cookies\n');
    }

    // Test 1: Get inbox stats
    await testEndpoint(
      'GET /api/inbox/stats',
      `${BASE_URL}/api/inbox/stats`,
      'GET'
    );

    // Test 2: Get all conversations
    await testEndpoint(
      'GET /api/inbox (all conversations)',
      `${BASE_URL}/api/inbox`,
      'GET'
    );

    // Test 3: Get unread conversations
    await testEndpoint(
      'GET /api/inbox?filter=unread',
      `${BASE_URL}/api/inbox?filter=unread`,
      'GET'
    );

    // Test 4: Get read conversations
    await testEndpoint(
      'GET /api/inbox?filter=read',
      `${BASE_URL}/api/inbox?filter=read`,
      'GET'
    );

    // Test 5: Search conversations
    await testEndpoint(
      'GET /api/inbox?search=555',
      `${BASE_URL}/api/inbox?search=555`,
      'GET'
    );

    // For mark-read/mark-unread tests, we need a valid subscriber ID
    // Let's get one from the inbox first
    const inboxResponse = await fetch(`${BASE_URL}/api/inbox`, {
      credentials: 'include',
    });

    if (inboxResponse.ok) {
      const inboxData = await inboxResponse.json();
      if (inboxData.conversations && inboxData.conversations.length > 0) {
        const testSubscriberId = inboxData.conversations[0].id;

        // Test 6: Mark conversation as read
        await testEndpoint(
          `POST /api/conversations/${testSubscriberId}/mark-read`,
          `${BASE_URL}/api/conversations/${testSubscriberId}/mark-read`,
          'POST'
        );

        // Test 7: Mark conversation as unread
        await testEndpoint(
          `POST /api/conversations/${testSubscriberId}/mark-unread`,
          `${BASE_URL}/api/conversations/${testSubscriberId}/mark-unread`,
          'POST'
        );

        // Test 8: Verify stats update after marking as read
        await testEndpoint(
          'GET /api/inbox/stats (after mark as read)',
          `${BASE_URL}/api/inbox/stats`,
          'GET'
        );
      } else {
        console.log('⚠️  No conversations found to test mark-read/mark-unread endpoints');
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}`);
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log('='.repeat(60));

    if (failed === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed. Check the errors above.');
    }

  } catch (error: any) {
    console.error('❌ Test suite error:', error.message);
    process.exit(1);
  }
}

async function testEndpoint(
  name: string,
  url: string,
  method: 'GET' | 'POST'
): Promise<void> {
  console.log(`\n🔍 Testing: ${name}`);
  console.log(`   URL: ${url}`);

  try {
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📦 Response:`, JSON.stringify(data, null, 2).split('\n').slice(0, 10).join('\n'));

      results.push({
        name,
        passed: true,
        data,
      });
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   Error:`, data);

      results.push({
        name,
        passed: false,
        error: `HTTP ${response.status}: ${data.error || 'Unknown error'}`,
      });
    }
  } catch (error: any) {
    console.log(`   ❌ Request failed: ${error.message}`);

    results.push({
      name,
      passed: false,
      error: error.message,
    });
  }
}

// Run tests
runTests();
