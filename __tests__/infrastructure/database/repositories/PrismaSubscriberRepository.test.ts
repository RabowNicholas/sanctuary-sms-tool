import { PrismaSubscriberRepository } from '@/infrastructure/database/repositories/PrismaSubscriberRepository';
import { Subscriber } from '@/domain/entities/Subscriber';
import { PrismaClient } from '@/generated/prisma';

// Mock Prisma Client
const mockPrismaClient = {
  subscriber: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
} as unknown as PrismaClient;

describe('PrismaSubscriberRepository', () => {
  let repository: PrismaSubscriberRepository;

  beforeEach(() => {
    repository = new PrismaSubscriberRepository(mockPrismaClient);
    jest.clearAllMocks();
  });

  describe('add', () => {
    it('should add new subscriber to database', async () => {
      const subscriber = Subscriber.create('+11234567890');
      const mockDbData = {
        id: subscriber.id,
        phoneNumber: subscriber.phoneNumber,
        isActive: subscriber.isActive,
        joinedAt: subscriber.joinedAt,
        updatedAt: new Date(),
        slackThreadTs: null,
      };

      (mockPrismaClient.subscriber.create as jest.Mock).mockResolvedValue(mockDbData);

      const result = await repository.add(subscriber);

      expect(mockPrismaClient.subscriber.create).toHaveBeenCalledWith({
        data: {
          id: subscriber.id,
          phoneNumber: subscriber.phoneNumber,
          isActive: subscriber.isActive,
          joinedAt: subscriber.joinedAt,
          slackThreadTs: subscriber.slackThreadTs,
        },
      });
      expect(result.phoneNumber).toBe(subscriber.phoneNumber);
      expect(result.isActive).toBe(subscriber.isActive);
    });

    it('should throw error when phone number already exists', async () => {
      const subscriber = Subscriber.create('+11234567890');
      const error = new Error('Unique constraint failed');
      (mockPrismaClient.subscriber.create as jest.Mock).mockRejectedValue(error);

      await expect(repository.add(subscriber)).rejects.toThrow('Unique constraint failed');
    });
  });

  describe('findByPhoneNumber', () => {
    it('should return subscriber when found', async () => {
      const phoneNumber = '+11234567890';
      const mockDbData = {
        id: 'test-id',
        phoneNumber,
        isActive: true,
        joinedAt: new Date(),
        updatedAt: new Date(),
        slackThreadTs: null,
      };

      (mockPrismaClient.subscriber.findUnique as jest.Mock).mockResolvedValue(mockDbData);

      const result = await repository.findByPhoneNumber(phoneNumber);

      expect(mockPrismaClient.subscriber.findUnique).toHaveBeenCalledWith({
        where: { phoneNumber },
      });
      expect(result).not.toBeNull();
      expect(result!.phoneNumber).toBe(phoneNumber);
    });

    it('should return null when subscriber not found', async () => {
      const phoneNumber = '+11234567890';
      (mockPrismaClient.subscriber.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByPhoneNumber(phoneNumber);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update subscriber in database', async () => {
      const subscriber = Subscriber.fromPersistence(
        'test-id',
        '+11234567890',
        true,
        new Date(),
        'thread-123'
      );
      subscriber.deactivate();

      const mockDbData = {
        id: subscriber.id,
        phoneNumber: subscriber.phoneNumber,
        isActive: subscriber.isActive,
        joinedAt: subscriber.joinedAt,
        updatedAt: new Date(),
        slackThreadTs: subscriber.slackThreadTs,
      };

      (mockPrismaClient.subscriber.update as jest.Mock).mockResolvedValue(mockDbData);

      const result = await repository.update(subscriber);

      expect(mockPrismaClient.subscriber.update).toHaveBeenCalledWith({
        where: { phoneNumber: subscriber.phoneNumber },
        data: {
          isActive: subscriber.isActive,
          slackThreadTs: subscriber.slackThreadTs,
        },
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe('findAllActive', () => {
    it('should return all active subscribers', async () => {
      const mockDbData = [
        {
          id: 'id1',
          phoneNumber: '+11234567890',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date(),
          slackThreadTs: null,
        },
        {
          id: 'id2',
          phoneNumber: '+19876543210',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date(),
          slackThreadTs: 'thread-456',
        },
      ];

      (mockPrismaClient.subscriber.findMany as jest.Mock).mockResolvedValue(mockDbData);

      const result = await repository.findAllActive();

      expect(mockPrismaClient.subscriber.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { joinedAt: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].phoneNumber).toBe('+11234567890');
      expect(result[1].phoneNumber).toBe('+19876543210');
    });
  });

  describe('count', () => {
    it('should return count of active subscribers', async () => {
      (mockPrismaClient.subscriber.count as jest.Mock).mockResolvedValue(1500);

      const result = await repository.count();

      expect(mockPrismaClient.subscriber.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result).toBe(1500);
    });
  });
});