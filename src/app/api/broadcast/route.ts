import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSubscriberRepository } from '@/infrastructure/database/repositories/PrismaSubscriberRepository';
import { TwilioSMSService } from '@/infrastructure/sms/TwilioSMSService';
import { CostCalculator } from '@/infrastructure/cost/CostCalculator';

interface BroadcastRequest {
  message: string;
}

export async function POST(request: NextRequest) {
  const prisma = new PrismaClient();
  
  try {
    const body: BroadcastRequest = await request.json();
    
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

    // Get active subscribers
    const subscriberRepo = new PrismaSubscriberRepository(prisma);
    const activeSubscribers = await subscriberRepo.findAllActive();

    if (activeSubscribers.length === 0) {
      return NextResponse.json(
        { error: 'No active subscribers found' },
        { status: 400 }
      );
    }

    // Calculate cost
    const costCalculator = new CostCalculator();
    const totalCost = costCalculator.calculateBroadcastCost(body.message, activeSubscribers.length);

    // Initialize Twilio service
    const twilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || 'ACtest123',
      authToken: process.env.TWILIO_AUTH_TOKEN || 'test_token',
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || 'MGtest123',
    };
    
    const twilioService = new TwilioSMSService(twilioConfig);

    // Send messages to all active subscribers
    const results = [];
    const errors = [];

    console.log(`📤 Starting broadcast to ${activeSubscribers.length} subscribers...`);

    for (const subscriber of activeSubscribers) {
      try {
        const result = await twilioService.sendMessage(subscriber.phoneNumber, body.message);
        results.push({
          phoneNumber: subscriber.phoneNumber,
          messageId: result.messageId,
          status: result.status,
        });

        // Store the outbound message
        await prisma.message.create({
          data: {
            phoneNumber: subscriber.phoneNumber,
            content: body.message,
            direction: 'OUTBOUND',
          },
        });

        console.log(`✅ Sent to ${subscriber.phoneNumber}: ${result.messageId}`);
      } catch (error: any) {
        console.error(`❌ Failed to send to ${subscriber.phoneNumber}:`, error.message);
        errors.push({
          phoneNumber: subscriber.phoneNumber,
          error: error.message,
        });
      }
    }

    // Log broadcast completion
    console.log(`📊 Broadcast completed: ${results.length} sent, ${errors.length} failed`);

    // Return summary
    return NextResponse.json({
      success: true,
      sentTo: results.length,
      failed: errors.length,
      totalCost: totalCost.toFixed(2),
      segmentCount: costCalculator.calculateSegments(body.message),
      results: results.slice(0, 10), // Return first 10 for reference
      errors: errors.slice(0, 5), // Return first 5 errors
    });

  } catch (error: any) {
    console.error('Broadcast error:', error);
    return NextResponse.json(
      { error: 'Failed to send broadcast' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}