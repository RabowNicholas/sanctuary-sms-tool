import { PrismaClient } from '@/generated/prisma';

export interface ShortenedLink {
  originalUrl: string;
  shortCode: string;
  trackingUrl: string;
}

export interface ResolvedLink {
  originalUrl: string;
  subscriberId: string | null;
}

const SHORT_CODE_LENGTH = 7;
const SHORT_CODE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export class LinkShortener {
  private readonly urlPattern = /(https?:\/\/[^\s]+)/g;

  constructor(private prisma: PrismaClient, private baseUrl: string) {}

  /**
   * Detects URLs in a message and replaces them with tracking links
   * Only shortens URLs that are in the approvedUrls list (if provided)
   */
  async processMessage(
    message: string,
    broadcastId: string,
    approvedUrls?: string[]
  ): Promise<{ processedMessage: string; links: ShortenedLink[] }> {
    const urls = this.getApprovedUrls(message, approvedUrls);

    if (urls.length === 0) {
      return { processedMessage: message, links: [] };
    }

    const links: ShortenedLink[] = [];
    let processedMessage = message;

    for (const url of urls) {
      const shortCode = this.generateShortCode();
      const trackingUrl = `${this.baseUrl}/r/${shortCode}`;

      // Store link in database
      await this.prisma.link.create({
        data: {
          broadcastId,
          originalUrl: url,
          shortCode,
        },
      });

      links.push({ originalUrl: url, shortCode, trackingUrl });

      // Replace URL in message
      processedMessage = processedMessage.replace(url, trackingUrl);
    }

    return { processedMessage, links };
  }

  /**
   * Extract the distinct URLs in a message that are approved for shortening
   * (or all detected URLs, if no approved list is given).
   */
  getApprovedUrls(message: string, approvedUrls?: string[]): string[] {
    const urls = this.extractUrls(message);
    if (!approvedUrls) return urls;
    return urls.filter((url) => {
      if (approvedUrls.includes(url)) return true;
      console.log(`⏭️  Skipping unapproved link: ${url}`);
      return false;
    });
  }

  /**
   * Extract all URLs from a message
   */
  private extractUrls(message: string): string[] {
    const matches = message.match(this.urlPattern);
    return matches ? [...new Set(matches)] : []; // Remove duplicates
  }

  /**
   * Generate a unique short code
   */
  private generateShortCode(): string {
    let code = '';
    for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
      code += SHORT_CODE_CHARS.charAt(Math.floor(Math.random() * SHORT_CODE_CHARS.length));
    }
    return code;
  }

  /**
   * Create a standalone tracking link not tied to a broadcast.
   * Retries on the rare shortCode collision.
   */
  async createStandaloneLink(originalUrl: string): Promise<ShortenedLink> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const shortCode = this.generateShortCode();
      try {
        await this.prisma.link.create({
          data: { broadcastId: null, originalUrl, shortCode },
        });
        return {
          originalUrl,
          shortCode,
          trackingUrl: `${this.baseUrl}/r/${shortCode}`,
        };
      } catch (error: any) {
        if (error?.code === 'P2002') continue;
        throw error;
      }
    }
    throw new Error('Failed to generate unique short code');
  }

  /**
   * Create one tracking link per subscriber for the same destination URL, with the
   * subscriber attribution stored on the row instead of appended to the URL as
   * `?sid=`. This is what keeps personalized broadcast links short.
   *
   * Returns a map of subscriberId -> ShortenedLink. Either all links are created
   * or none are (a single batched INSERT), so callers can safely fall back to an
   * unpersonalized link on failure without risking partial/mismatched state.
   */
  async createPersonalizedLinks(
    originalUrl: string,
    broadcastId: string,
    subscriberIds: string[]
  ): Promise<Map<string, ShortenedLink>> {
    const uniqueSubscriberIds = [...new Set(subscriberIds)];
    const codes = new Map<string, string>(); // subscriberId -> shortCode

    const generateFor = (ids: string[]) => {
      const used = new Set(codes.values());
      for (const id of ids) {
        let code: string;
        do {
          code = this.generateShortCode();
        } while (used.has(code));
        used.add(code);
        codes.set(id, code);
      }
    };

    generateFor(uniqueSubscriberIds);

    // Guard against collisions with codes already persisted in the DB. With
    // 7-char base62 codes this is astronomically unlikely, but a collision
    // would silently mis-attribute a click, so it's worth checking rather
    // than trusting probability.
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidateCodes = [...codes.values()];
      const existing = await this.prisma.link.findMany({
        where: { shortCode: { in: candidateCodes } },
        select: { shortCode: true },
      });

      if (existing.length === 0) break;

      const existingCodes = new Set(existing.map((e) => e.shortCode));
      const conflictingIds = [...codes.entries()]
        .filter(([, code]) => existingCodes.has(code))
        .map(([id]) => id);

      if (attempt === maxAttempts - 1) {
        throw new Error(
          `Failed to generate unique short codes after ${maxAttempts} attempts (${conflictingIds.length} conflict(s) remaining)`
        );
      }

      generateFor(conflictingIds);
    }

    await this.prisma.link.createMany({
      data: uniqueSubscriberIds.map((subscriberId) => ({
        broadcastId,
        originalUrl,
        shortCode: codes.get(subscriberId)!,
        subscriberId,
      })),
    });

    const result = new Map<string, ShortenedLink>();
    for (const subscriberId of uniqueSubscriberIds) {
      const shortCode = codes.get(subscriberId)!;
      result.set(subscriberId, {
        originalUrl,
        shortCode,
        trackingUrl: `${this.baseUrl}/r/${shortCode}`,
      });
    }
    return result;
  }

  /**
   * Look up a short code: the destination URL plus whichever subscriber (if
   * any) it was personalized for.
   */
  async getLink(shortCode: string): Promise<ResolvedLink | null> {
    const link = await this.prisma.link.findUnique({
      where: { shortCode },
      select: { originalUrl: true, subscriberId: true },
    });

    if (!link) return null;
    return { originalUrl: link.originalUrl, subscriberId: link.subscriberId };
  }

  /**
   * Record a click on a link
   */
  async recordClick(shortCode: string, subscriberId?: string): Promise<void> {
    const link = await this.prisma.link.findUnique({
      where: { shortCode },
    });

    if (!link) {
      throw new Error('Link not found');
    }

    await this.prisma.linkClick.create({
      data: {
        linkId: link.id,
        subscriberId: subscriberId || null,
      },
    });
  }
}
