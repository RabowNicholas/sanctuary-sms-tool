import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, SuppressionReason } from '@/generated/prisma';
import { PrismaSuppressionRepository } from '@/infrastructure/database/repositories/PrismaSuppressionRepository';
import { Subscriber } from '@/domain/entities/Subscriber';

const VALID_REASONS: SuppressionReason[] = ['OPTED_OUT', 'UNREACHABLE', 'NONEXISTENT'];

interface BulkEntry {
  phoneNumber: string;
  reason: SuppressionReason;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prisma = new PrismaClient();
  try {
    const { entries } = await request.json();

    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: 'entries must be an array' }, { status: 400 });
    }
    if (entries.length === 0) {
      return NextResponse.json({ error: 'At least one entry is required' }, { status: 400 });
    }
    if (entries.length > 5000) {
      return NextResponse.json({ error: 'Maximum 5000 entries per import' }, { status: 400 });
    }

    const suppressionRepo = new PrismaSuppressionRepository(prisma);

    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const entry of entries as BulkEntry[]) {
      const { phoneNumber, reason } = entry;

      if (!phoneNumber || typeof phoneNumber !== 'string') {
        errors.push(`Missing phoneNumber in entry: ${JSON.stringify(entry)}`);
        continue;
      }
      if (!Subscriber.isValidPhoneNumber(phoneNumber)) {
        errors.push(`Invalid format: ${phoneNumber}`);
        continue;
      }
      if (!reason || !VALID_REASONS.includes(reason)) {
        errors.push(`Invalid reason "${reason}" for ${phoneNumber}. Must be: ${VALID_REASONS.join(', ')}`);
        continue;
      }

      try {
        const wasAlreadySuppressed = await suppressionRepo.isSuppressed(phoneNumber);
        await suppressionRepo.addEntry(phoneNumber, reason);
        if (wasAlreadySuppressed) {
          skipped++;
        } else {
          added++;
        }
      } catch (err: any) {
        errors.push(`Failed to add ${phoneNumber}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      added,
      skipped,
      errors: errors.slice(0, 20),
      total: entries.length,
    });
  } catch (error) {
    console.error('Suppression bulk import error:', error);
    return NextResponse.json({ error: 'Failed to bulk import suppression list' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
