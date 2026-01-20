import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // all, unread, read
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const prisma = new PrismaClient();

    try {
      // Build where clause based on filters
      const where: any = {
        isActive: true, // Only show active subscribers
      };

      // Apply search filter
      if (search) {
        where.phoneNumber = {
          contains: search,
        };
      }

      // Get all matching subscribers with their messages
      const subscribers = await prisma.subscriber.findMany({
        where,
        include: {
          messages: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1, // Get only the latest message for preview
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      // Filter based on read/unread status and add computed fields
      let conversations = subscribers
        .map((subscriber) => {
          const lastMessage = subscriber.messages[0];
          const hasUnread = lastMessage && lastMessage.direction === 'INBOUND' &&
            (!subscriber.lastReadAt || new Date(lastMessage.createdAt) > new Date(subscriber.lastReadAt));

          return {
            id: subscriber.id,
            phoneNumber: subscriber.phoneNumber,
            formattedPhoneNumber: formatPhoneNumber(subscriber.phoneNumber),
            isActive: subscriber.isActive,
            joinedAt: subscriber.joinedAt,
            lastReadAt: subscriber.lastReadAt,
            hasUnread,
            lastMessage: lastMessage ? {
              id: lastMessage.id,
              content: lastMessage.content,
              direction: lastMessage.direction,
              createdAt: lastMessage.createdAt,
            } : null,
          };
        })
        .filter((conv) => {
          // Filter by read status
          if (filter === 'unread') return conv.hasUnread;
          if (filter === 'read') return !conv.hasUnread;
          return true; // 'all'
        });

      // Apply pagination
      const total = conversations.length;
      conversations = conversations.slice(offset, offset + limit);

      await prisma.$disconnect();

      return NextResponse.json({
        conversations,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error: any) {
      console.error('Database error:', error);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Inbox API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to format phone numbers
function formatPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '');

  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.slice(1, 4);
    const centralOffice = cleaned.slice(4, 7);
    const station = cleaned.slice(7);
    return `+1 (${areaCode}) ${centralOffice}-${station}`;
  }

  if (cleaned.length === 10) {
    const areaCode = cleaned.slice(0, 3);
    const centralOffice = cleaned.slice(3, 6);
    const station = cleaned.slice(6);
    return `+1 (${areaCode}) ${centralOffice}-${station}`;
  }

  return phoneNumber;
}
