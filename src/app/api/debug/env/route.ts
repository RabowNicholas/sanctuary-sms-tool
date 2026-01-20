import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Debug endpoint to check environment variables
 * Only accessible when authenticated
 */
export async function GET() {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    VERCEL_URL: process.env.VERCEL_URL || 'not set',
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL || 'not set',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'not set',
    NODE_ENV: process.env.NODE_ENV || 'not set',

    // What the link shortener would use currently
    currentLinkLogic: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.NEXTAUTH_URL || 'http://localhost:3000'),

    // What it SHOULD use for production
    recommendedProductionLogic: process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.NEXTAUTH_URL || 'not available',
  });
}
