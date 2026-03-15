import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prisma = new PrismaClient();

  try {
    const { subscriberIds } = await request.json();

    if (!Array.isArray(subscriberIds) || subscriberIds.length === 0) {
      return NextResponse.json({ error: 'subscriberIds array is required' }, { status: 400 });
    }

    const result = await prisma.subscriberListMembership.updateMany({
      where: {
        listId: id,
        subscriberId: { in: subscriberIds },
        archivedAt: null,
      },
      data: { archivedAt: new Date() },
    });

    await prisma.$disconnect();
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error('Archive members error:', error);
    await prisma.$disconnect();
    return NextResponse.json({ error: 'Failed to archive members' }, { status: 500 });
  }
}
