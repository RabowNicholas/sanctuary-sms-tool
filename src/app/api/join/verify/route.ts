import { NextRequest, NextResponse } from 'next/server';
import { createSignupServices } from '@/lib/signupServices';
import { normalizeUSPhone, verifyCode } from '@/lib/phoneVerification';
import { deliverOptInResult } from '@/lib/deliverOptInResult';

const ERRORS = {
  invalid: { status: 400, error: "that code isn't right" },
  expired: { status: 410, error: 'that code expired send a new one' },
  too_many_attempts: { status: 429, error: 'too many tries send a new code' },
} as const;

// Public: checks the code and subscribes the number via the keyword's normal opt-in path.
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const phoneNumber = normalizeUSPhone(body?.phone);
  const keywordText = typeof body?.keyword === 'string' ? body.keyword.trim().toUpperCase() : '';
  const code = typeof body?.code === 'string' ? body.code.replace(/\D/g, '') : '';
  if (!phoneNumber || !keywordText) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const services = createSignupServices();
  const { prisma, optIn } = services;
  try {
    const outcome = await verifyCode(prisma, phoneNumber, keywordText, code);
    if (outcome !== 'verified') {
      const { status, error } = ERRORS[outcome];
      return NextResponse.json({ error, reason: outcome }, { status });
    }

    const result = await optIn.optInViaKeyword(phoneNumber, keywordText, 'web');
    if (!result) {
      return NextResponse.json({ error: 'this signup link is no longer active' }, { status: 404 });
    }

    await deliverOptInResult(phoneNumber, result, services);

    return NextResponse.json({
      status: result.alreadySubscribed ? 'already_subscribed' : 'subscribed',
    });
  } catch (error) {
    console.error('join/verify error:', error);
    return NextResponse.json({ error: 'something broke try again' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
