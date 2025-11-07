import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@/generated/prisma';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: subscriberId } = await params;

    const prisma = new PrismaClient();

    try {
      // Verify subscriber exists
      const subscriber = await prisma.subscriber.findUnique({
        where: { id: subscriberId },
      });

      if (!subscriber) {
        await prisma.$disconnect();
        return NextResponse.json(
          { error: 'Subscriber not found' },
          { status: 404 }
        );
      }

      // Set lastReadAt to null to mark as unread
      const updated = await prisma.subscriber.update({
        where: { id: subscriberId },
        data: {
          lastReadAt: null,
        },
      });

      await prisma.$disconnect();

      return NextResponse.json({
        success: true,
        lastReadAt: updated.lastReadAt,
      });
    } catch (error: any) {
      console.error('Database error:', error);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: 'Failed to mark conversation as unread' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Mark-unread API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
