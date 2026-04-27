import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const prisma = new PrismaClient();

  try {
    const link = await prisma.link.findUnique({
      where: { id },
      select: { id: true, broadcastId: true },
    });

    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }
    if (link.broadcastId !== null) {
      return NextResponse.json(
        { error: 'Cannot delete broadcast links from this endpoint' },
        { status: 400 }
      );
    }

    await prisma.link.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Failed to delete link:', error);
    return NextResponse.json(
      { error: 'Failed to delete link' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
