import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { Subscriber } from '@/domain/entities/Subscriber';
import { PrismaSubscriberListRepository } from '@/infrastructure/database/repositories/PrismaSubscriberListRepository';

export async function POST(request: NextRequest) {
  const prisma = new PrismaClient();

  try {
    const { phoneNumbers, listId } = await request.json();

    if (!Array.isArray(phoneNumbers)) {
      return NextResponse.json(
        { error: 'phoneNumbers must be an array' },
        { status: 400 }
      );
    }

    if (phoneNumbers.length === 0) {
      return NextResponse.json(
        { error: 'At least one phone number is required' },
        { status: 400 }
      );
    }

    if (phoneNumbers.length > 5000) {
      return NextResponse.json(
        { error: 'Maximum 5000 phone numbers per import' },
        { status: 400 }
      );
    }

    // Validate list if provided
    let listName: string | undefined;
    if (listId) {
      const listRepo = new PrismaSubscriberListRepository(prisma);
      const list = await listRepo.findById(listId);
      if (!list) {
        return NextResponse.json(
          { error: 'List not found' },
          { status: 404 }
        );
      }
      listName = list.name;
    }

    const results = {
      added: 0,
      skipped: 0,
      errors: [] as string[],
    };

    const successfulSubscriberIds: string[] = [];

    // Process each phone number
    for (const phoneNumber of phoneNumbers) {
      try {
        // Validate format
        if (!Subscriber.isValidPhoneNumber(phoneNumber)) {
          results.errors.push(`Invalid format: ${phoneNumber}`);
          continue;
        }

        // Check if already exists
        const existing = await prisma.subscriber.findUnique({
          where: { phoneNumber },
        });

        if (existing) {
          results.skipped++;
          successfulSubscriberIds.push(existing.id);
          continue;
        }

        // Create new subscriber
        const newSubscriber = Subscriber.create(phoneNumber);

        await prisma.subscriber.create({
          data: {
            id: newSubscriber.id,
            phoneNumber: newSubscriber.phoneNumber,
            isActive: newSubscriber.isActive,
            joinedAt: newSubscriber.joinedAt,
          },
        });

        results.added++;
        successfulSubscriberIds.push(newSubscriber.id);
      } catch (error: any) {
        results.errors.push(`Failed to add ${phoneNumber}: ${error.message}`);
      }
    }

    // Add all successful subscribers to the list
    if (listId && successfulSubscriberIds.length > 0) {
      const listRepo = new PrismaSubscriberListRepository(prisma);
      for (const subscriberId of successfulSubscriberIds) {
        await listRepo.addMember(listId, subscriberId, 'bulk-import');
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      total: phoneNumbers.length,
      ...(listId && { addedToList: true, listName }),
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      { error: 'Failed to import subscribers' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
