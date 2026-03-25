import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

export interface ListBreakdown {
  listId: string;
  listName: string;
  type: 'include' | 'exclude';
  memberCount: number;
  clicks: number;
  uniqueClickers: number;
  replies: number;
}

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
  targetAll: boolean;
  listBreakdown: ListBreakdown[];
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
      // Get all broadcasts with targets
      const broadcasts = await prisma.broadcast.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          messages: {
            select: {
              deliveryStatus: true,
              phoneNumber: true,
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
          targets: {
            include: {
              list: {
                select: {
                  id: true,
                  name: true,
                  subscribers: {
                    where: { archivedAt: null },
                    select: { subscriberId: true },
                  },
                },
              },
            },
          },
        },
      });

      // Calculate analytics for each broadcast
      const analytics: BroadcastAnalytics[] = await Promise.all(
        broadcasts.map(async (broadcast) => {
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

          // Build per-list breakdown (only for non-targetAll broadcasts)
          let listBreakdown: ListBreakdown[] = [];

          if (!broadcast.targetAll && broadcast.targets.length > 0) {
            listBreakdown = await Promise.all(
              broadcast.targets.map(async (target) => {
                const memberIds = target.list.subscribers.map(s => s.subscriberId);

                if (target.type === 'exclude') {
                  return {
                    listId: target.list.id,
                    listName: target.list.name,
                    type: 'exclude' as const,
                    memberCount: memberIds.length,
                    clicks: 0,
                    uniqueClickers: 0,
                    replies: 0,
                  };
                }

                // For include lists: compute engagement metrics
                const [listClicks, listReplies] = await Promise.all([
                  prisma.linkClick.findMany({
                    where: {
                      subscriberId: { in: memberIds },
                      link: { broadcastId: broadcast.id },
                    },
                    select: { subscriberId: true },
                  }),
                  prisma.message.findMany({
                    where: {
                      broadcastId: broadcast.id,
                      direction: 'INBOUND',
                      phoneNumber: {
                        in: broadcast.messages
                          .filter(m => memberIds.includes(m.phoneNumber))
                          .map(m => m.phoneNumber),
                      },
                    },
                    select: { id: true },
                  }),
                ]);

                const listUniqueClickers = new Set(
                  listClicks.filter(c => c.subscriberId).map(c => c.subscriberId)
                ).size;

                return {
                  listId: target.list.id,
                  listName: target.list.name,
                  type: 'include' as const,
                  memberCount: memberIds.length,
                  clicks: listClicks.length,
                  uniqueClickers: listUniqueClickers,
                  replies: listReplies.length,
                };
              })
            );
          }

          return {
            id: broadcast.id,
            name: broadcast.name,
            message: broadcast.message,
            sentCount: broadcast.sentCount,
            deliveredCount,
            failedCount,
            deliveryRate: Math.round(deliveryRate * 10) / 10,
            totalClicks,
            uniqueClickers,
            clickThroughRate: Math.round(clickThroughRate * 10) / 10,
            totalCost: broadcast.totalCost,
            createdAt: broadcast.createdAt.toISOString(),
            targetAll: broadcast.targetAll,
            listBreakdown,
          };
        })
      );

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
