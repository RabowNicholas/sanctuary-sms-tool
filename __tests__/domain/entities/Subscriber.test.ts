import { Subscriber } from '@/domain/entities/Subscriber';

describe('Subscriber Entity', () => {
  describe('phone number validation', () => {
    it('should validate US phone numbers only', () => {
      const validNumbers = [
        '+11234567890',
        '+12345678901',
        '+19876543210'
      ];

      validNumbers.forEach(number => {
        expect(Subscriber.isValidPhoneNumber(number)).toBe(true);
      });
    });

    it('should reject international phone numbers', () => {
      const invalidNumbers = [
        '+441234567890',  // UK
        '+33123456789',   // France
        '+8613800138000', // China
        '+919876543210'   // India
      ];

      invalidNumbers.forEach(number => {
        expect(Subscriber.isValidPhoneNumber(number)).toBe(false);
      });
    });

    it('should reject malformed phone numbers', () => {
      const malformedNumbers = [
        '1234567890',     // No country code
        '+1123456789',    // Too short
        '+112345678901',  // Too long
        '+1abc1234567',   // Contains letters
        '+1-123-456-7890' // Contains hyphens
      ];

      malformedNumbers.forEach(number => {
        expect(Subscriber.isValidPhoneNumber(number)).toBe(false);
      });
    });
  });

  describe('subscriber creation', () => {
    it('should create a new subscriber with valid phone number', () => {
      const phoneNumber = '+11234567890';
      const subscriber = Subscriber.create(phoneNumber);

      expect(subscriber.phoneNumber).toBe(phoneNumber);
      expect(subscriber.isActive).toBe(true);
      expect(subscriber.joinedAt).toBeInstanceOf(Date);
      expect(subscriber.id).toBeDefined();
    });

    it('should throw error when creating subscriber with invalid phone number', () => {
      const invalidNumber = '+441234567890';
      
      expect(() => {
        Subscriber.create(invalidNumber);
      }).toThrow('Invalid US phone number');
    });
  });

  describe('subscriber operations', () => {
    let subscriber: Subscriber;

    beforeEach(() => {
      subscriber = Subscriber.create('+11234567890');
    });

    it('should deactivate subscriber', () => {
      subscriber.deactivate();
      expect(subscriber.isActive).toBe(false);
    });

    it('should reactivate subscriber', () => {
      subscriber.deactivate();
      subscriber.activate();
      expect(subscriber.isActive).toBe(true);
    });

    it('should format phone number for display', () => {
      expect(subscriber.formattedPhoneNumber).toBe('(123) 456-7890');
    });

    it('should set slack thread timestamp', () => {
      const threadTs = '1234567890.123456';
      subscriber.setSlackThreadTs(threadTs);
      expect(subscriber.slackThreadTs).toBe(threadTs);
    });
  });

  describe('subscriber equality', () => {
    it('should be equal when phone numbers match', () => {
      const subscriber1 = Subscriber.create('+11234567890');
      const subscriber2 = Subscriber.create('+11234567890');
      
      expect(subscriber1.equals(subscriber2)).toBe(true);
    });

    it('should not be equal when phone numbers differ', () => {
      const subscriber1 = Subscriber.create('+11234567890');
      const subscriber2 = Subscriber.create('+19876543210');
      
      expect(subscriber1.equals(subscriber2)).toBe(false);
    });
  });
});