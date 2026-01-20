import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSubscriberRepository } from '@/infrastructure/database/repositories/PrismaSubscriberRepository';
import { TwilioSMSService } from '@/infrastructure/sms/TwilioSMSService';
import { CostCalculator } from '@/infrastructure/cost/CostCalculator';
import { LinkShortener } from '@/infrastructure/utils/LinkShortener';

interface BroadcastRequest {
  message: string;
  campaignName?: string;
  approvedLinks?: string[];
  targetAll?: boolean;      // If true, send to all active subscribers (default: true)
  targetListIds?: string[]; // List IDs to target (union of lists)
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

    // Determine targeting
    const targetAll = body.targetAll !== false; // Default to true
    const targetListIds = body.targetListIds || [];

    // Get active subscribers based on targeting
    const subscriberRepo = new PrismaSubscriberRepository(prisma);
    let activeSubscribers;

    if (targetAll || targetListIds.length === 0) {
      // Target all active subscribers
      activeSubscribers = await subscriberRepo.findAllActive();
    } else {
      // Target specific lists (union)
      activeSubscribers = await subscriberRepo.findActiveByListIds(targetListIds);
    }

    if (activeSubscribers.length === 0) {
      return NextResponse.json(
        { error: 'No active subscribers found for the selected target' },
        { status: 400 }
      );
    }

    // Calculate cost
    const costCalculator = new CostCalculator();
    const totalCost = costCalculator.calculateBroadcastCost(body.message, activeSubscribers.length);

    // Create broadcast record (non-blocking - analytics only)
    let broadcast: any = null;
    let broadcastId: string | null = null;
    const effectiveTargetAll = targetAll || targetListIds.length === 0;

    try {
      broadcast = await prisma.broadcast.create({
        data: {
          name: body.campaignName || null,
          message: body.message,
          sentCount: activeSubscribers.length,
          totalCost,
          targetAll: effectiveTargetAll,
        },
      });
      broadcastId = broadcast.id;

      // Create BroadcastTarget records if targeting specific lists
      if (!effectiveTargetAll && targetListIds.length > 0) {
        await prisma.broadcastTarget.createMany({
          data: targetListIds.map((listId: string) => ({
            broadcastId: broadcast.id,
            listId,
          })),
        });
        console.log(`📊 Created broadcast campaign: ${broadcast.id} targeting ${targetListIds.length} list(s)`);
      } else {
        console.log(`📊 Created broadcast campaign: ${broadcast.id} targeting all subscribers`);
      }
    } catch (error) {
      console.error('⚠️ Failed to create broadcast record (continuing without tracking):', error);
      // Continue without broadcast tracking - messages will still be sent
    }

    // Process links in message (non-blocking - analytics only)
    let processedMessage = body.message;
    let links: any[] = [];

    if (broadcastId) {
      try {
        const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : (process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : process.env.NEXTAUTH_URL || 'http://localhost:3000');

        const linkShortener = new LinkShortener(prisma, baseUrl);
        const result = await linkShortener.processMessage(
          body.message,
          broadcastId,
          body.approvedLinks
        );
        processedMessage = result.processedMessage;
        links = result.links;

        if (links.length > 0) {
          console.log(`🔗 Created ${links.length} tracking link(s) for broadcast`);
        }
      } catch (error) {
        console.error('⚠️ Failed to process links (using original message):', error);
        // Continue with original message - no link tracking
        processedMessage = body.message;
      }
    } else {
      console.log('⏭️  Skipping link processing (no broadcast record)');
    }

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
        const result = await twilioService.sendMessage(subscriber.phoneNumber, processedMessage);
        results.push({
          phoneNumber: subscriber.phoneNumber,
          messageId: result.messageId,
          status: result.status,
        });

        // Store the outbound message with broadcast link (non-blocking - best effort logging)
        try {
          await prisma.message.create({
            data: {
              phoneNumber: subscriber.phoneNumber,
              content: processedMessage,
              direction: 'OUTBOUND',
              broadcastId: broadcastId,
              twilioSid: result.messageId,
              deliveryStatus: 'SENT',
            },
          });
        } catch (dbError) {
          console.error(`⚠️  Failed to log message for ${subscriber.phoneNumber}:`, dbError);
          // Don't throw - message was sent successfully
        }

        console.log(`✅ Sent to ${subscriber.phoneNumber}: ${result.messageId}`);
      } catch (error: any) {
        console.error(`❌ Failed to send to ${subscriber.phoneNumber}:`, error.message);
        errors.push({
          phoneNumber: subscriber.phoneNumber,
          error: error.message,
        });

        // Store failed message (non-blocking - best effort logging)
        if (broadcastId) {
          try {
            await prisma.message.create({
              data: {
                phoneNumber: subscriber.phoneNumber,
                content: processedMessage,
                direction: 'OUTBOUND',
                broadcastId: broadcastId,
                deliveryStatus: 'FAILED',
              },
            });
          } catch (dbError) {
            console.error(`⚠️  Failed to log failed message for ${subscriber.phoneNumber}:`, dbError);
            // Don't throw - we're already handling a failure
          }
        }
      }
    }

    // Log broadcast completion
    console.log(`📊 Broadcast completed: ${results.length} sent, ${errors.length} failed`);

    // Return summary
    return NextResponse.json({
      success: true,
      broadcastId: broadcast?.id || null,
      campaignName: broadcast?.name || null,
      sentTo: results.length,
      failed: errors.length,
      totalCost: totalCost.toFixed(2),
      segmentCount: costCalculator.calculateSegments(body.message),
      linksTracked: links.length,
      targetAll: effectiveTargetAll,
      targetedLists: effectiveTargetAll ? null : targetListIds.length,
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