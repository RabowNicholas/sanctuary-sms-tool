import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { PrismaSignupKeywordRepository } from '@/infrastructure/database/repositories/PrismaSignupKeywordRepository';
import { SignupKeyword } from '@/domain/entities/SignupKeyword';

export async function GET() {
  const prisma = new PrismaClient();

  try {
    const keywords = await prisma.signupKeyword.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        list: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(keywords);
  } catch (error) {
    console.error('Get keywords error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keywords' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  const prisma = new PrismaClient();
  const keywordRepo = new PrismaSignupKeywordRepository(prisma);

  try {
    const { keyword, autoResponse, listId } = await request.json();

    // Validate required fields
    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return NextResponse.json(
        { error: 'Keyword is required' },
        { status: 400 }
      );
    }

    if (!autoResponse || typeof autoResponse !== 'string' || !autoResponse.trim()) {
      return NextResponse.json(
        { error: 'Auto response message is required' },
        { status: 400 }
      );
    }

    // Normalize keyword to uppercase
    const normalizedKeyword = keyword.trim().toUpperCase();

    // Check if keyword already exists
    const existingKeyword = await keywordRepo.findByKeyword(normalizedKeyword);
    if (existingKeyword) {
      return NextResponse.json(
        { error: 'Keyword already exists' },
        { status: 409 }
      );
    }

    // Validate list exists if provided
    if (listId) {
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

    // Create new keyword using domain entity
    const newKeyword = SignupKeyword.create(normalizedKeyword, autoResponse.trim(), listId || undefined);
    const createdKeyword = await keywordRepo.add(newKeyword);

    // Fetch the created keyword with its list relation
    const result = await prisma.signupKeyword.findUnique({
      where: { id: createdKeyword.id },
      include: {
        list: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Create keyword error:', error);
    return NextResponse.json(
      { error: 'Failed to create keyword' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
