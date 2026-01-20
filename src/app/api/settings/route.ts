import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { PrismaAppConfigRepository } from '@/infrastructure/database/repositories/PrismaAppConfigRepository';

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = new PrismaClient();
    const repo = new PrismaAppConfigRepository(prisma);

    try {
      const config = await repo.getConfig();
      await prisma.$disconnect();

      return NextResponse.json({
        welcomeMessage: config?.welcomeMessage || 'Welcome to SANCTUARY!',
      });
    } catch (error: any) {
      console.error('Database error:', error);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Settings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { welcomeMessage } = body;

    // Validation
    if (!welcomeMessage || typeof welcomeMessage !== 'string') {
      return NextResponse.json(
        { error: 'Welcome message is required' },
        { status: 400 }
      );
    }

    if (welcomeMessage.trim().length === 0) {
      return NextResponse.json(
        { error: 'Welcome message cannot be empty' },
        { status: 400 }
      );
    }

    if (welcomeMessage.length > 320) {
      return NextResponse.json(
        { error: 'Welcome message too long (max 320 characters)' },
        { status: 400 }
      );
    }

    const prisma = new PrismaClient();
    const repo = new PrismaAppConfigRepository(prisma);

    try {
      await repo.updateWelcomeMessage(welcomeMessage.trim());
      await prisma.$disconnect();

      return NextResponse.json({
        success: true,
        welcomeMessage: welcomeMessage.trim(),
      });
    } catch (error: any) {
      console.error('Database error:', error);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Settings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
