import type { PrismaClient } from '@/generated/prisma';
import type { ProcessInboundMessageResult, TwilioService, SlackService } from '@/domain/usecases/ProcessInboundMessage';
import type { SubscriberRepository } from '@/domain/repositories/SubscriberRepository';

interface Deps {
  prisma: PrismaClient;
  subscriberRepo: SubscriberRepository;
  twilioService: TwilioService;
  slackService: SlackService;
}

/**
 * Side effects after ProcessInboundMessage decides what to do:
 * send the SMS response, store it, mark opt-in conversations read,
 * and post to Slack (saving the thread ts). Each step is best-effort.
 * Shared by the inbound SMS webhook and the web signup flow.
 */
export async function deliverOptInResult(
  phoneNumber: string,
  result: ProcessInboundMessageResult,
  { prisma, subscriberRepo, twilioService, slackService }: Deps,
): Promise<void> {
  if (result.shouldRespond && result.response) {
    try {
      await twilioService.sendMessage(phoneNumber, result.response);

      try {
        await prisma.message.create({
          data: { phoneNumber, content: result.response, direction: 'OUTBOUND' },
        });
      } catch (error) {
        console.error('❌ Failed to store outbound message:', error);
      }

      if (result.isOptIn) {
        try {
          const subscriber = await subscriberRepo.findByPhoneNumber(phoneNumber);
          if (subscriber) {
            await prisma.subscriber.update({
              where: { id: subscriber.id },
              data: { lastReadAt: new Date() },
            });
          }
        } catch (error) {
          console.error('❌ Failed to mark opt-in conversation as read:', error);
        }
      }
    } catch (error) {
      console.error('❌ Failed to send SMS response:', error);
    }
  }

  if (result.notifySlack && result.slackMessage) {
    try {
      const threadTs = await slackService.postMessage(result.slackMessage);
      try {
        const subscriber = await subscriberRepo.findByPhoneNumber(phoneNumber);
        if (subscriber && !subscriber.slackThreadTs) {
          subscriber.slackThreadTs = threadTs;
          await subscriberRepo.update(subscriber);
        }
      } catch (error) {
        console.error('❌ Failed to update subscriber with thread TS:', error);
      }
    } catch (error) {
      console.error('❌ Failed to send Slack notification:', error);
    }
  }
}
