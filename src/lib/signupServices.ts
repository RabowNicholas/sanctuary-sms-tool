import { PrismaClient } from '@/generated/prisma';
import { PrismaSubscriberRepository } from '@/infrastructure/database/repositories/PrismaSubscriberRepository';
import { PrismaSignupKeywordRepository } from '@/infrastructure/database/repositories/PrismaSignupKeywordRepository';
import { PrismaSubscriberListRepository } from '@/infrastructure/database/repositories/PrismaSubscriberListRepository';
import { TwilioSMSService } from '@/infrastructure/sms/TwilioSMSService';
import { SlackNotificationService } from '@/infrastructure/notifications/SlackNotificationService';
import { ProcessInboundMessage } from '@/domain/usecases/ProcessInboundMessage';

/** Wires up the same services the inbound SMS webhook uses, for the web signup routes. */
export function createSignupServices() {
  const prisma = new PrismaClient();
  const subscriberRepo = new PrismaSubscriberRepository(prisma);
  const keywordRepo = new PrismaSignupKeywordRepository(prisma);
  const listRepo = new PrismaSubscriberListRepository(prisma);
  const twilioService = new TwilioSMSService({
    accountSid: process.env.TWILIO_ACCOUNT_SID || 'ACtest123',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'test_token',
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || 'MGtest123',
  });
  const slackService = new SlackNotificationService({
    botToken: process.env.SLACK_BOT_TOKEN || 'xoxb-test',
    channel: process.env.SLACK_CHANNEL_ID || 'C0123456789',
  });
  const optIn = new ProcessInboundMessage(subscriberRepo, keywordRepo, listRepo, twilioService, slackService, 'Welcome!');
  return { prisma, subscriberRepo, keywordRepo, listRepo, twilioService, slackService, optIn };
}
