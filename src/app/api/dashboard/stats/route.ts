import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

export async function GET() {
  const prisma = new PrismaClient();

  try {
    // Get current date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Run all queries in parallel
    const [
      totalSubscribers,
      activeSubscribers,
      totalMessages,
      todayMessages,
    ] = await Promise.all([
      prisma.subscriber.count(),
      prisma.subscriber.count({
        where: { isActive: true },
      }),
      prisma.message.count(),
      prisma.message.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
    ]);

    return NextResponse.json({
      totalSubscribers,
      activeSubscribers,
      totalMessages,
      todayMessages,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}