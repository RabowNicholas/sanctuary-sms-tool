import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const prisma = new PrismaClient();

  try {
    const { id: subscriberId } = await params;

    // Find subscriber
    const subscriber = await prisma.subscriber.findUnique({
      where: { id: subscriberId },
    });

    if (!subscriber) {
      return NextResponse.json(
        { error: 'Subscriber not found' },
        { status: 404 }
      );
    }

    // Fetch all messages for this subscriber
    const messages = await prisma.message.findMany({
      where: {
        phoneNumber: subscriber.phoneNumber,
      },
      orderBy: {
        createdAt: 'asc', // Chronological order for conversation view
      },
    });

    return NextResponse.json({
      subscriber: {
        id: subscriber.id,
        phoneNumber: subscriber.phoneNumber,
        isActive: subscriber.isActive,
        joinedAt: subscriber.joinedAt,
      },
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        direction: msg.direction,
        createdAt: msg.createdAt,
      })),
    });

  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
