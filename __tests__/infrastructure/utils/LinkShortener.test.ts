import { LinkShortener } from '@/infrastructure/utils/LinkShortener';

describe('LinkShortener', () => {
  const baseUrl = 'https://example.com';
  let prisma: any;
  let linkShortener: LinkShortener;

  beforeEach(() => {
    prisma = {
      link: {
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      linkClick: {
        create: jest.fn(),
      },
    };
    linkShortener = new LinkShortener(prisma, baseUrl);
  });

  describe('createPersonalizedLinks', () => {
    const originalUrl = 'https://destination.example/offer';
    const broadcastId = 'broadcast-1';
    const subscriberIds = ['sub-a', 'sub-b', 'sub-c'];

    it('creates one short link per subscriber, all unique, none carrying ?sid=', async () => {
      const result = await linkShortener.createPersonalizedLinks(originalUrl, broadcastId, subscriberIds);

      expect(prisma.link.findMany).toHaveBeenCalledTimes(1); // clean pass, no collisions
      expect(prisma.link.createMany).toHaveBeenCalledTimes(1);

      const inserted = prisma.link.createMany.mock.calls[0][0].data as any[];
      expect(inserted).toHaveLength(3);

      // Every row correctly attributed
      for (const id of subscriberIds) {
        const row = inserted.find((r) => r.subscriberId === id);
        expect(row).toBeDefined();
        expect(row.broadcastId).toBe(broadcastId);
        expect(row.originalUrl).toBe(originalUrl);
        expect(row.shortCode).toMatch(/^[A-Za-z0-9]{7}$/);
      }

      // Codes are unique across the batch
      const codes = inserted.map((r) => r.shortCode);
      expect(new Set(codes).size).toBe(codes.length);

      // Returned map matches what was inserted, and URLs carry no query string
      expect(result.size).toBe(3);
      for (const id of subscriberIds) {
        const link = result.get(id)!;
        const insertedRow = inserted.find((r) => r.subscriberId === id);
        expect(link.shortCode).toBe(insertedRow.shortCode);
        expect(link.trackingUrl).toBe(`${baseUrl}/r/${insertedRow.shortCode}`);
        expect(link.trackingUrl).not.toContain('?');
        expect(link.trackingUrl).not.toContain('sid');
      }
    });

    it('de-duplicates repeated subscriber ids into a single link each', async () => {
      const result = await linkShortener.createPersonalizedLinks(
        originalUrl,
        broadcastId,
        ['sub-a', 'sub-a', 'sub-b']
      );

      const inserted = prisma.link.createMany.mock.calls[0][0].data as any[];
      expect(inserted).toHaveLength(2);
      expect(result.size).toBe(2);
    });

    it('regenerates only the specific short code that collides with an existing DB row', async () => {
      let findManyCalls = 0;
      let conflictingCode: string | null = null;

      prisma.link.findMany.mockImplementation(({ where }: any) => {
        findManyCalls++;
        const candidateCodes: string[] = where.shortCode.in;
        if (findManyCalls === 1) {
          // Simulate the very first generated code already existing in the DB
          conflictingCode = candidateCodes[0];
          return Promise.resolve([{ shortCode: conflictingCode }]);
        }
        return Promise.resolve([]);
      });

      const result = await linkShortener.createPersonalizedLinks(originalUrl, broadcastId, subscriberIds);

      expect(findManyCalls).toBe(2); // one conflict found, one clean re-check
      expect(prisma.link.createMany).toHaveBeenCalledTimes(1);

      const inserted = prisma.link.createMany.mock.calls[0][0].data as any[];
      const finalCodes = inserted.map((r: any) => r.shortCode);

      // The regenerated batch must not reuse the code that was reported as taken
      expect(finalCodes).not.toContain(conflictingCode);
      // Still fully unique and fully attributed
      expect(new Set(finalCodes).size).toBe(3);
      expect(result.size).toBe(3);
    });

    it('throws and never calls createMany if codes keep colliding past the retry budget', async () => {
      prisma.link.findMany.mockImplementation(({ where }: any) => {
        // Every candidate always reported as already taken
        return Promise.resolve(where.shortCode.in.map((shortCode: string) => ({ shortCode })));
      });

      await expect(
        linkShortener.createPersonalizedLinks(originalUrl, broadcastId, subscriberIds)
      ).rejects.toThrow(/unique short codes/i);

      expect(prisma.link.createMany).not.toHaveBeenCalled();
    });
  });

  describe('getLink', () => {
    it('returns the destination URL and subscriber attribution for a known code', async () => {
      prisma.link.findUnique.mockResolvedValue({
        originalUrl: 'https://destination.example',
        subscriberId: 'sub-a',
      });

      const link = await linkShortener.getLink('abc1234');
      expect(link).toEqual({ originalUrl: 'https://destination.example', subscriberId: 'sub-a' });
    });

    it('returns null subscriberId for a non-personalized (shared/standalone) link', async () => {
      prisma.link.findUnique.mockResolvedValue({
        originalUrl: 'https://destination.example',
        subscriberId: null,
      });

      const link = await linkShortener.getLink('abc1234');
      expect(link!.subscriberId).toBeNull();
    });

    it('returns null when the short code does not exist', async () => {
      prisma.link.findUnique.mockResolvedValue(null);
      const link = await linkShortener.getLink('missing');
      expect(link).toBeNull();
    });
  });

  describe('getApprovedUrls', () => {
    it('returns all detected URLs when no approval list is given', () => {
      const message = 'Check this out: https://a.example and https://b.example';
      const urls = linkShortener.getApprovedUrls(message);
      expect(urls).toEqual(['https://a.example', 'https://b.example']);
    });

    it('filters out URLs not present in the approved list', () => {
      const message = 'Check this out: https://a.example and https://b.example';
      const urls = linkShortener.getApprovedUrls(message, ['https://a.example']);
      expect(urls).toEqual(['https://a.example']);
    });

    it('deduplicates repeated URLs', () => {
      const message = 'https://a.example again https://a.example';
      const urls = linkShortener.getApprovedUrls(message);
      expect(urls).toEqual(['https://a.example']);
    });
  });

  describe('processMessage', () => {
    it('replaces the URL in the message with a short /r/ link', async () => {
      const { processedMessage, links } = await linkShortener.processMessage(
        'Link: https://a.example',
        'broadcast-1'
      );

      expect(links).toHaveLength(1);
      expect(processedMessage).toBe(`Link: ${links[0].trackingUrl}`);
      expect(links[0].trackingUrl).toMatch(new RegExp(`^${baseUrl}/r/[A-Za-z0-9]{7}$`));
    });
  });
});
