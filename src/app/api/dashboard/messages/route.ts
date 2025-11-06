import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

export async function GET(request: NextRequest) {
  const prisma = new PrismaClient();
  
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const messages = await prisma.message.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(limit, 100), // Cap at 100 for performance
      skip: offset,
      select: {
        id: true,
        phoneNumber: true,
        content: true,
        direction: true,
        createdAt: true,
      },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Dashboard messages error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}