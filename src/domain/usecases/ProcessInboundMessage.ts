import { SubscriberRepository } from '../repositories/SubscriberRepository';
import { SignupKeywordRepository } from '../repositories/SignupKeywordRepository';
import { SubscriberListRepository } from '../repositories/SubscriberListRepository';
import { Subscriber } from '../entities/Subscriber';
import { SignupKeyword } from '../entities/SignupKeyword';

export interface ProcessInboundMessageResult {
  shouldRespond: boolean;
  response?: string;
  notifySlack: boolean;
  slackMessage?: string;
  isOptIn?: boolean;
  matchedKeyword?: string;
}

export interface TwilioService {
  sendMessage(to: string, body: string): Promise<any>;
}

export interface SlackService {
  postMessage(message: string, threadTs?: string): Promise<string>;
}

export class ProcessInboundMessage {
  private readonly OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE'];

  constructor(
    private subscriberRepository: SubscriberRepository,
    private keywordRepository: SignupKeywordRepository,
    private listRepository: SubscriberListRepository,
    private twilioService: TwilioService,
    private slackService: SlackService,
    private defaultWelcomeMessage: string = "Welcome!"
  ) {}

  async execute(phoneNumber: string, message: string): Promise<ProcessInboundMessageResult> {
    // Validate phone number
    if (!Subscriber.isValidPhoneNumber(phoneNumber)) {
      throw new Error('Invalid US phone number');
    }

    const normalizedMessage = message.trim().toUpperCase();
    const existingSubscriber = await this.subscriberRepository.findByPhoneNumber(phoneNumber);

    // Check for dynamic signup keywords
    const matchedKeyword = await this.keywordRepository.findByKeyword(normalizedMessage);
    if (matchedKeyword && matchedKeyword.isActive) {
      return this.handleOptIn(phoneNumber, existingSubscriber, matchedKeyword);
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
    existingSubscriber: Subscriber | null,
    keyword: SignupKeyword
  ): Promise<ProcessInboundMessageResult> {
    if (existingSubscriber) {
      if (existingSubscriber.isActive) {
        // Already subscribed - but might need to add to keyword's list
        if (keyword.listId) {
          await this.listRepository.addMember(
            keyword.listId,
            existingSubscriber.id,
            `keyword:${keyword.keyword}`
          );
        }

        return {
          shouldRespond: true,
          response: "You're already subscribed!",
          notifySlack: false,
          isOptIn: true,
          matchedKeyword: keyword.keyword,
        };
      } else {
        // Reactivate deactivated subscriber
        existingSubscriber.activate();
        existingSubscriber.joinedViaKeyword = keyword.keyword;
        await this.subscriberRepository.update(existingSubscriber);

        // Add to keyword's list if specified
        if (keyword.listId) {
          await this.listRepository.addMember(
            keyword.listId,
            existingSubscriber.id,
            `keyword:${keyword.keyword}`
          );
        }

        const formattedPhone = Subscriber.formatPhoneNumber(phoneNumber);
        return {
          shouldRespond: true,
          response: keyword.autoResponse || "Welcome back! You're subscribed again.",
          notifySlack: true,
          slackMessage: `🔄 Subscriber reactivated: ${formattedPhone} rejoined via ${keyword.keyword}!`,
          isOptIn: true,
          matchedKeyword: keyword.keyword,
        };
      }
    } else {
      // New subscriber
      const newSubscriber = Subscriber.create(phoneNumber, keyword.keyword);
      await this.subscriberRepository.add(newSubscriber);

      // Add to keyword's list if specified
      if (keyword.listId) {
        await this.listRepository.addMember(
          keyword.listId,
          newSubscriber.id,
          `keyword:${keyword.keyword}`
        );
      }

      const formattedPhone = Subscriber.formatPhoneNumber(phoneNumber);
      return {
        shouldRespond: true,
        response: keyword.autoResponse || this.defaultWelcomeMessage,
        notifySlack: true,
        slackMessage: `✅ New subscriber: ${formattedPhone} joined via ${keyword.keyword}!`,
        isOptIn: true,
        matchedKeyword: keyword.keyword,
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

      // Get available keywords for rejoin message
      const activeKeywords = await this.keywordRepository.findAllActive();
      const keywordList = activeKeywords.map(k => k.keyword).join(' or ');
      const rejoinMessage = keywordList
        ? `Text ${keywordList} to rejoin.`
        : 'Text to rejoin.';

      const formattedPhone = Subscriber.formatPhoneNumber(phoneNumber);
      return {
        shouldRespond: true,
        response: `You've been unsubscribed. ${rejoinMessage}`,
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
      const slackMessage = `📱 New message from ${existingSubscriber.formattedPhoneNumber}:\n\n${message}`;
      return {
        shouldRespond: false,
        notifySlack: true,
        slackMessage,
      };
    } else {
      // Message from non-subscriber or inactive subscriber
      // Get available keywords for subscribe message
      const activeKeywords = await this.keywordRepository.findAllActive();
      const keywordList = activeKeywords.map(k => k.keyword).join(' or ');
      const subscribeMessage = keywordList
        ? `Text ${keywordList} to subscribe to updates.`
        : 'Text to subscribe to updates.';

      return {
        shouldRespond: true,
        response: subscribeMessage,
        notifySlack: false,
      };
    }
  }
}