import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { LinkShortener } from '@/infrastructure/utils/LinkShortener';
import { PrismaSubscriberListRepository } from '@/infrastructure/database/repositories/PrismaSubscriberListRepository';

const HOT_LIST_NAME = 'Hot Subscribers';
const HOT_LIST_DESCRIPTION = 'Auto-created: subscribers who clicked a link or replied to a broadcast';

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

    // Filter out carrier link scanners, iMessage/WhatsApp/Slack previewers,
    // and generic HTTP clients. These pre-fetch SMS URLs server-side and
    // would otherwise count as the subscriber clicking.
    const userAgent = request.headers.get('user-agent') || '';
    const isBot = !userAgent || /bot|crawler|spider|preview|scanner|fetch|monitor|facebookexternalhit|slackbot|discordbot|twitterbot|linkedin|whatsapp|telegram|applebot|google|bing|yahoo|duckduck|curl|wget|okhttp|python-requests|go-http|node-fetch|axios|java\/|libwww|headless|phantomjs|lighthouse|proofpoint|mimecast|symantec|barracuda|cloudmark/i.test(userAgent);

    if (isBot) {
      console.log(`🤖 Skipping click record (bot UA: ${userAgent.slice(0, 80)})`);
      await prisma.$disconnect();
      return NextResponse.redirect(originalUrl, 302);
    }

    // Record the click
    try {
      await linkShortener.recordClick(shortCode, subscriberId);
      console.log(`✅ Click recorded for ${shortCode}${subscriberId ? ` (subscriber: ${subscriberId})` : ''}`);
    } catch (error) {
      console.error(`❌ Failed to record click:`, error);
    }

    // Add to Hot Subscribers list on click
    if (subscriberId) {
      try {
        const listRepo = new PrismaSubscriberListRepository(prisma);
        const hotList = await listRepo.findOrCreateByName(HOT_LIST_NAME, HOT_LIST_DESCRIPTION);
        await listRepo.addMember(hotList.id, subscriberId, 'engagement:click');
        console.log(`🔥 Added subscriber ${subscriberId} to Hot Subscribers (click)`);
      } catch (error) {
        console.error('Failed to add to hot list on click:', error);
      }
    }

    await prisma.$disconnect();

    return NextResponse.redirect(originalUrl, 302);

  } catch (error: any) {
    console.error('Click tracking error:', error);
    await prisma.$disconnect();

    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
