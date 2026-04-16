import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { Subscriber } from '@/domain/entities/Subscriber';

export async function GET(request: NextRequest) {
  const prisma = new PrismaClient();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');

  try {
    const subscribers = await prisma.subscriber.findMany({
      where: search
        ? { phoneNumber: { contains: search }, isActive: true }
        : undefined,
      orderBy: { joinedAt: 'desc' },
      take: search ? 10 : undefined,
      include: {
        _count: {
          select: { messages: true },
        },
        listMemberships: {
          include: {
            list: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Transform to include lists at top level for easier access
    const result = subscribers.map(sub => ({
      ...sub,
      lists: sub.listMemberships.map(m => m.list),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get subscribers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscribers' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  const prisma = new PrismaClient();

  try {
    const { phoneNumber } = await request.json();

    // Validate phone number
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate format using domain entity
    if (!Subscriber.isValidPhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use +1XXXXXXXXXX for US numbers.' },
        { status: 400 }
      );
    }

    // Check if subscriber already exists
    const existingSubscriber = await prisma.subscriber.findUnique({
      where: { phoneNumber },
    });

    if (existingSubscriber) {
      return NextResponse.json(
        { error: 'Subscriber already exists' },
        { status: 409 }
      );
    }

    // Run Twilio Lookup to check line type (non-blocking, advisory only)
    let lookupWarning: string | null = null;
    let lineType: string | null = null;
    let carrierName: string | null = null;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const isRealCredentials = accountSid && !accountSid.startsWith('ACtest') && authToken && authToken !== 'test_token';

    if (isRealCredentials) {
      try {
        const twilio = require('twilio')(accountSid, authToken);

        const lookupPromise = twilio.lookups.v2
          .phoneNumbers(phoneNumber)
          .fetch({ fields: 'line_type_intelligence' });

        // Hard 5-second timeout — Lookup is advisory and must never block creation
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Twilio Lookup timeout (5s)')), 5000)
        );

        const lookup = await Promise.race([lookupPromise, timeoutPromise]);

        const lti = lookup.lineTypeIntelligence;
        if (lti) {
          lineType = lti.type || null;
          carrierName = lti.carrier_name || lti.carrierName || null;
          if (lineType && ['landline', 'voip', 'non-fixed-voip'].includes(lineType)) {
            lookupWarning = `Number appears to be a ${lineType}${carrierName ? ` (${carrierName})` : ''}. SMS delivery may fail.`;
          }
        }
      } catch (err: any) {
        // Lookup is non-blocking — log but don't fail the subscriber creation
        console.warn(`Twilio Lookup failed for ${phoneNumber} (non-blocking):`, err.message);
      }
    }

    // Create new subscriber using domain entity
    const newSubscriber = Subscriber.create(phoneNumber);

    const createdSubscriber = await prisma.subscriber.create({
      data: {
        id: newSubscriber.id,
        phoneNumber: newSubscriber.phoneNumber,
        isActive: newSubscriber.isActive,
        joinedAt: newSubscriber.joinedAt,
        lineType,
        carrierName,
      },
    });

    return NextResponse.json(
      { ...createdSubscriber, lookupWarning },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create subscriber error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscriber' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}