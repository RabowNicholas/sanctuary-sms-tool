import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prisma = new PrismaClient();

  try {
    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
      select: { id: true, phoneNumber: true },
    });

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    // Fetch clicks
    const clicks = await prisma.linkClick.findMany({
      where: { subscriberId: id },
      include: {
        link: {
          include: {
            broadcast: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { clickedAt: 'desc' },
    });

    // Fetch inbound replies
    const replies = await prisma.message.findMany({
      where: { phoneNumber: subscriber.phoneNumber, direction: 'INBOUND' },
      include: {
        broadcast: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Merge and sort by timestamp descending
    type EngagementEvent =
      | { type: 'click'; timestamp: string; campaignName: string | null; campaignId: string | null; url: string }
      | { type: 'reply'; timestamp: string; content: string; campaignName: string | null; campaignId: string | null };

    const events: EngagementEvent[] = [
      ...clicks.map((c) => ({
        type: 'click' as const,
        timestamp: c.clickedAt.toISOString(),
        campaignName: c.link.broadcast?.name ?? null,
        campaignId: c.link.broadcast?.id ?? null,
        url: c.link.originalUrl,
      })),
      ...replies.map((m) => ({
        type: 'reply' as const,
        timestamp: m.createdAt.toISOString(),
        content: m.content,
        campaignName: m.broadcast?.name ?? null,
        campaignId: m.broadcast?.id ?? null,
      })),
    ];

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    await prisma.$disconnect();
    return NextResponse.json({ events });
  } catch (error) {
    console.error('Engagement history error:', error);
    await prisma.$disconnect();
    return NextResponse.json({ error: 'Failed to fetch engagement history' }, { status: 500 });
  }
}
