import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, SuppressionReason } from '@/generated/prisma';
import { PrismaSuppressionRepository } from '@/infrastructure/database/repositories/PrismaSuppressionRepository';
import { Subscriber } from '@/domain/entities/Subscriber';

const VALID_REASONS: SuppressionReason[] = ['OPTED_OUT', 'UNREACHABLE', 'NONEXISTENT'];

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prisma = new PrismaClient();
  try {
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason') as SuppressionReason | null;

    const suppressionRepo = new PrismaSuppressionRepository(prisma);
    const entries = await suppressionRepo.findAll(
      reason && VALID_REASONS.includes(reason) ? { reason } : undefined
    );
    const counts = await suppressionRepo.counts();

    return NextResponse.json({ entries, counts });
  } catch (error) {
    console.error('Suppression GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch suppression list' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prisma = new PrismaClient();
  try {
    const { phoneNumber, reason } = await request.json();

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });
    }
    if (!Subscriber.isValidPhoneNumber(phoneNumber)) {
      return NextResponse.json({ error: 'Invalid phone number format. Use +1XXXXXXXXXX' }, { status: 400 });
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: `reason must be one of: ${VALID_REASONS.join(', ')}` },
        { status: 400 }
      );
    }

    const suppressionRepo = new PrismaSuppressionRepository(prisma);
    await suppressionRepo.addEntry(phoneNumber, reason as SuppressionReason);

    return NextResponse.json({ success: true, phoneNumber, reason }, { status: 201 });
  } catch (error) {
    console.error('Suppression POST error:', error);
    return NextResponse.json({ error: 'Failed to add suppression entry' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
