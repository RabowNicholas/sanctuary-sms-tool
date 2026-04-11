import { PrismaClient, SuppressionReason } from '@/generated/prisma';

export interface SuppressionEntry {
  id: string;
  phoneNumber: string;
  reason: SuppressionReason;
  addedAt: Date;
}

export interface SuppressionCounts {
  total: number;
  optedOut: number;
  unreachable: number;
  nonexistent: number;
}

export class PrismaSuppressionRepository {
  constructor(private prisma: PrismaClient) {}

  async isSuppressed(phoneNumber: string): Promise<boolean> {
    const entry = await this.prisma.suppressionEntry.findUnique({
      where: { phoneNumber },
      select: { id: true },
    });
    return entry !== null;
  }

  // Upsert: silently handles duplicates. On conflict, only updates reason —
  // addedAt is intentionally NOT updated so the original suppression timestamp
  // is preserved for compliance audit purposes.
  async addEntry(phoneNumber: string, reason: SuppressionReason): Promise<void> {
    await this.prisma.suppressionEntry.upsert({
      where: { phoneNumber },
      update: { reason },
      create: { phoneNumber, reason },
    });
  }

  async findAll(filter?: { reason?: SuppressionReason }): Promise<SuppressionEntry[]> {
    return this.prisma.suppressionEntry.findMany({
      where: filter?.reason ? { reason: filter.reason } : undefined,
      orderBy: { addedAt: 'desc' },
    });
  }

  async counts(): Promise<SuppressionCounts> {
    const [total, optedOut, unreachable, nonexistent] = await Promise.all([
      this.prisma.suppressionEntry.count(),
      this.prisma.suppressionEntry.count({ where: { reason: 'OPTED_OUT' } }),
      this.prisma.suppressionEntry.count({ where: { reason: 'UNREACHABLE' } }),
      this.prisma.suppressionEntry.count({ where: { reason: 'NONEXISTENT' } }),
    ]);
    return { total, optedOut, unreachable, nonexistent };
  }

  async remove(id: string): Promise<void> {
    await this.prisma.suppressionEntry.delete({ where: { id } });
  }
}
