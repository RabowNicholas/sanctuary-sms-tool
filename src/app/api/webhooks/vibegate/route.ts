import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.VIBEGATE_WEBHOOK_SECRET;

  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = new PrismaClient();

  try {
    const body = await request.json();
    const { event_id, event_name, attendee_phone, purchased_at, ...rest } = body;

    if (!event_id || !attendee_phone) {
      return NextResponse.json({ error: 'event_id and attendee_phone are required' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(attendee_phone);
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    // Find subscriber by phone
    const subscriber = await prisma.subscriber.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    // Create Purchase record
    await prisma.purchase.create({
      data: {
        subscriberId: subscriber?.id ?? null,
        phoneNumber: normalizedPhone,
        eventId: event_id,
        eventName: event_name ?? null,
        purchasedAt: purchased_at ? new Date(purchased_at) : new Date(),
        rawPayload: body,
      },
    });

    // Find or create the purchasers list for this event
    const listName = `${event_name ?? event_id} Purchasers`;
    const list = await prisma.subscriberList.upsert({
      where: { name: listName },
      create: {
        name: listName,
        description: `Auto-created from Vibegate purchases for event: ${event_name ?? event_id}`,
      },
      update: {},
    });

    // Add subscriber to list if found
    if (subscriber) {
      await prisma.subscriberListMembership.upsert({
        where: {
          subscriberId_listId: {
            subscriberId: subscriber.id,
            listId: list.id,
          },
        },
        create: {
          subscriberId: subscriber.id,
          listId: list.id,
          joinedVia: 'vibegate-purchase',
        },
        update: {},
      });
    }

    await prisma.$disconnect();

    return NextResponse.json({
      received: true,
      subscriberFound: !!subscriber,
      listName,
    });
  } catch (error) {
    console.error('Vibegate webhook error:', error);
    await prisma.$disconnect();
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
