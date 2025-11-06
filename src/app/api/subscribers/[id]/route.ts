import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = new PrismaClient();

  try {
    const { isActive } = await request.json();
    const { id: subscriberId } = await params;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive must be a boolean' },
        { status: 400 }
      );
    }

    // Update subscriber status
    const updatedSubscriber = await prisma.subscriber.update({
      where: { id: subscriberId },
      data: { isActive },
    });

    return NextResponse.json(updatedSubscriber);
  } catch (error: any) {
    console.error('Update subscriber error:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Subscriber not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update subscriber' },
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

  try {
    const { id: subscriberId } = await params;

    // Delete subscriber (this will also delete related messages due to foreign key)
    await prisma.subscriber.delete({
      where: { id: subscriberId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete subscriber error:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Subscriber not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete subscriber' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}