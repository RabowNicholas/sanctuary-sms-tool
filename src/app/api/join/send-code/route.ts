import { NextRequest, NextResponse } from 'next/server';
import { createSignupServices } from '@/lib/signupServices';
import { normalizeUSPhone, checkSendLimits, createVerification } from '@/lib/phoneVerification';

// Public: texts a 6-digit code to a phone number for /join/[keyword].
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  // Honeypot: real people never fill the hidden "website" field. Pretend success.
  if (body?.website) return NextResponse.json({ ok: true });

  const phoneNumber = normalizeUSPhone(body?.phone);
  if (!phoneNumber) {
    return NextResponse.json({ error: "that doesn't look like a us number" }, { status: 400 });
  }
  const keywordText = typeof body?.keyword === 'string' ? body.keyword.trim().toUpperCase() : '';

  const { prisma, keywordRepo, twilioService } = createSignupServices();
  try {
    const keyword = keywordText ? await keywordRepo.findByKeyword(keywordText) : null;
    if (!keyword || !keyword.isActive) {
      return NextResponse.json({ error: 'this signup link is no longer active' }, { status: 404 });
    }

    const limit = await checkSendLimits(prisma, phoneNumber);
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'too many codes sent wait a few minutes and try again' },
        { status: 429 },
      );
    }

    const code = await createVerification(prisma, phoneNumber, keyword.keyword);
    await twilioService.sendMessage(
      phoneNumber,
      `${code} is your flow state code\nreply STOP to opt out`,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('join/send-code error:', error);
    return NextResponse.json({ error: "couldn't send the code try again" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
