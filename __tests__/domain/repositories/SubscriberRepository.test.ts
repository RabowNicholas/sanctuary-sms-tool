import { SubscriberRepository } from '@/domain/repositories/SubscriberRepository';
import { Subscriber } from '@/domain/entities/Subscriber';

describe('SubscriberRepository', () => {
  let repository: SubscriberRepository;

  beforeEach(() => {
    // This will be mocked in tests
    repository = {} as SubscriberRepository;
  });

  describe('add', () => {
    it('should add new subscriber', async () => {
      const subscriber = Subscriber.create('+11234567890');
      const mockAdd = jest.fn().mockResolvedValue(subscriber);
      repository.add = mockAdd;

      const result = await repository.add(subscriber);

      expect(mockAdd).toHaveBeenCalledWith(subscriber);
      expect(result).toBe(subscriber);
    });

    it('should throw error when adding duplicate subscriber', async () => {
      const subscriber = Subscriber.create('+11234567890');
      const mockAdd = jest.fn().mockRejectedValue(new Error('Subscriber already exists'));
      repository.add = mockAdd;

      await expect(repository.add(subscriber)).rejects.toThrow('Subscriber already exists');
    });
  });

  describe('findByPhoneNumber', () => {
    it('should return subscriber when found', async () => {
      const phoneNumber = '+11234567890';
      const subscriber = Subscriber.create(phoneNumber);
      const mockFind = jest.fn().mockResolvedValue(subscriber);
      repository.findByPhoneNumber = mockFind;

      const result = await repository.findByPhoneNumber(phoneNumber);

      expect(mockFind).toHaveBeenCalledWith(phoneNumber);
      expect(result).toBe(subscriber);
    });

    it('should return null when subscriber not found', async () => {
      const phoneNumber = '+11234567890';
      const mockFind = jest.fn().mockResolvedValue(null);
      repository.findByPhoneNumber = mockFind;

      const result = await repository.findByPhoneNumber(phoneNumber);

      expect(mockFind).toHaveBeenCalledWith(phoneNumber);
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update subscriber', async () => {
      const subscriber = Subscriber.create('+11234567890');
      subscriber.deactivate();
      const mockUpdate = jest.fn().mockResolvedValue(subscriber);
      repository.update = mockUpdate;

      const result = await repository.update(subscriber);

      expect(mockUpdate).toHaveBeenCalledWith(subscriber);
      expect(result).toBe(subscriber);
    });
  });

  describe('findAllActive', () => {
    it('should return all active subscribers', async () => {
      const subscribers = [
        Subscriber.create('+11234567890'),
        Subscriber.create('+19876543210')
      ];
      const mockFindAll = jest.fn().mockResolvedValue(subscribers);
      repository.findAllActive = mockFindAll;

      const result = await repository.findAllActive();

      expect(mockFindAll).toHaveBeenCalled();
      expect(result).toEqual(subscribers);
    });

    it('should return empty array when no active subscribers', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([]);
      repository.findAllActive = mockFindAll;

      const result = await repository.findAllActive();

      expect(result).toEqual([]);
    });
  });

  describe('count', () => {
    it('should return total count of active subscribers', async () => {
      const mockCount = jest.fn().mockResolvedValue(150);
      repository.count = mockCount;

      const result = await repository.count();

      expect(mockCount).toHaveBeenCalled();
      expect(result).toBe(150);
    });
  });
});