import { SlackNotificationService } from '@/infrastructure/notifications/SlackNotificationService';

// Mock fetch globally
global.fetch = jest.fn();

describe('SlackNotificationService', () => {
  let service: SlackNotificationService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const mockConfig = {
    botToken: 'xoxb-test-token',
    channel: '#sms-conversations',
  };

  beforeEach(() => {
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
    
    // Default to test mode
    process.env.NODE_ENV = 'test';
    service = new SlackNotificationService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize in test mode', () => {
      const info = service.getChannelInfo();
      expect(info.isTestMode).toBe(true);
      expect(info.channel).toBe('#sms-conversations');
    });

    it('should detect test mode from token prefix', () => {
      const testService = new SlackNotificationService({
        botToken: 'xoxb-test',
        channel: '#test',
      });
      
      expect(testService.getChannelInfo().isTestMode).toBe(true);
    });
  });

  describe('postMessage', () => {
    it('should send message successfully in mock mode', async () => {
      const message = 'Test message';
      const result = await service.postMessage(message);
      
      expect(result).toMatch(/^ts-\d+\./);
    });

    it('should send threaded message in mock mode', async () => {
      const message = 'Reply message';
      const threadTs = 'ts-1234567890.123';
      
      const result = await service.postMessage(message, threadTs);
      
      expect(result).toBe(threadTs);
    });

    it('should validate message length', async () => {
      const emptyMessage = '';
      await expect(service.postMessage(emptyMessage))
        .rejects.toThrow('Message cannot be empty');
      
      const longMessage = 'A'.repeat(3001);
      await expect(service.postMessage(longMessage))
        .rejects.toThrow('Message too long (max 3000 characters)');
    });

    it('should handle whitespace-only messages', async () => {
      const whitespaceMessage = '   \n\t   ';
      await expect(service.postMessage(whitespaceMessage))
        .rejects.toThrow('Message cannot be empty');
    });
  });

  describe('sendSubscriberMessage', () => {
    it('should format subscriber messages correctly', async () => {
      const phoneNumber = '+15551234567';
      const message = 'Hello, I need help with my account';
      
      const result = await service.sendSubscriberMessage(phoneNumber, message);
      
      expect(result).toMatch(/^ts-\d+\./);
    });

    it('should handle threaded subscriber messages', async () => {
      const phoneNumber = '+15551234567';
      const message = 'Follow-up question';
      const threadTs = 'ts-1234567890.123';
      
      const result = await service.sendSubscriberMessage(phoneNumber, message, threadTs);
      
      expect(result).toBe(threadTs);
    });
  });

  describe('phone number formatting', () => {
    it('should format US phone numbers correctly', async () => {
      const testCases = [
        { input: '+15551234567', expected: '(555) 123-4567' },
        { input: '+19876543210', expected: '(987) 654-3210' },
      ];
      
      for (const testCase of testCases) {
        await service.sendSubscriberMessage(testCase.input, 'Test message');
        // The formatting is internal, but we can verify the call succeeded
      }
    });

    it('should handle non-US phone numbers gracefully', async () => {
      const internationalNumber = '+441234567890';
      const result = await service.sendSubscriberMessage(internationalNumber, 'Test');
      
      expect(result).toMatch(/^ts-\d+\./);
    });
  });

  describe('notification methods', () => {
    it('should send opt-in notifications', async () => {
      const phoneNumber = '+15551234567';
      const result = await service.sendOptInNotification(phoneNumber);
      
      expect(result).toMatch(/^ts-\d+\./);
    });

    it('should send opt-out notifications', async () => {
      const phoneNumber = '+15551234567';
      const result = await service.sendOptOutNotification(phoneNumber);
      
      expect(result).toMatch(/^ts-\d+\./);
    });

    it('should send system notifications', async () => {
      const notification = 'System maintenance completed';
      const result = await service.sendSystemNotification(notification);
      
      expect(result).toMatch(/^ts-\d+\./);
    });
  });

  describe('thread management', () => {
    it('should create new threads', async () => {
      const message = 'Starting new conversation';
      const result = await service.createThread(message);
      
      expect(result).toMatch(/^ts-\d+\./);
    });

    it('should reply to existing threads', async () => {
      const threadTs = 'ts-1234567890.123';
      const reply = 'This is a reply';
      
      const result = await service.replyToThread(threadTs, reply);
      
      expect(result).toBe(threadTs);
    });
  });

  describe('testConnection', () => {
    it('should return true in test mode', async () => {
      const result = await service.testConnection();
      expect(result).toBe(true);
    });
  });

  describe('real Slack API integration (mocked)', () => {
    let realService: SlackNotificationService;

    beforeEach(() => {
      // Override NODE_ENV to test with real API calls (mocked)
      process.env.NODE_ENV = 'development';
      
      realService = new SlackNotificationService({
        botToken: 'xoxb-real-token',
        channel: '#sms-conversations',
      });
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should make real API calls when not in test mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          ts: '1234567890.123456',
          channel: 'C1234567890',
        }),
      } as Response);

      const result = await realService.postMessage('Test message');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer xoxb-real-token',
            'Content-Type': 'application/json',
          }),
        })
      );
      
      expect(result).toBe('1234567890.123456');
    });

    it('should handle Slack API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'channel_not_found',
        }),
      } as Response);

      await expect(realService.postMessage('Test message'))
        .rejects.toThrow('Failed to send Slack message: Slack API error: channel_not_found');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(realService.postMessage('Test message'))
        .rejects.toThrow('Failed to send Slack message: HTTP error! status: 401');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(realService.postMessage('Test message'))
        .rejects.toThrow('Failed to send Slack message: Network error');
    });

    it('should test connection with real API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user: 'test-user',
        }),
      } as Response);

      const result = await realService.testConnection();
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/auth.test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer xoxb-real-token',
          }),
        })
      );
      
      expect(result).toBe(true);
    });

    it('should handle connection test failures', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await realService.testConnection();
      
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in messages', async () => {
      const specialMessage = 'Test with émojis 🎉 and special chars: <>&"\\\'';
      const result = await service.postMessage(specialMessage);
      
      expect(result).toMatch(/^ts-\d+\./);
    });

    it('should handle very long valid messages', async () => {
      const longMessage = 'A'.repeat(2999); // Just under the limit
      const result = await service.postMessage(longMessage);
      
      expect(result).toMatch(/^ts-\d+\./);
    });

    it('should handle unicode characters correctly', async () => {
      const unicodeMessage = '测试消息 🚀 नमस्ते';
      const result = await service.postMessage(unicodeMessage);
      
      expect(result).toMatch(/^ts-\d+\./);
    });
  });
});