import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

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

      // Update message delivery status
      await prisma.message.update({
        where: { twilioSid: payload.MessageSid },
        data: { deliveryStatus },
      });

      console.log(`✅ Updated delivery status for ${payload.MessageSid}: ${deliveryStatus}`);

      if (payload.ErrorCode) {
        console.error(`❌ Delivery error ${payload.ErrorCode}: ${payload.ErrorMessage}`);
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
