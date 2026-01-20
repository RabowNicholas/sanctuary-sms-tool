import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

export interface BroadcastAnalytics {
  id: string;
  name: string | null;
  message: string;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  deliveryRate: number;
  totalClicks: number;
  uniqueClickers: number;
  clickThroughRate: number;
  totalCost: number;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = new PrismaClient();

    try {
      // Get all broadcasts
      const broadcasts = await prisma.broadcast.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          messages: {
            select: {
              deliveryStatus: true,
            },
          },
          links: {
            include: {
              clicks: {
                select: {
                  subscriberId: true,
                },
              },
            },
          },
        },
      });

      // Calculate analytics for each broadcast
      const analytics: BroadcastAnalytics[] = broadcasts.map((broadcast) => {
        // Count delivery statuses
        const deliveredCount = broadcast.messages.filter(
          (m) => m.deliveryStatus === 'DELIVERED'
        ).length;
        const failedCount = broadcast.messages.filter(
          (m) => m.deliveryStatus === 'FAILED' || m.deliveryStatus === 'UNDELIVERED'
        ).length;

        const deliveryRate =
          broadcast.sentCount > 0
            ? (deliveredCount / broadcast.sentCount) * 100
            : 0;

        // Count clicks
        const allClicks = broadcast.links.flatMap((link) => link.clicks);
        const totalClicks = allClicks.length;
        const uniqueClickers = new Set(
          allClicks.filter((c) => c.subscriberId).map((c) => c.subscriberId)
        ).size;

        // Calculate click-through rate based on delivered messages
        const clickThroughRate =
          deliveredCount > 0 ? (uniqueClickers / deliveredCount) * 100 : 0;

        return {
          id: broadcast.id,
          name: broadcast.name,
          message: broadcast.message,
          sentCount: broadcast.sentCount,
          deliveredCount,
          failedCount,
          deliveryRate: Math.round(deliveryRate * 10) / 10, // Round to 1 decimal
          totalClicks,
          uniqueClickers,
          clickThroughRate: Math.round(clickThroughRate * 10) / 10,
          totalCost: broadcast.totalCost,
          createdAt: broadcast.createdAt.toISOString(),
        };
      });

      await prisma.$disconnect();

      return NextResponse.json({ broadcasts: analytics });

    } catch (error: any) {
      console.error('Database error:', error);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: 'Failed to fetch analytics' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
