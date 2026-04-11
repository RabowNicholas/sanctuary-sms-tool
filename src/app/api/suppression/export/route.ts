import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSuppressionRepository } from '@/infrastructure/database/repositories/PrismaSuppressionRepository';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prisma = new PrismaClient();
  try {
    const suppressionRepo = new PrismaSuppressionRepository(prisma);
    const entries = await suppressionRepo.findAll();

    const rows = [
      'phone_number,reason,added_at',
      ...entries.map(e =>
        `${e.phoneNumber},${e.reason},${e.addedAt.toISOString()}`
      ),
    ];

    const csv = rows.join('\n');
    const date = new Date().toISOString().split('T')[0];

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="suppression-list-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error('Suppression export error:', error);
    return NextResponse.json({ error: 'Failed to export suppression list' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
