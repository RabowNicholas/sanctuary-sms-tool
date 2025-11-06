import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { TwilioSMSService } from '@/infrastructure/sms/TwilioSMSService';
import { CostCalculator } from '@/infrastructure/cost/CostCalculator';

interface RouteParams {
  params: {
    id: string;
  };
}

interface ReplyRequest {
  message: string;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const prisma = new PrismaClient();

  try {
    const subscriberId = params.id;
    const body: ReplyRequest = await request.json();

    // Validate request
    if (!body.message || !body.message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (body.message.length > 1600) {
      return NextResponse.json(
        { error: 'Message too long (max 1600 characters)' },
        { status: 400 }
      );
    }

    // Find subscriber
    const subscriber = await prisma.subscriber.findUnique({
      where: { id: subscriberId },
    });

    if (!subscriber) {
      return NextResponse.json(
        { error: 'Subscriber not found' },
        { status: 404 }
      );
    }

    if (!subscriber.isActive) {
      return NextResponse.json(
        { error: 'Cannot send message to inactive subscriber' },
        { status: 400 }
      );
    }

    // Initialize Twilio service
    const twilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || 'ACtest123',
      authToken: process.env.TWILIO_AUTH_TOKEN || 'test_token',
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || 'MGtest123',
    };

    const twilioService = new TwilioSMSService(twilioConfig);

    // Calculate cost (single message = 1 subscriber)
    const costCalculator = new CostCalculator();
    const cost = costCalculator.calculateBroadcastCost(body.message, 1);

    console.log(`📤 Sending reply to ${subscriber.phoneNumber}: ${body.message.substring(0, 50)}...`);

    // Send SMS
    const result = await twilioService.sendMessage(
      subscriber.phoneNumber,
      body.message
    );

    console.log(`✅ Reply sent successfully: ${result.messageId}`);

    // Store outbound message in database
    await prisma.message.create({
      data: {
        phoneNumber: subscriber.phoneNumber,
        content: body.message,
        direction: 'OUTBOUND',
      },
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      status: result.status,
      cost: cost.toFixed(2),
      sentTo: subscriber.phoneNumber,
    });

  } catch (error: any) {
    console.error('Error sending reply:', error);
    return NextResponse.json(
      { error: `Failed to send reply: ${error.message}` },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
