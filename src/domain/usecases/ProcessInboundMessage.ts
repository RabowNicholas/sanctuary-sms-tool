import { SubscriberRepository } from '../repositories/SubscriberRepository';
import { Subscriber } from '../entities/Subscriber';

export interface ProcessInboundMessageResult {
  shouldRespond: boolean;
  response?: string;
  notifySlack: boolean;
  slackMessage?: string;
  isOptIn?: boolean;
}

export interface TwilioService {
  sendMessage(to: string, body: string): Promise<any>;
}

export interface SlackService {
  postMessage(message: string, threadTs?: string): Promise<string>;
}

export class ProcessInboundMessage {
  private readonly OPT_IN_KEYWORDS = ['TRIBE'];
  private readonly OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE'];

  constructor(
    private subscriberRepository: SubscriberRepository,
    private twilioService: TwilioService,
    private slackService: SlackService,
    private welcomeMessage: string = "Welcome to SANCTUARY!"
  ) {}

  async execute(phoneNumber: string, message: string): Promise<ProcessInboundMessageResult> {
    // Validate phone number
    if (!Subscriber.isValidPhoneNumber(phoneNumber)) {
      throw new Error('Invalid US phone number');
    }

    const normalizedMessage = message.trim().toUpperCase();
    const existingSubscriber = await this.subscriberRepository.findByPhoneNumber(phoneNumber);

    // Handle opt-in keywords
    if (this.OPT_IN_KEYWORDS.includes(normalizedMessage)) {
      return this.handleOptIn(phoneNumber, existingSubscriber);
    }

    // Handle opt-out keywords
    if (this.OPT_OUT_KEYWORDS.includes(normalizedMessage)) {
      return this.handleOptOut(phoneNumber, existingSubscriber);
    }

    // Handle regular messages
    return this.handleRegularMessage(phoneNumber, message, existingSubscriber);
  }

  private async handleOptIn(
    phoneNumber: string,
    existingSubscriber: Subscriber | null
  ): Promise<ProcessInboundMessageResult> {
    if (existingSubscriber) {
      if (existingSubscriber.isActive) {
        // Already subscribed
        return {
          shouldRespond: true,
          response: "You're already in the tribe!",
          notifySlack: false,
          isOptIn: true,
        };
      } else {
        // Reactivate deactivated subscriber
        existingSubscriber.activate();
        await this.subscriberRepository.update(existingSubscriber);

        const formattedPhone = Subscriber.formatPhoneNumber(phoneNumber);
        return {
          shouldRespond: true,
          response: "Welcome back! You're subscribed again.",
          notifySlack: true,
          slackMessage: `🔄 Subscriber reactivated: ${formattedPhone} rejoined the tribe!`,
          isOptIn: true,
        };
      }
    } else {
      // New subscriber
      const newSubscriber = Subscriber.create(phoneNumber);
      await this.subscriberRepository.add(newSubscriber);

      const formattedPhone = Subscriber.formatPhoneNumber(phoneNumber);
      return {
        shouldRespond: true,
        response: this.welcomeMessage,
        notifySlack: true,
        slackMessage: `✅ New subscriber: ${formattedPhone} joined the tribe!`,
        isOptIn: true,
      };
    }
  }

  private async handleOptOut(
    phoneNumber: string,
    existingSubscriber: Subscriber | null
  ): Promise<ProcessInboundMessageResult> {
    if (existingSubscriber && existingSubscriber.isActive) {
      existingSubscriber.deactivate();
      await this.subscriberRepository.update(existingSubscriber);

      const formattedPhone = Subscriber.formatPhoneNumber(phoneNumber);
      return {
        shouldRespond: true,
        response: "You've been unsubscribed. Text TRIBE to rejoin.",
        notifySlack: true,
        slackMessage: `❌ Subscriber left: ${formattedPhone} unsubscribed`,
      };
    } else {
      return {
        shouldRespond: true,
        response: "You're not currently subscribed.",
        notifySlack: false,
      };
    }
  }

  private async handleRegularMessage(
    phoneNumber: string,
    message: string,
    existingSubscriber: Subscriber | null
  ): Promise<ProcessInboundMessageResult> {
    if (existingSubscriber && existingSubscriber.isActive) {
      // Message from active subscriber - notify Slack
      const slackMessage = `📱 New message from ${existingSubscriber.formattedPhoneNumber}:\\n\\n${message}`;
      return {
        shouldRespond: false,
        notifySlack: true,
        slackMessage,
      };
    } else {
      // Message from non-subscriber or inactive subscriber
      return {
        shouldRespond: true,
        response: "Text TRIBE to subscribe to updates.",
        notifySlack: false,
      };
    }
  }
}