import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSubscriberRepository } from '@/infrastructure/database/repositories/PrismaSubscriberRepository';
import { PrismaSuppressionRepository } from '@/infrastructure/database/repositories/PrismaSuppressionRepository';

interface PreflightRequest {
  targetAll?: boolean;
  targetListIds?: string[];
  excludeListIds?: string[];
}

interface PreflightResult {
  total: number;
  effective: number;
  suppressedCount: number;
  suppressedByReason: {
    optedOut: number;
    unreachable: number;
    nonexistent: number;
  };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prisma = new PrismaClient();
  try {
    const body: PreflightRequest = await request.json();

    const targetAll = body.targetAll !== false;
    const targetListIds: string[] = body.targetListIds || [];
    const excludeListIds: string[] = body.excludeListIds || [];

    const hasIncludes = !targetAll && targetListIds.length > 0;
    const hasExcludes = excludeListIds.length > 0;

    // Fetch targeted subscribers using same logic as broadcast route
    const subscriberRepo = new PrismaSubscriberRepository(prisma);
    let targetedSubscribers;

    if (hasIncludes && hasExcludes) {
      targetedSubscribers = await subscriberRepo.findActiveByListIdsExcluding(targetListIds, excludeListIds);
    } else if (hasIncludes) {
      targetedSubscribers = await subscriberRepo.findActiveByListIds(targetListIds);
    } else if (hasExcludes) {
      targetedSubscribers = await subscriberRepo.findAllActiveExcluding(excludeListIds);
    } else {
      targetedSubscribers = await subscriberRepo.findAllActive();
    }

    // Check suppression list
    const suppressionRepo = new PrismaSuppressionRepository(prisma);
    const allSuppressed = await suppressionRepo.findAll();
    const suppressedMap = new Map(allSuppressed.map(e => [e.phoneNumber, e.reason]));

    let optedOut = 0;
    let unreachable = 0;
    let nonexistent = 0;

    for (const subscriber of targetedSubscribers) {
      const reason = suppressedMap.get(subscriber.phoneNumber);
      if (reason === 'OPTED_OUT') optedOut++;
      else if (reason === 'UNREACHABLE') unreachable++;
      else if (reason === 'NONEXISTENT') nonexistent++;
    }

    const suppressedCount = optedOut + unreachable + nonexistent;
    const result: PreflightResult = {
      total: targetedSubscribers.length,
      effective: targetedSubscribers.length - suppressedCount,
      suppressedCount,
      suppressedByReason: { optedOut, unreachable, nonexistent },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Preflight error:', error);
    return NextResponse.json({ error: 'Failed to run preflight check' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
