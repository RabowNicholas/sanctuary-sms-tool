import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { Subscriber } from '@/domain/entities/Subscriber';

export async function GET() {
  const prisma = new PrismaClient();

  try {
    const subscribers = await prisma.subscriber.findMany({
      orderBy: { joinedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return NextResponse.json(subscribers);
  } catch (error) {
    console.error('Get subscribers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscribers' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  const prisma = new PrismaClient();

  try {
    const { phoneNumber } = await request.json();

    // Validate phone number
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate format using domain entity
    if (!Subscriber.isValidPhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use +1XXXXXXXXXX for US numbers.' },
        { status: 400 }
      );
    }

    // Check if subscriber already exists
    const existingSubscriber = await prisma.subscriber.findUnique({
      where: { phoneNumber },
    });

    if (existingSubscriber) {
      return NextResponse.json(
        { error: 'Subscriber already exists' },
        { status: 409 }
      );
    }

    // Create new subscriber using domain entity
    const newSubscriber = Subscriber.create(phoneNumber);

    const createdSubscriber = await prisma.subscriber.create({
      data: {
        id: newSubscriber.id,
        phoneNumber: newSubscriber.phoneNumber,
        isActive: newSubscriber.isActive,
        joinedAt: newSubscriber.joinedAt,
      },
    });

    return NextResponse.json(createdSubscriber, { status: 201 });
  } catch (error) {
    console.error('Create subscriber error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscriber' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}