import { SlackService } from '@/domain/usecases/ProcessInboundMessage';

export interface SlackConfig {
  botToken: string;
  channel: string;
}

export interface SlackMessage {
  text: string;
  threadTs?: string;
  channel?: string;
}

export interface SlackResponse {
  ok: boolean;
  ts: string;
  channel: string;
  message?: any;
  error?: string;
}

export class SlackNotificationService implements SlackService {
  private botToken: string;
  private defaultChannel: string;
  private isTestMode: boolean;

  constructor(config: SlackConfig) {
    this.botToken = config.botToken;
    this.defaultChannel = config.channel;
    
    // Use mock mode if in test environment or if token is test value
    this.isTestMode = process.env.NODE_ENV === 'test' || 
                     config.botToken === 'xoxb-test' ||
                     config.botToken.startsWith('xoxb-test');
    
    if (this.isTestMode) {
      console.log('🔧 SlackNotificationService: Running in mock mode');
    }
  }

  async postMessage(message: string, threadTs?: string): Promise<string> {
    // Validate message
    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    if (message.length > 3000) {
      throw new Error('Message too long (max 3000 characters)');
    }

    // Mock mode for testing/development
    if (this.isTestMode) {
      return this.mockPostMessage(message, threadTs);
    }

    try {
      const response = await this.sendSlackMessage({
        text: message,
        threadTs,
        channel: this.defaultChannel,
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.error}`);
      }

      return response.ts;
    } catch (error: any) {
      throw new Error(`Failed to send Slack message: ${error.message}`);
    }
  }

  private async sendSlackMessage(message: SlackMessage): Promise<SlackResponse> {
    const url = 'https://slack.com/api/chat.postMessage';
    
    const payload = {
      channel: message.channel || this.defaultChannel,
      text: message.text,
      ...(message.threadTs && { thread_ts: message.threadTs }),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  private mockPostMessage(message: string, threadTs?: string): string {
    const messageType = threadTs ? 'Reply' : 'New thread';
    const preview = message.length > 100 ? message.substring(0, 100) + '...' : message;
    
    console.log(`💬 [SLACK MOCK] ${messageType}: ${preview}`);
    
    // Generate mock thread timestamp
    return threadTs || `ts-${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
  }

  async createThread(message: string): Promise<string> {
    return this.postMessage(message);
  }

  async replyToThread(threadTs: string, message: string): Promise<string> {
    return this.postMessage(message, threadTs);
  }

  async sendSubscriberMessage(phoneNumber: string, message: string, threadTs?: string): Promise<string> {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const slackMessage = `📱 New message from ${formattedPhone}:\n\n${message}`;
    
    return this.postMessage(slackMessage, threadTs);
  }

  async sendSystemNotification(notification: string): Promise<string> {
    const slackMessage = `🤖 System: ${notification}`;
    return this.postMessage(slackMessage);
  }

  async sendOptInNotification(phoneNumber: string): Promise<string> {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const slackMessage = `✅ New subscriber: ${formattedPhone} joined the tribe!`;
    
    return this.postMessage(slackMessage);
  }

  async sendOptOutNotification(phoneNumber: string): Promise<string> {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const slackMessage = `❌ Subscriber left: ${formattedPhone} unsubscribed`;
    
    return this.postMessage(slackMessage);
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Convert +15551234567 to (555) 123-4567
    if (phoneNumber.startsWith('+1') && phoneNumber.length === 12) {
      const cleaned = phoneNumber.substring(2);
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phoneNumber;
  }

  async testConnection(): Promise<boolean> {
    if (this.isTestMode) {
      console.log('🔧 Slack connection test: MOCK MODE - OK');
      return true;
    }

    try {
      const response = await fetch('https://slack.com/api/auth.test', {
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
        },
      });

      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      console.error('Slack connection test failed:', error);
      return false;
    }
  }

  getChannelInfo() {
    return {
      channel: this.defaultChannel,
      isTestMode: this.isTestMode,
    };
  }
}