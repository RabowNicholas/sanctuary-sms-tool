import { NextRequest } from 'next/server';
import { handleLinkRedirect } from '@/lib/linkRedirect';

interface RouteParams {
  params: Promise<{
    code: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  return handleLinkRedirect(request, code);
}
