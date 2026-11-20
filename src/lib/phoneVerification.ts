import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import type { PrismaClient } from '@/generated/prisma';

export const CODE_TTL_MS = 10 * 60 * 1000; // code valid for 10 minutes
export const MAX_ATTEMPTS = 5; // wrong guesses before the code is dead
export const SEND_WINDOW_MS = 15 * 60 * 1000;
export const MAX_SENDS_PER_PHONE = 3; // per SEND_WINDOW_MS
export const MAX_SENDS_GLOBAL_PER_HOUR = 300; // cost guard against number-spraying

/**
 * Normalize user-typed US numbers to E.164 (+1XXXXXXXXXX).
 * Accepts "(555) 123-4567", "555.123.4567", "1 555 123 4567", "+15551234567".
 * Returns null if it can't be a US number.
 */
export function normalizeUSPhone(input: string): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function secret(): string {
  return process.env.NEXTAUTH_SECRET || 'dev-verification-secret';
}

export function hashCode(phoneNumber: string, code: string): string {
  return createHmac('sha256', secret()).update(`${phoneNumber}:${code}`).digest('hex');
}

export function codeMatches(phoneNumber: string, code: string, codeHash: string): boolean {
  const a = Buffer.from(hashCode(phoneNumber, code), 'hex');
  const b = Buffer.from(codeHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export type SendCheck = { ok: true } | { ok: false; reason: 'too_many_for_phone' | 'global_limit' };

export async function checkSendLimits(prisma: PrismaClient, phoneNumber: string, now = new Date()): Promise<SendCheck> {
  const [forPhone, global] = await Promise.all([
    prisma.phoneVerification.count({
      where: { phoneNumber, createdAt: { gte: new Date(now.getTime() - SEND_WINDOW_MS) } },
    }),
    prisma.phoneVerification.count({
      where: { createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
    }),
  ]);
  if (forPhone >= MAX_SENDS_PER_PHONE) return { ok: false, reason: 'too_many_for_phone' };
  if (global >= MAX_SENDS_GLOBAL_PER_HOUR) return { ok: false, reason: 'global_limit' };
  return { ok: true };
}

export async function createVerification(
  prisma: PrismaClient,
  phoneNumber: string,
  keyword: string,
  now = new Date(),
): Promise<string> {
  const code = generateCode();
  await prisma.phoneVerification.create({
    data: {
      phoneNumber,
      keyword,
      codeHash: hashCode(phoneNumber, code),
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    },
  });
  return code;
}

export type VerifyOutcome = 'verified' | 'invalid' | 'expired' | 'too_many_attempts';

/**
 * Check a code against the newest pending verification for this phone+keyword.
 * Wrong guesses count toward MAX_ATTEMPTS; a correct code marks it verified.
 */
export async function verifyCode(
  prisma: PrismaClient,
  phoneNumber: string,
  keyword: string,
  code: string,
  now = new Date(),
): Promise<VerifyOutcome> {
  const pending = await prisma.phoneVerification.findFirst({
    where: { phoneNumber, keyword, verifiedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!pending) return 'expired';
  if (pending.expiresAt <= now) return 'expired';
  if (pending.attempts >= MAX_ATTEMPTS) return 'too_many_attempts';

  if (!/^\d{6}$/.test(code) || !codeMatches(phoneNumber, code, pending.codeHash)) {
    const updated = await prisma.phoneVerification.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    });
    return updated.attempts >= MAX_ATTEMPTS ? 'too_many_attempts' : 'invalid';
  }

  // Conditional update so a double-submit can't verify twice.
  const claimed = await prisma.phoneVerification.updateMany({
    where: { id: pending.id, verifiedAt: null },
    data: { verifiedAt: now },
  });
  return claimed.count === 1 ? 'verified' : 'expired';
}
