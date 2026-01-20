import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSubscriberListRepository } from '@/infrastructure/database/repositories/PrismaSubscriberListRepository';
import { Subscriber } from '@/domain/entities/Subscriber';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = new PrismaClient();
  const listRepo = new PrismaSubscriberListRepository(prisma);
  const { id } = await params;

  try {
    // Check if list exists
    const list = await listRepo.findById(id);
    if (!list) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    // Get members with full subscriber info
    const memberships = await prisma.subscriberListMembership.findMany({
      where: { listId: id },
      include: {
        subscriber: {
          select: {
            id: true,
            phoneNumber: true,
            isActive: true,
            joinedAt: true,
            joinedViaKeyword: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const members = memberships.map(m => ({
      subscriberId: m.subscriber.id,
      phoneNumber: m.subscriber.phoneNumber,
      formattedPhoneNumber: Subscriber.formatPhoneNumber(m.subscriber.phoneNumber),
      isActive: m.subscriber.isActive,
      subscriberJoinedAt: m.subscriber.joinedAt,
      joinedViaKeyword: m.subscriber.joinedViaKeyword,
      listJoinedAt: m.joinedAt,
      listJoinedVia: m.joinedVia,
    }));

    return NextResponse.json({
      listId: id,
      listName: list.name,
      memberCount: members.length,
      members,
    });
  } catch (error) {
    console.error('Get list members error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch list members' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = new PrismaClient();
  const listRepo = new PrismaSubscriberListRepository(prisma);
  const { id } = await params;

  try {
    const body = await request.json();
    const { subscriberId, subscriberIds } = body;

    // Check if list exists
    const list = await listRepo.findById(id);
    if (!list) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    // Support both single subscriber and bulk add
    const idsToAdd = subscriberIds || (subscriberId ? [subscriberId] : []);

    if (idsToAdd.length === 0) {
      return NextResponse.json(
        { error: 'subscriberId or subscriberIds is required' },
        { status: 400 }
      );
    }

    // Verify all subscribers exist
    const existingSubscribers = await prisma.subscriber.findMany({
      where: { id: { in: idsToAdd } },
      select: { id: true },
    });

    const existingIds = new Set(existingSubscribers.map(s => s.id));
    const invalidIds = idsToAdd.filter((sid: string) => !existingIds.has(sid));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Subscribers not found: ${invalidIds.join(', ')}` },
        { status: 400 }
      );
    }

    // Add members
    let added = 0;
    let skipped = 0;

    for (const sid of idsToAdd) {
      try {
        await listRepo.addMember(id, sid, 'manual');
        added++;
      } catch (error) {
        // Likely a duplicate
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      added,
      skipped,
      message: `Added ${added} member(s)${skipped > 0 ? `, ${skipped} already in list` : ''}`,
    });
  } catch (error) {
    console.error('Add list members error:', error);
    return NextResponse.json(
      { error: 'Failed to add members to list' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = new PrismaClient();
  const listRepo = new PrismaSubscriberListRepository(prisma);
  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const subscriberId = searchParams.get('subscriberId');

    if (!subscriberId) {
      return NextResponse.json(
        { error: 'subscriberId query parameter is required' },
        { status: 400 }
      );
    }

    // Check if list exists
    const list = await listRepo.findById(id);
    if (!list) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    await listRepo.removeMember(id, subscriberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove list member error:', error);
    return NextResponse.json(
      { error: 'Failed to remove member from list' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
