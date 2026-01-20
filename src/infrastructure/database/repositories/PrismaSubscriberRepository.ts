import { SubscriberRepository } from '@/domain/repositories/SubscriberRepository';
import { Subscriber } from '@/domain/entities/Subscriber';
import { PrismaClient } from '@/generated/prisma';

export class PrismaSubscriberRepository implements SubscriberRepository {
  constructor(private prisma: PrismaClient) {}

  async add(subscriber: Subscriber): Promise<Subscriber> {
    const created = await this.prisma.subscriber.create({
      data: {
        id: subscriber.id,
        phoneNumber: subscriber.phoneNumber,
        isActive: subscriber.isActive,
        joinedAt: subscriber.joinedAt,
        slackThreadTs: subscriber.slackThreadTs,
        joinedViaKeyword: subscriber.joinedViaKeyword,
      },
    });

    return Subscriber.fromPersistence(
      created.id,
      created.phoneNumber,
      created.isActive,
      created.joinedAt,
      created.slackThreadTs || undefined,
      created.joinedViaKeyword || undefined
    );
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Subscriber | null> {
    const found = await this.prisma.subscriber.findUnique({
      where: { phoneNumber },
    });

    if (!found) {
      return null;
    }

    return Subscriber.fromPersistence(
      found.id,
      found.phoneNumber,
      found.isActive,
      found.joinedAt,
      found.slackThreadTs || undefined,
      found.joinedViaKeyword || undefined
    );
  }

  async findById(id: string): Promise<Subscriber | null> {
    const found = await this.prisma.subscriber.findUnique({
      where: { id },
    });

    if (!found) {
      return null;
    }

    return Subscriber.fromPersistence(
      found.id,
      found.phoneNumber,
      found.isActive,
      found.joinedAt,
      found.slackThreadTs || undefined,
      found.joinedViaKeyword || undefined
    );
  }

  async update(subscriber: Subscriber): Promise<Subscriber> {
    const updated = await this.prisma.subscriber.update({
      where: { phoneNumber: subscriber.phoneNumber },
      data: {
        isActive: subscriber.isActive,
        slackThreadTs: subscriber.slackThreadTs,
        joinedViaKeyword: subscriber.joinedViaKeyword,
      },
    });

    return Subscriber.fromPersistence(
      updated.id,
      updated.phoneNumber,
      updated.isActive,
      updated.joinedAt,
      updated.slackThreadTs || undefined,
      updated.joinedViaKeyword || undefined
    );
  }

  async findAllActive(): Promise<Subscriber[]> {
    const subscribers = await this.prisma.subscriber.findMany({
      where: { isActive: true },
      orderBy: { joinedAt: 'asc' },
    });

    return subscribers.map(sub =>
      Subscriber.fromPersistence(
        sub.id,
        sub.phoneNumber,
        sub.isActive,
        sub.joinedAt,
        sub.slackThreadTs || undefined,
        sub.joinedViaKeyword || undefined
      )
    );
  }

  async findActiveByListIds(listIds: string[]): Promise<Subscriber[]> {
    if (listIds.length === 0) {
      return [];
    }

    const subscribers = await this.prisma.subscriber.findMany({
      where: {
        isActive: true,
        listMemberships: {
          some: {
            listId: {
              in: listIds,
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return subscribers.map(sub =>
      Subscriber.fromPersistence(
        sub.id,
        sub.phoneNumber,
        sub.isActive,
        sub.joinedAt,
        sub.slackThreadTs || undefined,
        sub.joinedViaKeyword || undefined
      )
    );
  }

  async count(): Promise<number> {
    return this.prisma.subscriber.count({
      where: { isActive: true },
    });
  }
}