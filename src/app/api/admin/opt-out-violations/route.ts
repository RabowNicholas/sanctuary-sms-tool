import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSuppressionRepository } from '@/infrastructure/database/repositories/PrismaSuppressionRepository';

export interface ViolationRecord {
  phoneNumber: string;
  firstOptOut: string;
  messagesAfter: number;
  dates: string[];
}

/**
 * GET /api/admin/opt-out-violations
 * Find all contacts who received outbound messages AFTER their first 21610 (opt-out) error.
 *
 * NOTE: This requires the errorCode field on messages to have been populated by the
 * delivery-status webhook. Historic data before the webhook update won't have errorCode set,
 * so this report grows more accurate over time as new delivery events come in.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prisma = new PrismaClient();
  try {
    // Find all messages that resulted in a 21610 error (opted out)
    const optOutMessages = await prisma.message.findMany({
      where: { errorCode: '21610' },
      select: { phoneNumber: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    if (optOutMessages.length === 0) {
      return NextResponse.json({ violations: [] });
    }

    // Find the earliest opt-out timestamp per phone number
    const firstOptOut = new Map<string, Date>();
    for (const msg of optOutMessages) {
      const existing = firstOptOut.get(msg.phoneNumber);
      if (!existing || msg.createdAt < existing) {
        firstOptOut.set(msg.phoneNumber, msg.createdAt);
      }
    }

    const violations: ViolationRecord[] = [];

    for (const [phoneNumber, optOutDate] of firstOptOut.entries()) {
      // Find outbound messages sent AFTER the first opt-out
      const messagesAfterOptOut = await prisma.message.findMany({
        where: {
          phoneNumber,
          direction: 'OUTBOUND',
          createdAt: { gt: optOutDate },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      if (messagesAfterOptOut.length > 0) {
        violations.push({
          phoneNumber,
          firstOptOut: optOutDate.toISOString(),
          messagesAfter: messagesAfterOptOut.length,
          dates: messagesAfterOptOut.map(m => m.createdAt.toISOString()),
        });
      }
    }

    // Sort by most violations first
    violations.sort((a, b) => b.messagesAfter - a.messagesAfter);

    return NextResponse.json({ violations });
  } catch (error) {
    console.error('Opt-out violations GET error:', error);
    return NextResponse.json({ error: 'Failed to load violation report' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/admin/opt-out-violations
 * Seed the suppression list with all opt-out violators.
 *
 * Accepts ?dryRun=true to preview what would be added without writing anything.
 * Safe to call multiple times — addEntry is an upsert and preserves original addedAt.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') === 'true';

  const prisma = new PrismaClient();
  try {
    // Fetch all unique phone numbers that ever received a 21610
    const optOutNumbers = await prisma.message.findMany({
      where: { errorCode: '21610' },
      select: { phoneNumber: true },
      distinct: ['phoneNumber'],
    });

    const suppressionRepo = new PrismaSuppressionRepository(prisma);

    // Determine which are genuinely new (not yet suppressed)
    const newNumbers: string[] = [];
    for (const { phoneNumber } of optOutNumbers) {
      const alreadySuppressed = await suppressionRepo.isSuppressed(phoneNumber);
      if (!alreadySuppressed) {
        newNumbers.push(phoneNumber);
      }
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        wouldAdd: newNumbers.length,
        alreadySuppressed: optOutNumbers.length - newNumbers.length,
        total: optOutNumbers.length,
      });
    }

    // Write only the genuinely new entries so the "added" count is accurate
    for (const phoneNumber of newNumbers) {
      await suppressionRepo.addEntry(phoneNumber, 'OPTED_OUT');
    }

    console.log(`✅ Opt-out fix: added ${newNumbers.length} new numbers to suppression list (${optOutNumbers.length - newNumbers.length} already existed)`);

    return NextResponse.json({
      success: true,
      added: newNumbers.length,
      alreadySuppressed: optOutNumbers.length - newNumbers.length,
      total: optOutNumbers.length,
    });
  } catch (error) {
    console.error('Opt-out violations POST error:', error);
    return NextResponse.json({ error: 'Failed to seed suppression list' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
