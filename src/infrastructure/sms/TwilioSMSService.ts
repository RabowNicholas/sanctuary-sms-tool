import { TwilioService } from '@/domain/usecases/ProcessInboundMessage';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string;
}

export interface SMSResult {
  messageId: string;
  status: string;
  to: string;
  from: string;
  body: string;
}

export class TwilioSMSService implements TwilioService {
  private twilioClient: any;
  private messagingServiceSid: string;

  constructor(config: TwilioConfig) {
    // Lazy load Twilio to avoid import errors in tests
    this.messagingServiceSid = config.messagingServiceSid;
    
    // Use mock mode if in test environment or if credentials are test values
    const isTestMode = process.env.NODE_ENV === 'test' || 
                      config.accountSid.startsWith('ACtest') ||
                      config.authToken === 'test_token';
    
    if (!isTestMode) {
      try {
        const twilio = require('twilio');
        this.twilioClient = twilio(config.accountSid, config.authToken);
      } catch (error) {
        console.warn('Twilio SDK not available, using mock mode');
        this.twilioClient = null;
      }
    } else {
      console.log('🔧 TwilioSMSService: Running in mock mode');
      this.twilioClient = null;
    }
  }

  async sendMessage(to: string, body: string): Promise<SMSResult> {
    // Validate phone number format
    if (!this.isValidPhoneNumber(to)) {
      throw new Error(`Invalid phone number format: ${to}`);
    }

    // Validate message length
    if (body.length === 0) {
      throw new Error('Message body cannot be empty');
    }

    if (body.length > 1600) {
      throw new Error('Message too long (max 1600 characters)');
    }

    // Mock mode for testing/development
    if (!this.twilioClient) {
      return this.mockSendMessage(to, body);
    }

    try {
      const message = await this.twilioClient.messages.create({
        body,
        messagingServiceSid: this.messagingServiceSid,
        to,
      });

      return {
        messageId: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body,
      };
    } catch (error: any) {
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  private mockSendMessage(to: string, body: string): SMSResult {
    const messageId = `SM${Math.random().toString(36).substring(2, 15)}`;

    console.log(`📱 [TWILIO MOCK] SMS to ${to}: ${body}`);

    return {
      messageId,
      status: 'sent',
      to,
      from: this.messagingServiceSid,
      body,
    };
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // US phone number format: +1XXXXXXXXXX
    const usPhoneRegex = /^\+1\d{10}$/;
    return usPhoneRegex.test(phoneNumber);
  }

  async getMessageStatus(messageId: string): Promise<string> {
    if (!this.twilioClient) {
      return 'delivered'; // Mock status
    }

    try {
      const message = await this.twilioClient.messages(messageId).fetch();
      return message.status;
    } catch (error: any) {
      throw new Error(`Failed to get message status: ${error.message}`);
    }
  }

  calculateCost(messageBody: string): number {
    const segmentLength = 160;
    const costPerSegment = 0.0083; // Twilio US SMS cost
    
    const segments = messageBody.length === 0 ? 1 : Math.ceil(messageBody.length / segmentLength);
    return segments * costPerSegment;
  }
}