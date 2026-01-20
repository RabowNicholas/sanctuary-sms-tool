import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

export async function POST() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = new PrismaClient();

    try {
      // Update all subscribers' lastReadAt to current timestamp
      const result = await prisma.subscriber.updateMany({
        data: {
          lastReadAt: new Date(),
        },
      });

      await prisma.$disconnect();

      return NextResponse.json({
        success: true,
        updatedCount: result.count,
      });
    } catch (error: any) {
      console.error('Database error:', error);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: 'Failed to mark all conversations as read' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Mark-all-read API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
