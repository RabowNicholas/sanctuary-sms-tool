import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { LinkShortener } from '@/infrastructure/utils/LinkShortener';

interface RouteParams {
  params: Promise<{
    code: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const prisma = new PrismaClient();

  try {
    const { code: shortCode } = await params;

    console.log(`🔗 Click tracking: ${shortCode}`);

    // Get base URL for LinkShortener
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.NEXTAUTH_URL || 'http://localhost:3000');

    const linkShortener = new LinkShortener(prisma, baseUrl);

    // Get original URL
    const originalUrl = await linkShortener.getOriginalUrl(shortCode);

    if (!originalUrl) {
      console.warn(`⚠️  Link not found: ${shortCode}`);
      await prisma.$disconnect();

      // Return a 404 page
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Link Not Found</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
              }
              h1 {
                font-size: 3rem;
                margin: 0 0 1rem 0;
              }
              p {
                font-size: 1.25rem;
                opacity: 0.9;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🔗 Link Not Found</h1>
              <p>This link is invalid or has expired.</p>
            </div>
          </body>
        </html>
        `,
        {
          status: 404,
          headers: {
            'Content-Type': 'text/html',
          },
        }
      );
    }

    // Try to identify the subscriber from query params or cookies
    const subscriberId = request.nextUrl.searchParams.get('sid') || undefined;

    // Record the click
    try {
      await linkShortener.recordClick(shortCode, subscriberId);
      console.log(`✅ Click recorded for ${shortCode}${subscriberId ? ` (subscriber: ${subscriberId})` : ''}`);
    } catch (error) {
      console.error(`❌ Failed to record click:`, error);
      // Continue with redirect even if click recording fails
    }

    await prisma.$disconnect();

    // Redirect to original URL with 308 (permanent redirect for tracking)
    return NextResponse.redirect(originalUrl, 308);

  } catch (error: any) {
    console.error('Click tracking error:', error);
    await prisma.$disconnect();

    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
