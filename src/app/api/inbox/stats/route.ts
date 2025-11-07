import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@/generated/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = new PrismaClient();

    try {
      // Get all active subscribers with their latest message
      const subscribers = await prisma.subscriber.findMany({
        where: {
          isActive: true,
        },
        include: {
          messages: {
            where: {
              direction: 'INBOUND',
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      // Count unread conversations
      const unreadCount = subscribers.filter((subscriber) => {
        const lastInboundMessage = subscriber.messages[0];
        if (!lastInboundMessage) return false;

        // Conversation is unread if there's an inbound message and either:
        // 1. lastReadAt is null (never read), OR
        // 2. lastReadAt is before the latest inbound message
        return (
          !subscriber.lastReadAt ||
          new Date(lastInboundMessage.createdAt) > new Date(subscriber.lastReadAt)
        );
      }).length;

      await prisma.$disconnect();

      return NextResponse.json({
        unreadCount,
        totalConversations: subscribers.length,
      });
    } catch (error: any) {
      console.error('Database error:', error);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: 'Failed to fetch inbox stats' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Inbox stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
