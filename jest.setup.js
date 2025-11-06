import '@testing-library/jest-dom';
import 'cross-fetch/polyfill';

// Add Response.json polyfill if not available
if (!Response.prototype.json) {
  Response.prototype.json = async function() {
    const text = await this.text();
    return JSON.parse(text);
  };
}

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.ADMIN_PASSWORD = 'test-password';

// Mock Twilio
jest.mock('twilio', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'test-message-sid',
        status: 'sent',
      }),
    },
    webhooks: {
      validateSignature: jest.fn().mockReturnValue(true),
    },
  })),
}));

// Mock Slack Web API
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    chat: {
      postMessage: jest.fn().mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
      }),
    },
  })),
}));

// Global test setup
beforeAll(() => {
  // Setup any global test configuration
});

afterAll(() => {
  // Cleanup after all tests
});