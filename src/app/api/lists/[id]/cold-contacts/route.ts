import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since');

  if (!since) {
    return NextResponse.json({ error: 'since query parameter (YYYY-MM-DD) is required' }, { status: 400 });
  }

  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
  }

  const prisma = new PrismaClient();

  try {
    // Get all active memberships for this list
    const memberships = await prisma.subscriberListMembership.findMany({
      where: { listId: id, archivedAt: null },
      include: {
        subscriber: {
          select: {
            id: true,
            phoneNumber: true,
            joinedAt: true,
          },
        },
      },
    });

    if (memberships.length === 0) {
      await prisma.$disconnect();
      return NextResponse.json({ contacts: [] });
    }

    const subscriberIds = memberships.map(m => m.subscriber.id);
    const phoneNumbers = memberships.map(m => m.subscriber.phoneNumber);

    // Find subscribers with any engagement since the date
    const [activeClickers, activeRepliers, activePurchasers] = await Promise.all([
      prisma.linkClick.findMany({
        where: { subscriberId: { in: subscriberIds }, clickedAt: { gte: sinceDate } },
        select: { subscriberId: true },
      }),
      prisma.message.findMany({
        where: {
          phoneNumber: { in: phoneNumbers },
          direction: 'INBOUND',
          createdAt: { gte: sinceDate },
        },
        select: { phoneNumber: true },
      }),
      prisma.purchase.findMany({
        where: { subscriberId: { in: subscriberIds }, purchasedAt: { gte: sinceDate } },
        select: { subscriberId: true },
      }),
    ]);

    const engagedSubscriberIds = new Set([
      ...activeClickers.map(c => c.subscriberId).filter(Boolean) as string[],
      ...activePurchasers.map(p => p.subscriberId).filter(Boolean) as string[],
    ]);
    const engagedPhones = new Set(activeRepliers.map(m => m.phoneNumber));

    // Get last engagement timestamps for cold subscribers
    const coldMemberships = memberships.filter(m => {
      const isEngaged = engagedSubscriberIds.has(m.subscriber.id) || engagedPhones.has(m.subscriber.phoneNumber);
      return !isEngaged;
    });

    // For each cold subscriber, find their most recent engagement ever
    const contactsWithLastEngagement = await Promise.all(
      coldMemberships.map(async m => {
        const [lastClick, lastReply, lastPurchase] = await Promise.all([
          prisma.linkClick.findFirst({
            where: { subscriberId: m.subscriber.id },
            orderBy: { clickedAt: 'desc' },
            select: { clickedAt: true },
          }),
          prisma.message.findFirst({
            where: { phoneNumber: m.subscriber.phoneNumber, direction: 'INBOUND' },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
          prisma.purchase.findFirst({
            where: { subscriberId: m.subscriber.id },
            orderBy: { purchasedAt: 'desc' },
            select: { purchasedAt: true },
          }),
        ]);

        const timestamps = [
          lastClick?.clickedAt,
          lastReply?.createdAt,
          lastPurchase?.purchasedAt,
        ].filter(Boolean) as Date[];

        const lastEngagedAt = timestamps.length > 0
          ? new Date(Math.max(...timestamps.map(t => t.getTime()))).toISOString()
          : null;

        return {
          subscriberId: m.subscriber.id,
          phoneNumber: m.subscriber.phoneNumber,
          joinedAt: m.joinedAt.toISOString(),
          lastEngagedAt,
        };
      })
    );

    await prisma.$disconnect();
    return NextResponse.json({ contacts: contactsWithLastEngagement });
  } catch (error) {
    console.error('Cold contacts error:', error);
    await prisma.$disconnect();
    return NextResponse.json({ error: 'Failed to fetch cold contacts' }, { status: 500 });
  }
}
