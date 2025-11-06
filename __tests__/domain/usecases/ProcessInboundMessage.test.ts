import { ProcessInboundMessage } from '@/domain/usecases/ProcessInboundMessage';
import { SubscriberRepository } from '@/domain/repositories/SubscriberRepository';
import { Subscriber } from '@/domain/entities/Subscriber';

describe('ProcessInboundMessage', () => {
  let useCase: ProcessInboundMessage;
  let mockSubscriberRepo: jest.Mocked<SubscriberRepository>;
  let mockTwilioService: jest.Mock;
  let mockSlackService: jest.Mock;

  beforeEach(() => {
    mockSubscriberRepo = {
      add: jest.fn(),
      findByPhoneNumber: jest.fn(),
      update: jest.fn(),
      findAllActive: jest.fn(),
      count: jest.fn(),
    };

    mockTwilioService = jest.fn();
    mockSlackService = jest.fn();

    useCase = new ProcessInboundMessage(
      mockSubscriberRepo,
      mockTwilioService,
      mockSlackService
    );
  });

  describe('when receiving TRIBE keyword', () => {
    it('should add new subscriber', async () => {
      const phoneNumber = '+11234567890';
      const message = 'TRIBE';

      mockSubscriberRepo.findByPhoneNumber.mockResolvedValue(null);
      mockSubscriberRepo.add.mockResolvedValue(
        Subscriber.create(phoneNumber)
      );

      const result = await useCase.execute(phoneNumber, message);

      expect(mockSubscriberRepo.findByPhoneNumber).toHaveBeenCalledWith(phoneNumber);
      expect(mockSubscriberRepo.add).toHaveBeenCalled();
      expect(result.shouldRespond).toBe(true);
      expect(result.response).toBe("Welcome! You're subscribed. Reply STOP to unsubscribe.");
      expect(result.notifySlack).toBe(true); // Notify Slack of new subscriber
      expect(result.slackMessage).toContain('New subscriber');
    });

    it('should send welcome message to new subscriber', async () => {
      const phoneNumber = '+11234567890';
      const message = 'tribe'; // Test case insensitive

      mockSubscriberRepo.findByPhoneNumber.mockResolvedValue(null);
      mockSubscriberRepo.add.mockResolvedValue(
        Subscriber.create(phoneNumber)
      );

      const result = await useCase.execute(phoneNumber, message);

      expect(result.shouldRespond).toBe(true);
      expect(result.response).toContain('Welcome');
    });

    it('should send already subscribed message to existing subscriber', async () => {
      const phoneNumber = '+11234567890';
      const message = 'TRIBE';
      const existingSubscriber = Subscriber.create(phoneNumber);

      mockSubscriberRepo.findByPhoneNumber.mockResolvedValue(existingSubscriber);

      const result = await useCase.execute(phoneNumber, message);

      expect(mockSubscriberRepo.add).not.toHaveBeenCalled();
      expect(result.shouldRespond).toBe(true);
      expect(result.response).toBe("You're already in the tribe!");
      expect(result.notifySlack).toBe(false);
    });

    it('should reactivate deactivated subscriber', async () => {
      const phoneNumber = '+11234567890';
      const message = 'TRIBE';
      const deactivatedSubscriber = Subscriber.create(phoneNumber);
      deactivatedSubscriber.deactivate();

      mockSubscriberRepo.findByPhoneNumber.mockResolvedValue(deactivatedSubscriber);
      mockSubscriberRepo.update.mockResolvedValue(deactivatedSubscriber);

      const result = await useCase.execute(phoneNumber, message);

      expect(deactivatedSubscriber.isActive).toBe(true);
      expect(mockSubscriberRepo.update).toHaveBeenCalledWith(deactivatedSubscriber);
      expect(result.response).toBe("Welcome back! You're subscribed again.");
    });
  });

  describe('when receiving STOP keyword', () => {
    it('should deactivate subscriber', async () => {
      const phoneNumber = '+11234567890';
      const message = 'STOP';
      const subscriber = Subscriber.create(phoneNumber);

      mockSubscriberRepo.findByPhoneNumber.mockResolvedValue(subscriber);
      mockSubscriberRepo.update.mockResolvedValue(subscriber);

      const result = await useCase.execute(phoneNumber, message);

      expect(subscriber.isActive).toBe(false);
      expect(mockSubscriberRepo.update).toHaveBeenCalledWith(subscriber);
      expect(result.shouldRespond).toBe(true);
      expect(result.response).toBe("You've been unsubscribed. Text TRIBE to rejoin.");
      expect(result.notifySlack).toBe(true); // Notify Slack of opt-out
      expect(result.slackMessage).toContain('unsubscribed');
    });

    it('should handle STOP from non-subscriber', async () => {
      const phoneNumber = '+11234567890';
      const message = 'STOP';

      mockSubscriberRepo.findByPhoneNumber.mockResolvedValue(null);

      const result = await useCase.execute(phoneNumber, message);

      expect(result.shouldRespond).toBe(true);
      expect(result.response).toBe("You're not currently subscribed.");
      expect(result.notifySlack).toBe(false);
    });

    it('should handle case insensitive STOP commands', async () => {
      const phoneNumber = '+11234567890';
      const subscriber = Subscriber.create(phoneNumber);

      mockSubscriberRepo.findByPhoneNumber.mockResolvedValue(subscriber);
      mockSubscriberRepo.update.mockResolvedValue(subscriber);

      const testCases = ['stop', 'Stop', 'STOP', 'unsubscribe', 'UNSUBSCRIBE'];

      for (const message of testCases) {
        subscriber.activate(); // Reset for each test
        const result = await useCase.execute(phoneNumber, message);
        expect(result.shouldRespond).toBe(true);
        expect(result.response).toContain('unsubscribed');
      }
    });
  });

  describe('when receiving regular messages', () => {
    it('should handle message from active subscriber', async () => {
      const phoneNumber = '+11234567890';
      const message = 'Hello, this is a test message';
      const subscriber = Subscriber.create(phoneNumber);

      mockSubscriberRepo.findByPhoneNumber.mockResolvedValue(subscriber);

      const result = await useCase.execute(phoneNumber, message);

      expect(result.shouldRespond).toBe(false);
      expect(result.notifySlack).toBe(true);
      expect(result.slackMessage).toContain(message);
      expect(result.slackMessage).toContain(subscriber.formattedPhoneNumber);
    });

    it('should handle message from non-subscriber', async () => {
      const phoneNumber = '+11234567890';
      const message = 'Hello, I want to join';

      mockSubscriberRepo.findByPhoneNumber.mockResolvedValue(null);

      const result = await useCase.execute(phoneNumber, message);

      expect(result.shouldRespond).toBe(true);
      expect(result.response).toBe("Text TRIBE to subscribe to updates.");
      expect(result.notifySlack).toBe(false);
    });

    it('should handle message from deactivated subscriber', async () => {
      const phoneNumber = '+11234567890';
      const message = 'Hello, are you there?';
      const subscriber = Subscriber.create(phoneNumber);
      subscriber.deactivate();

      mockSubscriberRepo.findByPhoneNumber.mockResolvedValue(subscriber);

      const result = await useCase.execute(phoneNumber, message);

      expect(result.shouldRespond).toBe(true);
      expect(result.response).toBe("Text TRIBE to subscribe to updates.");
      expect(result.notifySlack).toBe(false);
    });
  });

  describe('when handling invalid phone numbers', () => {
    it('should reject international phone numbers', async () => {
      const phoneNumber = '+441234567890'; // UK number
      const message = 'TRIBE';

      await expect(useCase.execute(phoneNumber, message))
        .rejects.toThrow('Invalid US phone number');
    });

    it('should reject malformed phone numbers', async () => {
      const phoneNumber = '1234567890'; // Missing country code
      const message = 'TRIBE';

      await expect(useCase.execute(phoneNumber, message))
        .rejects.toThrow('Invalid US phone number');
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const phoneNumber = '+11234567890';
      const message = 'TRIBE';

      mockSubscriberRepo.findByPhoneNumber.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(useCase.execute(phoneNumber, message))
        .rejects.toThrow('Database connection failed');
    });
  });
});