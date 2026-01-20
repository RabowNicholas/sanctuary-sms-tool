import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSubscriberListRepository } from '@/infrastructure/database/repositories/PrismaSubscriberListRepository';
import { SubscriberList } from '@/domain/entities/SubscriberList';

export async function GET() {
  const prisma = new PrismaClient();

  try {
    const lists = await prisma.subscriberList.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { subscribers: true },
        },
        keywords: {
          select: {
            id: true,
            keyword: true,
          },
        },
      },
    });

    // Transform to include memberCount at top level
    const result = lists.map(list => ({
      id: list.id,
      name: list.name,
      description: list.description,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      memberCount: list._count.subscribers,
      keywords: list.keywords,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get lists error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lists' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  const prisma = new PrismaClient();
  const listRepo = new PrismaSubscriberListRepository(prisma);

  try {
    const { name, description } = await request.json();

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'List name is required' },
        { status: 400 }
      );
    }

    // Check if list name already exists
    const existingList = await listRepo.findByName(name.trim());
    if (existingList) {
      return NextResponse.json(
        { error: 'List name already exists' },
        { status: 409 }
      );
    }

    // Create new list using domain entity
    const newList = SubscriberList.create(name.trim(), description?.trim());
    const createdList = await listRepo.add(newList);

    // Fetch the created list with full data
    const result = await prisma.subscriberList.findUnique({
      where: { id: createdList.id },
      include: {
        _count: {
          select: { subscribers: true },
        },
        keywords: {
          select: {
            id: true,
            keyword: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: result!.id,
      name: result!.name,
      description: result!.description,
      createdAt: result!.createdAt,
      updatedAt: result!.updatedAt,
      memberCount: result!._count.subscribers,
      keywords: result!.keywords,
    }, { status: 201 });
  } catch (error) {
    console.error('Create list error:', error);
    return NextResponse.json(
      { error: 'Failed to create list' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
