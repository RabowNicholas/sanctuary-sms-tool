import { NextRequest } from 'next/server';
import { handleLinkRedirect } from '@/lib/linkRedirect';

// A single shared instance: the mock factory must return the SAME object on
// every `new PrismaClient()` call, otherwise the mocks the test configures
// and the instance the code under test actually uses are two different
// objects and every assertion silently no-ops.
const mockPrismaInstance = {
  link: { findUnique: jest.fn() },
  linkClick: { create: jest.fn() },
  $disconnect: jest.fn(),
};

jest.mock('@/generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaInstance),
}));

const mockFindOrCreateByName = jest.fn().mockResolvedValue({ id: 'hot-list-1' });
const mockAddMember = jest.fn().mockResolvedValue(undefined);

jest.mock('@/infrastructure/database/repositories/PrismaSubscriberListRepository', () => ({
  PrismaSubscriberListRepository: jest.fn().mockImplementation(() => ({
    findOrCreateByName: mockFindOrCreateByName,
    addMember: mockAddMember,
  })),
}));

describe('handleLinkRedirect', () => {
  let mockPrisma: any;

  const realUserAgent =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

  const request = (url: string, userAgent = realUserAgent) =>
    new NextRequest(url, { headers: { 'user-agent': userAgent } });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = mockPrismaInstance;
  });

  it('404s when the short code does not exist', async () => {
    mockPrisma.link.findUnique.mockResolvedValue(null);

    const response = await handleLinkRedirect(request('https://example.com/r/missing'), 'missing');

    expect(response.status).toBe(404);
    expect(mockPrisma.linkClick.create).not.toHaveBeenCalled();
  });

  it('attributes the click to the subscriber stored on the link row (personalized link, no ?sid=)', async () => {
    mockPrisma.link.findUnique.mockResolvedValue({
      id: 'link-1',
      originalUrl: 'https://destination.example',
      subscriberId: 'sub-from-db',
    });

    const response = await handleLinkRedirect(request('https://example.com/r/abc1234'), 'abc1234');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://destination.example/');
    expect(mockPrisma.linkClick.create).toHaveBeenCalledWith({
      data: { linkId: 'link-1', subscriberId: 'sub-from-db' },
    });
    expect(mockAddMember).toHaveBeenCalledWith('hot-list-1', 'sub-from-db', 'engagement:click');
  });

  it('falls back to the legacy ?sid= query param when the link has no DB-stored subscriber', async () => {
    mockPrisma.link.findUnique.mockResolvedValue({
      id: 'link-2',
      originalUrl: 'https://destination.example',
      subscriberId: null,
    });

    const response = await handleLinkRedirect(
      request('https://example.com/rd/legacycode?sid=sub-from-query'),
      'legacycode'
    );

    expect(response.status).toBe(302);
    expect(mockPrisma.linkClick.create).toHaveBeenCalledWith({
      data: { linkId: 'link-2', subscriberId: 'sub-from-query' },
    });
  });

  it('prefers the DB-stored subscriber over a ?sid= param if both are somehow present', async () => {
    mockPrisma.link.findUnique.mockResolvedValue({
      id: 'link-3',
      originalUrl: 'https://destination.example',
      subscriberId: 'sub-from-db',
    });

    await handleLinkRedirect(
      request('https://example.com/r/abc1234?sid=sub-from-query'),
      'abc1234'
    );

    expect(mockPrisma.linkClick.create).toHaveBeenCalledWith({
      data: { linkId: 'link-3', subscriberId: 'sub-from-db' },
    });
  });

  it('does not record a click or touch the hot list for bot/scanner user agents', async () => {
    mockPrisma.link.findUnique.mockResolvedValue({
      id: 'link-4',
      originalUrl: 'https://destination.example',
      subscriberId: 'sub-from-db',
    });

    const response = await handleLinkRedirect(
      request('https://example.com/r/abc1234', 'facebookexternalhit/1.1'),
      'abc1234'
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://destination.example/');
    expect(mockPrisma.linkClick.create).not.toHaveBeenCalled();
    expect(mockAddMember).not.toHaveBeenCalled();
  });

  it('redirects with no subscriber attribution for a shared/standalone link clicked with no sid', async () => {
    mockPrisma.link.findUnique.mockResolvedValue({
      id: 'link-5',
      originalUrl: 'https://destination.example',
      subscriberId: null,
    });

    await handleLinkRedirect(request('https://example.com/r/abc1234'), 'abc1234');

    expect(mockPrisma.linkClick.create).toHaveBeenCalledWith({
      data: { linkId: 'link-5', subscriberId: null },
    });
    expect(mockAddMember).not.toHaveBeenCalled();
  });
});
