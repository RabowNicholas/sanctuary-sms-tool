import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSuppressionRepository } from '@/infrastructure/database/repositories/PrismaSuppressionRepository';
import { validateTwilioWebhook } from '@/lib/twilioWebhookValidator';

// NOTE: Register this URL in the Twilio console as the Status Callback URL
// for your Messaging Service: https://<your-domain>/api/webhooks/delivery-status

// Error codes that trigger automatic suppression
const SUPPRESSION_ERROR_CODES: Record<string, 'OPTED_OUT' | 'UNREACHABLE' | 'NONEXISTENT'> = {
  '21610': 'OPTED_OUT',   // Attempted to send to unsubscribed recipient
  '30003': 'UNREACHABLE', // Unreachable destination handset
  '30005': 'NONEXISTENT', // Unknown destination handset
};

// Twilio delivery status webhook payload interface
interface TwilioDeliveryWebhook {
  MessageSid: string;
  MessageStatus: 'sent' | 'delivered' | 'undelivered' | 'failed' | 'queued' | 'sending' | 'receiving' | 'accepted';
  To: string;
  From: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio webhook
    const formData = await request.formData();

    // Validate Twilio signature before processing
    const isValid = await validateTwilioWebhook(request, formData, '/api/webhooks/delivery-status');
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const payload: TwilioDeliveryWebhook = {
      MessageSid: formData.get('MessageSid') as string,
      MessageStatus: formData.get('MessageStatus') as any,
      To: formData.get('To') as string,
      From: formData.get('From') as string,
      ErrorCode: formData.get('ErrorCode') as string | undefined,
      ErrorMessage: formData.get('ErrorMessage') as string | undefined,
    };

    console.log('📬 Delivery status webhook received:', {
      messageSid: payload.MessageSid,
      status: payload.MessageStatus,
      to: payload.To,
      errorCode: payload.ErrorCode,
    });

    // Validate required fields
    if (!payload.MessageSid || !payload.MessageStatus) {
      console.error('❌ Invalid delivery webhook payload: missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const prisma = new PrismaClient();

    try {
      // Find message by Twilio SID
      const message = await prisma.message.findUnique({
        where: { twilioSid: payload.MessageSid },
      });

      if (!message) {
        console.warn(`⚠️  Message not found for SID: ${payload.MessageSid}`);
        await prisma.$disconnect();
        // Don't fail - this could be a non-broadcast message
        return NextResponse.json({ success: true, message: 'Message not found' });
      }

      // Map Twilio status to our DeliveryStatus enum
      let deliveryStatus: 'SENT' | 'DELIVERED' | 'FAILED' | 'UNDELIVERED';

      switch (payload.MessageStatus) {
        case 'delivered':
          deliveryStatus = 'DELIVERED';
          break;
        case 'failed':
          deliveryStatus = 'FAILED';
          break;
        case 'undelivered':
          deliveryStatus = 'UNDELIVERED';
          break;
        case 'sent':
        case 'queued':
        case 'sending':
        case 'receiving':
        case 'accepted':
        default:
          deliveryStatus = 'SENT';
          break;
      }

      // Update message delivery status and store error code
      await prisma.message.update({
        where: { twilioSid: payload.MessageSid },
        data: {
          deliveryStatus,
          errorCode: payload.ErrorCode || null,
        },
      });

      console.log(`✅ Updated delivery status for ${payload.MessageSid}: ${deliveryStatus}`);

      if (payload.ErrorCode) {
        console.error(`❌ Delivery error ${payload.ErrorCode}: ${payload.ErrorMessage}`);
      }

      // Auto-suppress on opt-out, unreachable, or nonexistent error codes
      const suppressionReason = payload.ErrorCode
        ? SUPPRESSION_ERROR_CODES[payload.ErrorCode]
        : undefined;

      if (
        suppressionReason &&
        payload.To &&
        (payload.MessageStatus === 'undelivered' || payload.MessageStatus === 'failed')
      ) {
        const suppressionRepo = new PrismaSuppressionRepository(prisma);

        await suppressionRepo.addEntry(payload.To, suppressionReason);
        console.log(`🚫 Auto-suppressed ${payload.To} (reason: ${suppressionReason}, error: ${payload.ErrorCode})`);

        // On opt-out (21610): also deactivate the subscriber record
        if (payload.ErrorCode === '21610') {
          const updated = await prisma.subscriber.updateMany({
            where: { phoneNumber: payload.To },
            data: { isActive: false },
          });
          if (updated.count > 0) {
            console.log(`📴 Deactivated subscriber ${payload.To} due to opt-out (21610)`);
          }
        }
      }

      await prisma.$disconnect();

      return NextResponse.json({ success: true });

    } catch (error: any) {
      console.error('Database error:', error);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: 'Failed to update delivery status' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Delivery status webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    service: 'Delivery Status Webhook',
    timestamp: new Date().toISOString(),
  });
}
