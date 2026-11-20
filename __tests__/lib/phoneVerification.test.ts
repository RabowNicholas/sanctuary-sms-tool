import {
  normalizeUSPhone, generateCode, hashCode, codeMatches, verifyCode, checkSendLimits,
  MAX_ATTEMPTS, MAX_SENDS_PER_PHONE,
} from '@/lib/phoneVerification';

const PHONE = '+15551234567';

describe('normalizeUSPhone', () => {
  it.each([
    ['(555) 123-4567', PHONE],
    ['555.123.4567', PHONE],
    ['1 555 123 4567', PHONE],
    ['+15551234567', PHONE],
  ])('%s -> %s', (input, out) => expect(normalizeUSPhone(input)).toBe(out));

  it.each(['', '12345', '25551234567', '+44 20 7946 0958'])('rejects %s', (input) => {
    expect(normalizeUSPhone(input)).toBeNull();
  });
});

describe('codes', () => {
  it('generates 6 digits', () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
  it('matches only the right code for the right phone', () => {
    const h = hashCode(PHONE, '123456');
    expect(codeMatches(PHONE, '123456', h)).toBe(true);
    expect(codeMatches(PHONE, '123457', h)).toBe(false);
    expect(codeMatches('+15550000000', '123456', h)).toBe(false);
  });
});

function mockPrisma(row: any) {
  return {
    phoneVerification: {
      findFirst: jest.fn().mockResolvedValue(row),
      update: jest.fn(async ({ data }) => ({ ...row, attempts: row.attempts + (data.attempts?.increment ?? 0) })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn(),
    },
  } as any;
}

const now = new Date('2026-11-20T12:00:00Z');
const pending = (over: object = {}) => ({
  id: 'v1', phoneNumber: PHONE, keyword: 'FLOW', codeHash: hashCode(PHONE, '123456'),
  attempts: 0, expiresAt: new Date(now.getTime() + 60_000), verifiedAt: null, ...over,
});

describe('verifyCode', () => {
  it('verifies a correct code', async () => {
    const prisma = mockPrisma(pending());
    expect(await verifyCode(prisma, PHONE, 'FLOW', '123456', now)).toBe('verified');
    expect(prisma.phoneVerification.updateMany).toHaveBeenCalled();
  });
  it('counts a wrong code as an attempt', async () => {
    const prisma = mockPrisma(pending());
    expect(await verifyCode(prisma, PHONE, 'FLOW', '000000', now)).toBe('invalid');
    expect(prisma.phoneVerification.update).toHaveBeenCalled();
  });
  it('locks out on the last wrong attempt', async () => {
    const prisma = mockPrisma(pending({ attempts: MAX_ATTEMPTS - 1 }));
    expect(await verifyCode(prisma, PHONE, 'FLOW', '000000', now)).toBe('too_many_attempts');
  });
  it('rejects even the right code after too many attempts', async () => {
    const prisma = mockPrisma(pending({ attempts: MAX_ATTEMPTS }));
    expect(await verifyCode(prisma, PHONE, 'FLOW', '123456', now)).toBe('too_many_attempts');
  });
  it('rejects an expired code', async () => {
    const prisma = mockPrisma(pending({ expiresAt: new Date(now.getTime() - 1) }));
    expect(await verifyCode(prisma, PHONE, 'FLOW', '123456', now)).toBe('expired');
  });
  it('treats no pending code as expired', async () => {
    expect(await verifyCode(mockPrisma(null), PHONE, 'FLOW', '123456', now)).toBe('expired');
  });
  it('does not double-verify on a race', async () => {
    const prisma = mockPrisma(pending());
    prisma.phoneVerification.updateMany.mockResolvedValue({ count: 0 });
    expect(await verifyCode(prisma, PHONE, 'FLOW', '123456', now)).toBe('expired');
  });
});

describe('checkSendLimits', () => {
  it('blocks after the per-phone limit', async () => {
    const prisma = mockPrisma(null);
    prisma.phoneVerification.count.mockResolvedValueOnce(MAX_SENDS_PER_PHONE).mockResolvedValueOnce(0);
    expect(await checkSendLimits(prisma, PHONE, now)).toEqual({ ok: false, reason: 'too_many_for_phone' });
  });
  it('allows under the limit', async () => {
    const prisma = mockPrisma(null);
    prisma.phoneVerification.count.mockResolvedValue(0);
    expect(await checkSendLimits(prisma, PHONE, now)).toEqual({ ok: true });
  });
});
