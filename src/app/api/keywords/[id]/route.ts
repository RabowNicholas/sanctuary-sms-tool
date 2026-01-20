import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSignupKeywordRepository } from '@/infrastructure/database/repositories/PrismaSignupKeywordRepository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = new PrismaClient();
  const { id } = await params;

  try {
    const keyword = await prisma.signupKeyword.findUnique({
      where: { id },
      include: {
        list: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!keyword) {
      return NextResponse.json(
        { error: 'Keyword not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(keyword);
  } catch (error) {
    console.error('Get keyword error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keyword' },
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
  const keywordRepo = new PrismaSignupKeywordRepository(prisma);
  const { id } = await params;

  try {
    const body = await request.json();
    const { keyword: newKeyword, autoResponse, isActive, listId } = body;

    // Check if keyword exists
    const existingKeyword = await keywordRepo.findById(id);
    if (!existingKeyword) {
      return NextResponse.json(
        { error: 'Keyword not found' },
        { status: 404 }
      );
    }

    // Update fields if provided
    if (newKeyword !== undefined) {
      const normalizedKeyword = newKeyword.trim().toUpperCase();

      // Check if new keyword already exists (and isn't this one)
      const keywordCheck = await keywordRepo.findByKeyword(normalizedKeyword);
      if (keywordCheck && keywordCheck.id !== id) {
        return NextResponse.json(
          { error: 'Keyword already exists' },
          { status: 409 }
        );
      }

      existingKeyword.keyword = normalizedKeyword;
    }

    if (autoResponse !== undefined) {
      existingKeyword.setAutoResponse(autoResponse.trim());
    }

    if (isActive !== undefined) {
      if (isActive) {
        existingKeyword.activate();
      } else {
        existingKeyword.deactivate();
      }
    }

    if (listId !== undefined) {
      // Validate list exists if provided (listId can be null to remove list)
      if (listId !== null) {
        const list = await prisma.subscriberList.findUnique({
          where: { id: listId },
        });
        if (!list) {
          return NextResponse.json(
            { error: 'List not found' },
            { status: 400 }
          );
        }
      }
      existingKeyword.setListId(listId);
    }

    await keywordRepo.update(existingKeyword);

    // Fetch the updated keyword with its list relation
    const result = await prisma.signupKeyword.findUnique({
      where: { id },
      include: {
        list: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Update keyword error:', error);
    return NextResponse.json(
      { error: 'Failed to update keyword' },
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
  const keywordRepo = new PrismaSignupKeywordRepository(prisma);
  const { id } = await params;

  try {
    // Check if keyword exists
    const existingKeyword = await keywordRepo.findById(id);
    if (!existingKeyword) {
      return NextResponse.json(
        { error: 'Keyword not found' },
        { status: 404 }
      );
    }

    await keywordRepo.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete keyword error:', error);
    return NextResponse.json(
      { error: 'Failed to delete keyword' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
