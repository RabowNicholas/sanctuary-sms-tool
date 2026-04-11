import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSuppressionRepository } from '@/infrastructure/database/repositories/PrismaSuppressionRepository';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prisma = new PrismaClient();
  try {
    const { id } = await params;

    const suppressionRepo = new PrismaSuppressionRepository(prisma);
    await suppressionRepo.remove(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }
    console.error('Suppression DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove suppression entry' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
