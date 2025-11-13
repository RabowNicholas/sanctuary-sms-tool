import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSubscriberRepository } from '@/infrastructure/database/repositories/PrismaSubscriberRepository';
import { TwilioSMSService } from '@/infrastructure/sms/TwilioSMSService';
import { ProcessInboundMessage } from '@/domain/usecases/ProcessInboundMessage';

// Twilio webhook payload interface
interface TwilioWebhookPayload {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumSegments?: string;
  SmsStatus?: string;
  AccountSid?: string;
}

// Import Slack service
import { SlackNotificationService } from '@/infrastructure/notifications/SlackNotificationService';

export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio webhook
    const formData = await request.formData();
    const payload: TwilioWebhookPayload = {
      MessageSid: formData.get('MessageSid') as string,
      From: formData.get('From') as string,
      To: formData.get('To') as string,
      Body: formData.get('Body') as string,
      NumSegments: formData.get('NumSegments') as string,
      SmsStatus: formData.get('SmsStatus') as string,
      AccountSid: formData.get('AccountSid') as string,
    };

    console.log('📨 Received SMS webhook:', {
      from: payload.From,
      to: payload.To,
      body: payload.Body?.substring(0, 50) + '...',
      messageSid: payload.MessageSid
    });

    // Validate required fields
    if (!payload.From || !payload.To || !payload.Body) {
      console.error('❌ Invalid webhook payload: missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Initialize services
    const prisma = new PrismaClient();
    const subscriberRepo = new PrismaSubscriberRepository(prisma);
    
    const twilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || 'ACtest123',
      authToken: process.env.TWILIO_AUTH_TOKEN || 'test_token',
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || 'MGtest123',
    };
    
    const twilioService = new TwilioSMSService(twilioConfig);

    // Initialize Slack service
    const slackConfig = {
      botToken: process.env.SLACK_BOT_TOKEN || 'xoxb-test',
      channel: process.env.SLACK_CHANNEL_ID || 'C0123456789',
    };
    const slackService = new SlackNotificationService(slackConfig);

    const messageProcessor = new ProcessInboundMessage(
      subscriberRepo,
      twilioService,
      slackService
    );

    // Process the inbound message
    const result = await messageProcessor.execute(payload.From, payload.Body);

    console.log('✅ Message processed:', {
      shouldRespond: result.shouldRespond,
      notifySlack: result.notifySlack,
      responseLength: result.response?.length || 0
    });

    // Store the inbound message in database
    try {
      await prisma.message.create({
        data: {
          phoneNumber: payload.From,
          content: payload.Body,
          direction: 'INBOUND',
        }
      });
      console.log('💾 Inbound message stored');
    } catch (error) {
      console.error('❌ Failed to store inbound message:', error);
      // Continue processing even if message storage fails
    }

    // Send SMS response if needed
    if (result.shouldRespond && result.response) {
      try {
        await twilioService.sendMessage(payload.From, result.response);

        // Store the outbound message
        try {
          await prisma.message.create({
            data: {
              phoneNumber: payload.From,
              content: result.response,
              direction: 'OUTBOUND',
            }
          });
          console.log('💾 Outbound message stored');
        } catch (error) {
          console.error('❌ Failed to store outbound message:', error);
        }

        console.log('📤 SMS response sent');

        // Mark TRIBE opt-in messages as read after response is sent
        if (result.isOptIn) {
          try {
            const subscriber = await subscriberRepo.findByPhoneNumber(payload.From);
            if (subscriber) {
              await prisma.subscriber.update({
                where: { id: subscriber.id },
                data: { lastReadAt: new Date() }
              });
              console.log('✅ TRIBE opt-in conversation marked as read');
            }
          } catch (error) {
            console.error('❌ Failed to mark TRIBE conversation as read:', error);
          }
        }
      } catch (error) {
        console.error('❌ Failed to send SMS response:', error);
        // Don't fail the webhook for SMS sending errors
      }
    }

    // Send Slack notification if needed
    if (result.notifySlack && result.slackMessage) {
      try {
        const threadTs = await slackService.postMessage(result.slackMessage);
        console.log('💬 Slack notification sent:', threadTs);

        // Update subscriber with thread timestamp for future messages
        if (payload.From) {
          try {
            const subscriber = await subscriberRepo.findByPhoneNumber(payload.From);
            if (subscriber && !subscriber.slackThreadTs) {
              subscriber.slackThreadTs = threadTs;
              await subscriberRepo.update(subscriber);
            }
          } catch (error) {
            console.error('❌ Failed to update subscriber with thread TS:', error);
          }
        }
      } catch (error) {
        console.error('❌ Failed to send Slack notification:', error);
        // Don't fail the webhook for Slack errors
      }
    }

    // Send SMS notification to admin for regular messages (not keywords)
    // Only send if it's a regular message from an active subscriber
    const isRegularMessage = !result.shouldRespond && result.notifySlack;
    const adminPhoneNumber = process.env.ADMIN_PHONE_NUMBER;
    const enableSmsNotifications = process.env.ENABLE_SMS_NOTIFICATIONS !== 'false';

    if (isRegularMessage && adminPhoneNumber && enableSmsNotifications) {
      try {
        const subscriber = await subscriberRepo.findByPhoneNumber(payload.From);
        if (subscriber) {
          const formattedPhone = subscriber.formattedPhoneNumber;

          // Use VERCEL_URL in production, NEXTAUTH_URL as fallback
          const vercelUrl = process.env.VERCEL_URL;
          const baseUrl = vercelUrl
            ? `https://${vercelUrl}`
            : (process.env.NEXTAUTH_URL || 'http://localhost:3000');

          const conversationLink = `${baseUrl}/dashboard/conversations/${subscriber.id}`;

          const notificationMessage = `New Sanctuary message from ${formattedPhone}\n${conversationLink}`;

          await twilioService.sendMessage(adminPhoneNumber, notificationMessage);
          console.log('📲 Admin SMS notification sent to:', adminPhoneNumber);
        }
      } catch (error) {
        console.error('❌ Failed to send admin SMS notification:', error);
        // Don't fail the webhook for notification errors
      }
    }

    // Disconnect from database
    await prisma.$disconnect();

    // Return TwiML response (required by Twilio)
    const twimlResponse = result.shouldRespond && result.response 
      ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${result.response}</Message></Response>`
      : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

    return new NextResponse(twimlResponse, {
      headers: {
        'Content-Type': 'application/xml',
      },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ SMS webhook error:', error);
    
    // Return empty TwiML response to prevent Twilio retries
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        headers: {
          'Content-Type': 'application/xml',
        },
        status: 200,
      }
    );
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    service: 'SMS Webhook',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
}