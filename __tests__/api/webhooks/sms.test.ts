import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/webhooks/sms/route';
import { PrismaClient } from '@/generated/prisma';

// Mock Prisma
jest.mock('@/generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    subscriber: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      create: jest.fn(),
    },
  })),
}));

// Mock TwilioSMSService
jest.mock('@/infrastructure/sms/TwilioSMSService', () => ({
  TwilioSMSService: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue({
      messageId: 'SMtest123',
      status: 'sent',
      to: '+15559876543',
      from: '+15551234567',
      body: 'Test response',
    }),
  })),
}));

describe('/api/webhooks/sms', () => {
  let mockPrisma: any;

  beforeEach(() => {
    // Get the mocked PrismaClient instance
    mockPrisma = new PrismaClient();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockPrisma.subscriber.findUnique.mockResolvedValue(null);
    mockPrisma.subscriber.create.mockResolvedValue({
      id: 'test-id',
      phoneNumber: '+15559876543',
      isActive: true,
      joinedAt: new Date(),
    });
    mockPrisma.message.create.mockResolvedValue({
      id: 'msg-id',
      phoneNumber: '+15559876543',
      content: 'Test message',
      direction: 'INBOUND',
      createdAt: new Date(),
    });
  });

  describe('POST /api/webhooks/sms', () => {
    const createTwilioWebhookRequest = (data: Record<string, string>) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, value);
      });

      return new NextRequest('http://localhost:3000/api/webhooks/sms', {
        method: 'POST',
        body: formData,
      });
    };

    it('should handle new subscriber opt-in', async () => {
      const request = createTwilioWebhookRequest({
        MessageSid: 'SMtest123',
        From: '+15559876543',
        To: '+15551234567',
        Body: 'TRIBE',
        SmsStatus: 'received',
      });

      const response = await POST(request);
      const responseText = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/xml');
      expect(responseText).toContain('<Response>');
      expect(responseText).toContain('<Message>');
      expect(responseText).toContain('Welcome');
      
      // Verify database calls
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          phoneNumber: '+15559876543',
          content: 'TRIBE',
          direction: 'INBOUND',
        }
      });
    });

    it('should handle existing subscriber message', async () => {
      // Mock existing active subscriber
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'existing-id',
        phoneNumber: '+15559876543',
        isActive: true,
        joinedAt: new Date(),
      });

      const request = createTwilioWebhookRequest({
        MessageSid: 'SMtest123',
        From: '+15559876543',
        To: '+15551234567',
        Body: 'Hello, how are you?',
        SmsStatus: 'received',
      });

      const response = await POST(request);
      const responseText = await response.text();

      expect(response.status).toBe(200);
      expect(responseText).toContain('<Response></Response>'); // No SMS response for regular messages
      
      // Verify message was stored
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          phoneNumber: '+15559876543',
          content: 'Hello, how are you?',
          direction: 'INBOUND',
        }
      });
    });

    it('should handle STOP command', async () => {
      // Mock existing active subscriber
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'existing-id',
        phoneNumber: '+15559876543',
        isActive: true,
        joinedAt: new Date(),
      });

      const request = createTwilioWebhookRequest({
        MessageSid: 'SMtest123',
        From: '+15559876543',
        To: '+15551234567',
        Body: 'STOP',
        SmsStatus: 'received',
      });

      const response = await POST(request);
      const responseText = await response.text();

      expect(response.status).toBe(200);
      expect(responseText).toContain('<Message>');
      expect(responseText).toContain('unsubscribed');
      
      // Verify subscriber was updated
      expect(mockPrisma.subscriber.update).toHaveBeenCalled();
    });

    it('should handle non-subscriber message', async () => {
      const request = createTwilioWebhookRequest({
        MessageSid: 'SMtest123',
        From: '+15559876543',
        To: '+15551234567',
        Body: 'Random message',
        SmsStatus: 'received',
      });

      const response = await POST(request);
      const responseText = await response.text();

      expect(response.status).toBe(200);
      expect(responseText).toContain('<Message>');
      expect(responseText).toContain('TRIBE');
    });

    it('should validate required fields', async () => {
      const request = createTwilioWebhookRequest({
        MessageSid: 'SMtest123',
        From: '', // Missing From field
        To: '+15551234567',
        Body: 'Test',
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      
      const responseData = await response.json();
      expect(responseData.error).toBe('Missing required fields');
    });

    it('should handle malformed requests gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhooks/sms', {
        method: 'POST',
        body: 'invalid-form-data',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/xml');
      
      const responseText = await response.text();
      expect(responseText).toContain('<Response></Response>');
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockPrisma.message.create.mockRejectedValue(new Error('Database connection failed'));

      const request = createTwilioWebhookRequest({
        MessageSid: 'SMtest123',
        From: '+15559876543',
        To: '+15551234567',
        Body: 'TRIBE',
        SmsStatus: 'received',
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200); // Should still return success to Twilio
      expect(response.headers.get('Content-Type')).toBe('application/xml');
    });

    it('should handle SMS sending errors gracefully', async () => {
      // Mock TwilioSMSService to throw error
      const TwilioSMSService = require('@/infrastructure/sms/TwilioSMSService').TwilioSMSService;
      TwilioSMSService.mockImplementation(() => ({
        sendMessage: jest.fn().mockRejectedValue(new Error('Twilio API error')),
      }));

      const request = createTwilioWebhookRequest({
        MessageSid: 'SMtest123',
        From: '+15559876543',
        To: '+15551234567',
        Body: 'TRIBE',
        SmsStatus: 'received',
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200); // Should still return success
    });

    it('should store both inbound and outbound messages', async () => {
      const request = createTwilioWebhookRequest({
        MessageSid: 'SMtest123',
        From: '+15559876543',
        To: '+15551234567',
        Body: 'TRIBE',
        SmsStatus: 'received',
      });

      await POST(request);

      // Verify both inbound and outbound messages were stored
      expect(mockPrisma.message.create).toHaveBeenCalledTimes(2);
      
      const calls = mockPrisma.message.create.mock.calls;
      expect(calls[0][0].data.direction).toBe('INBOUND');
      expect(calls[1][0].data.direction).toBe('OUTBOUND');
    });
  });

  describe('GET /api/webhooks/sms', () => {
    it('should return health check information', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhooks/sms', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.service).toBe('SMS Webhook');
      expect(data.timestamp).toBeDefined();
      expect(data.environment).toBeDefined();
    });
  });
});