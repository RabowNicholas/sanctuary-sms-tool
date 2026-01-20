import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { TwilioSMSService } from '@/infrastructure/sms/TwilioSMSService';
import { CostCalculator } from '@/infrastructure/cost/CostCalculator';
import { LinkShortener } from '@/infrastructure/utils/LinkShortener';

interface TestMessageRequest {
  phoneNumber: string;
  message: string;
  campaignName?: string;
  approvedLinks?: string[];
}

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = new PrismaClient();

  try {
    const body: TestMessageRequest = await request.json();

    // Validate request
    if (!body.phoneNumber || !body.phoneNumber.trim()) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

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

    // Validate phone number format
    const phoneRegex = /^\+1\d{10}$/;
    if (!phoneRegex.test(body.phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use +1XXXXXXXXXX' },
        { status: 400 }
      );
    }

    // Calculate cost
    const costCalculator = new CostCalculator();
    const segments = costCalculator.calculateSegments(body.message);
    const totalCost = costCalculator.calculateBroadcastCost(body.message, 1);

    // Create test broadcast record
    const broadcast = await prisma.broadcast.create({
      data: {
        name: body.campaignName ? `[TEST] ${body.campaignName}` : '[TEST] Test Message',
        message: body.message,
        sentCount: 1,
        totalCost,
      },
    });

    console.log(`📊 Created test broadcast: ${broadcast.id}`);

    // Process links in message
    let processedMessage = body.message;
    let links: any[] = [];

    try {
      const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NEXTAUTH_URL);

      // For test messages, we want to process links even locally to match production behavior
      // If no baseUrl or it's localhost, we'll still create tracking but warn about it
      if (!baseUrl || baseUrl.includes('localhost')) {
        console.log('⚠️  Running locally - using localhost for link tracking (links will work in production)');
        const localBaseUrl = baseUrl || 'http://localhost:3000';
        const linkShortener = new LinkShortener(prisma, localBaseUrl);
        const result = await linkShortener.processMessage(
          body.message,
          broadcast.id,
          body.approvedLinks
        );
        processedMessage = result.processedMessage;
        links = result.links;

        if (links.length > 0) {
          console.log(`🔗 Created ${links.length} tracking link(s) for test (localhost URLs)`);
        }
      } else {
        const linkShortener = new LinkShortener(prisma, baseUrl);
        const result = await linkShortener.processMessage(
          body.message,
          broadcast.id,
          body.approvedLinks
        );
        processedMessage = result.processedMessage;
        links = result.links;

        if (links.length > 0) {
          console.log(`🔗 Created ${links.length} tracking link(s) for test`);
        }
      }
    } catch (error) {
      console.error('⚠️ Failed to process links (using original message):', error);
      processedMessage = body.message;
    }

    // Initialize Twilio service
    const twilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || 'ACtest123',
      authToken: process.env.TWILIO_AUTH_TOKEN || 'test_token',
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || 'MGtest123',
    };

    const twilioService = new TwilioSMSService(twilioConfig);

    console.log(`📤 Sending test message to ${body.phoneNumber}...`);

    // Send test message
    try {
      const result = await twilioService.sendMessage(body.phoneNumber, processedMessage);

      // Log the message in database
      try {
        await prisma.message.create({
          data: {
            phoneNumber: body.phoneNumber,
            content: processedMessage,
            direction: 'OUTBOUND',
            broadcastId: broadcast.id,
            twilioSid: result.messageId,
            deliveryStatus: 'SENT',
          },
        });
      } catch (dbError) {
        console.error('⚠️ Failed to log message (continuing):', dbError);
      }

      console.log(`✅ Test message sent successfully`);

      return NextResponse.json({
        success: true,
        broadcastId: broadcast.id,
        messageId: result.messageId,
        status: result.status,
        phoneNumber: body.phoneNumber,
        totalCost: totalCost.toFixed(4),
        segmentCount: segments,
        linksTracked: links.length,
        processedMessage,
      });
    } catch (error: any) {
      console.error(`❌ Failed to send test message:`, error.message);

      return NextResponse.json(
        {
          error: `Failed to send test message: ${error.message}`,
          broadcastId: broadcast.id,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Test message API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
