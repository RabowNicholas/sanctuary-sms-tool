import { PrismaClient } from '@/generated/prisma';

export interface ShortenedLink {
  originalUrl: string;
  shortCode: string;
  trackingUrl: string;
}

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
    const urls = this.extractUrls(message);

    if (urls.length === 0) {
      return { processedMessage: message, links: [] };
    }

    const links: ShortenedLink[] = [];
    let processedMessage = message;

    for (const url of urls) {
      // Skip if approvedUrls is provided and this URL is not approved
      if (approvedUrls && !approvedUrls.includes(url)) {
        console.log(`⏭️  Skipping unapproved link: ${url}`);
        continue;
      }

      const shortCode = this.generateShortCode();
      const trackingUrl = `${this.baseUrl}/sanctuary/${shortCode}`;

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
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Get original URL from short code
   */
  async getOriginalUrl(shortCode: string): Promise<string | null> {
    const link = await this.prisma.link.findUnique({
      where: { shortCode },
    });

    return link?.originalUrl || null;
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
