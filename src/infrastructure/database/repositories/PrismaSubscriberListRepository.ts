import { SubscriberListRepository, ListMembershipInfo } from '@/domain/repositories/SubscriberListRepository';
import { SubscriberList } from '@/domain/entities/SubscriberList';
import { PrismaClient } from '@/generated/prisma';

export class PrismaSubscriberListRepository implements SubscriberListRepository {
  constructor(private prisma: PrismaClient) {}

  async add(list: SubscriberList): Promise<SubscriberList> {
    const created = await this.prisma.subscriberList.create({
      data: {
        id: list.id,
        name: list.name,
        description: list.description,
      },
      include: {
        _count: {
          select: { subscribers: true },
        },
      },
    });

    return SubscriberList.fromPersistence(
      created.id,
      created.name,
      created.description,
      created.createdAt,
      created._count.subscribers
    );
  }

  async findById(id: string): Promise<SubscriberList | null> {
    const found = await this.prisma.subscriberList.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscribers: true },
        },
      },
    });

    if (!found) {
      return null;
    }

    return SubscriberList.fromPersistence(
      found.id,
      found.name,
      found.description,
      found.createdAt,
      found._count.subscribers
    );
  }

  async findByName(name: string): Promise<SubscriberList | null> {
    const found = await this.prisma.subscriberList.findUnique({
      where: { name },
      include: {
        _count: {
          select: { subscribers: true },
        },
      },
    });

    if (!found) {
      return null;
    }

    return SubscriberList.fromPersistence(
      found.id,
      found.name,
      found.description,
      found.createdAt,
      found._count.subscribers
    );
  }

  async findAll(): Promise<SubscriberList[]> {
    const lists = await this.prisma.subscriberList.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { subscribers: true },
        },
      },
    });

    return lists.map(l =>
      SubscriberList.fromPersistence(
        l.id,
        l.name,
        l.description,
        l.createdAt,
        l._count.subscribers
      )
    );
  }

  async update(list: SubscriberList): Promise<SubscriberList> {
    const updated = await this.prisma.subscriberList.update({
      where: { id: list.id },
      data: {
        name: list.name,
        description: list.description,
      },
      include: {
        _count: {
          select: { subscribers: true },
        },
      },
    });

    return SubscriberList.fromPersistence(
      updated.id,
      updated.name,
      updated.description,
      updated.createdAt,
      updated._count.subscribers
    );
  }

  async delete(id: string): Promise<void> {
    await this.prisma.subscriberList.delete({
      where: { id },
    });
  }

  async addMember(listId: string, subscriberId: string, joinedVia?: string): Promise<void> {
    await this.prisma.subscriberListMembership.upsert({
      where: {
        subscriberId_listId: {
          subscriberId,
          listId,
        },
      },
      create: {
        subscriberId,
        listId,
        joinedVia: joinedVia || null,
      },
      update: {}, // No-op if already exists
    });
  }

  async removeMember(listId: string, subscriberId: string): Promise<void> {
    await this.prisma.subscriberListMembership.delete({
      where: {
        subscriberId_listId: {
          subscriberId,
          listId,
        },
      },
    }).catch(() => {
      // Ignore if membership doesn't exist
    });
  }

  async getMembers(listId: string): Promise<ListMembershipInfo[]> {
    const memberships = await this.prisma.subscriberListMembership.findMany({
      where: { listId },
      include: {
        subscriber: {
          select: {
            id: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map(m => ({
      subscriberId: m.subscriber.id,
      phoneNumber: m.subscriber.phoneNumber,
      joinedAt: m.joinedAt,
      joinedVia: m.joinedVia,
    }));
  }

  async getMemberCount(listId: string): Promise<number> {
    return this.prisma.subscriberListMembership.count({
      where: { listId },
    });
  }

  async getListsForSubscriber(subscriberId: string): Promise<SubscriberList[]> {
    const memberships = await this.prisma.subscriberListMembership.findMany({
      where: { subscriberId },
      include: {
        list: {
          include: {
            _count: {
              select: { subscribers: true },
            },
          },
        },
      },
    });

    return memberships.map(m =>
      SubscriberList.fromPersistence(
        m.list.id,
        m.list.name,
        m.list.description,
        m.list.createdAt,
        m.list._count.subscribers
      )
    );
  }
}
