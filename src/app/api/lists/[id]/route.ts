import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSubscriberListRepository } from '@/infrastructure/database/repositories/PrismaSubscriberListRepository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = new PrismaClient();
  const { id } = await params;

  try {
    const list = await prisma.subscriberList.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscribers: true },
        },
        keywords: {
          select: {
            id: true,
            keyword: true,
            isActive: true,
          },
        },
      },
    });

    if (!list) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: list.id,
      name: list.name,
      description: list.description,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      memberCount: list._count.subscribers,
      keywords: list.keywords,
    });
  } catch (error) {
    console.error('Get list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch list' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = new PrismaClient();
  const listRepo = new PrismaSubscriberListRepository(prisma);
  const { id } = await params;

  try {
    const body = await request.json();
    const { name, description } = body;

    // Check if list exists
    const existingList = await listRepo.findById(id);
    if (!existingList) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    // Update fields if provided
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: 'List name cannot be empty' },
          { status: 400 }
        );
      }

      // Check if new name already exists (and isn't this one)
      const nameCheck = await listRepo.findByName(trimmedName);
      if (nameCheck && nameCheck.id !== id) {
        return NextResponse.json(
          { error: 'List name already exists' },
          { status: 409 }
        );
      }

      existingList.setName(trimmedName);
    }

    if (description !== undefined) {
      existingList.setDescription(description);
    }

    await listRepo.update(existingList);

    // Fetch the updated list with full data
    const result = await prisma.subscriberList.findUnique({
      where: { id },
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
    });
  } catch (error) {
    console.error('Update list error:', error);
    return NextResponse.json(
      { error: 'Failed to update list' },
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
    // Check if list exists
    const existingList = await listRepo.findById(id);
    if (!existingList) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    // Check if any keywords are using this list
    const keywordsUsingList = await prisma.signupKeyword.count({
      where: { listId: id },
    });

    if (keywordsUsingList > 0) {
      return NextResponse.json(
        { error: `Cannot delete list: ${keywordsUsingList} keyword(s) are using this list` },
        { status: 400 }
      );
    }

    await listRepo.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete list error:', error);
    return NextResponse.json(
      { error: 'Failed to delete list' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
