import { NextRequest } from 'next/server';
import { handleLinkRedirect } from '@/lib/linkRedirect';

interface RouteParams {
  params: Promise<{
    code: string;
  }>;
}

// Legacy prefix, kept alive so links already sent to subscribers (before the
// shorter /r/ prefix was introduced) keep working. New links use /r/.
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  return handleLinkRedirect(request, code);
}
