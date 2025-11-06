import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { Subscriber } from '@/domain/entities/Subscriber';

export async function POST(request: NextRequest) {
  const prisma = new PrismaClient();

  try {
    const { phoneNumbers } = await request.json();

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

    const results = {
      added: 0,
      skipped: 0,
      errors: [] as string[],
    };

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
      } catch (error: any) {
        results.errors.push(`Failed to add ${phoneNumber}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      total: phoneNumbers.length,
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