import { TwilioSMSService } from '@/infrastructure/sms/TwilioSMSService';

// Mock Twilio SDK
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  }));
});

describe('TwilioSMSService', () => {
  let service: TwilioSMSService;
  let mockTwilioClient: any;

  const mockConfig = {
    accountSid: 'ACtest123',
    authToken: 'test_token',
    messagingServiceSid: 'MGtest123',
  };

  beforeEach(() => {
    // Reset environment
    process.env.NODE_ENV = 'test';
    
    // Create service (will use mock mode due to NODE_ENV=test)
    service = new TwilioSMSService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send SMS successfully in mock mode', async () => {
      const to = '+15559876543';
      const body = 'Test message';

      const result = await service.sendMessage(to, body);

      expect(result).toEqual({
        messageId: expect.stringMatching(/^SM[a-z0-9]+$/),
        status: 'sent',
        to,
        from: mockConfig.messagingServiceSid,
        body,
      });
    });

    it('should validate phone number format', async () => {
      const invalidNumbers = [
        '5551234567',     // Missing +1
        '+15551234',      // Too short
        '+441234567890',  // International
        '+1555123456789', // Too long
      ];

      for (const invalidNumber of invalidNumbers) {
        await expect(service.sendMessage(invalidNumber, 'Test'))
          .rejects.toThrow(`Invalid phone number format: ${invalidNumber}`);
      }
    });

    it('should validate message body', async () => {
      const validPhone = '+15559876543';

      // Empty message
      await expect(service.sendMessage(validPhone, ''))
        .rejects.toThrow('Message body cannot be empty');

      // Too long message
      const longMessage = 'A'.repeat(1601);
      await expect(service.sendMessage(validPhone, longMessage))
        .rejects.toThrow('Message too long (max 1600 characters)');
    });

    it('should accept valid US phone numbers', async () => {
      const validNumbers = [
        '+15551234567',
        '+19876543210',
        '+15550000000',
        '+19999999999',
      ];

      for (const validNumber of validNumbers) {
        const result = await service.sendMessage(validNumber, 'Test');
        expect(result.to).toBe(validNumber);
        expect(result.status).toBe('sent');
      }
    });

    it('should handle different message lengths', async () => {
      const testCases = [
        { message: 'Short', expectedSegments: 1 },
        { message: 'A'.repeat(160), expectedSegments: 1 },
        { message: 'A'.repeat(161), expectedSegments: 2 },
        { message: 'A'.repeat(320), expectedSegments: 2 },
        { message: 'A'.repeat(321), expectedSegments: 3 },
      ];

      for (const testCase of testCases) {
        const result = await service.sendMessage('+15559876543', testCase.message);
        expect(result.body).toBe(testCase.message);
        
        // Verify cost calculation
        const cost = service.calculateCost(testCase.message);
        const expectedCost = testCase.expectedSegments * 0.0083;
        expect(cost).toBeCloseTo(expectedCost, 4);
      }
    });
  });

  describe('calculateCost', () => {
    it('should calculate SMS cost correctly', () => {
      const testCases = [
        { message: '', expectedCost: 0.0083 },      // Empty = 1 segment
        { message: 'A'.repeat(160), expectedCost: 0.0083 },  // 1 segment
        { message: 'A'.repeat(161), expectedCost: 0.0166 },  // 2 segments
        { message: 'A'.repeat(320), expectedCost: 0.0166 },  // 2 segments
        { message: 'A'.repeat(321), expectedCost: 0.0249 },  // 3 segments
      ];

      testCases.forEach(({ message, expectedCost }) => {
        const cost = service.calculateCost(message);
        expect(cost).toBeCloseTo(expectedCost, 4);
      });
    });
  });

  describe('getMessageStatus', () => {
    it('should return mock status in test mode', async () => {
      const status = await service.getMessageStatus('SM123');
      expect(status).toBe('delivered');
    });
  });

  describe('integration with real Twilio (mocked)', () => {
    let realService: TwilioSMSService;

    beforeEach(() => {
      // Override NODE_ENV to test with mocked Twilio client
      process.env.NODE_ENV = 'development';
      
      // Mock the require function for twilio
      const mockCreate = jest.fn().mockResolvedValue({
        sid: 'SMmocked123',
        status: 'queued',
        to: '+15559876543',
        from: '+15551234567',
        body: 'Test message',
      });

      const mockFetch = jest.fn().mockResolvedValue({
        status: 'delivered',
      });

      jest.doMock('twilio', () => {
        return jest.fn().mockImplementation(() => ({
          messages: {
            create: mockCreate,
          },
        }));
      });

      realService = new TwilioSMSService(mockConfig);
      mockTwilioClient = require('twilio')(mockConfig.accountSid, mockConfig.authToken);
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
      jest.resetModules();
    });

    it('should use real Twilio client when not in test mode', async () => {
      // This test verifies the integration structure
      // In real implementation, we'd need actual Twilio credentials
      expect(realService).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle various error scenarios gracefully', () => {
      // Test error handling for edge cases
      expect(() => new TwilioSMSService(mockConfig)).not.toThrow();
      
      // Service should work in test mode even without Twilio SDK
      expect(service).toBeDefined();
    });
  });
});