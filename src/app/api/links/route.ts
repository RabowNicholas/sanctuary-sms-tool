import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { LinkShortener } from '@/infrastructure/utils/LinkShortener';

function getBaseUrl(): string {
  // Prefer the canonical domain (NEXTAUTH_URL) over VERCEL_URL, which is the
  // deployment-specific hostname and breaks on the next deploy.
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = new PrismaClient();
  try {
    const links = await prisma.link.findMany({
      where: { broadcastId: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalUrl: true,
        shortCode: true,
        createdAt: true,
        _count: { select: { clicks: true } },
      },
    });

    const baseUrl = getBaseUrl();
    return NextResponse.json(
      links.map((l) => ({
        id: l.id,
        originalUrl: l.originalUrl,
        shortCode: l.shortCode,
        trackingUrl: `${baseUrl}/rd/${l.shortCode}`,
        createdAt: l.createdAt.toISOString(),
        clickCount: l._count.clicks,
      }))
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json(
      { error: 'URL must start with http:// or https://' },
      { status: 400 }
    );
  }

  const prisma = new PrismaClient();
  try {
    const shortener = new LinkShortener(prisma, getBaseUrl());
    const link = await shortener.createStandaloneLink(url);

    const row = await prisma.link.findUnique({
      where: { shortCode: link.shortCode },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({
      id: row!.id,
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      trackingUrl: link.trackingUrl,
      createdAt: row!.createdAt.toISOString(),
      clickCount: 0,
    });
  } catch (error: any) {
    console.error('Failed to create link:', error);
    return NextResponse.json(
      { error: 'Failed to create link' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
