import { CostCalculator } from '@/infrastructure/cost/CostCalculator';

describe('CostCalculator', () => {
  let calculator: CostCalculator;

  beforeEach(() => {
    calculator = new CostCalculator();
  });

  describe('calculateSegments', () => {
    it('should calculate 1 segment for messages up to 160 characters', () => {
      const testCases = [
        { message: 'Hello', expected: 1 },
        { message: 'A'.repeat(160), expected: 1 },
        { message: '', expected: 1 }, // Empty message still counts as 1 segment
      ];

      testCases.forEach(({ message, expected }) => {
        expect(calculator.calculateSegments(message)).toBe(expected);
      });
    });

    it('should calculate 2 segments for messages 161-320 characters', () => {
      const testCases = [
        { message: 'A'.repeat(161), expected: 2 },
        { message: 'A'.repeat(200), expected: 2 },
        { message: 'A'.repeat(320), expected: 2 },
      ];

      testCases.forEach(({ message, expected }) => {
        expect(calculator.calculateSegments(message)).toBe(expected);
      });
    });

    it('should calculate 3 segments for messages 321-480 characters', () => {
      const testCases = [
        { message: 'A'.repeat(321), expected: 3 },
        { message: 'A'.repeat(400), expected: 3 },
        { message: 'A'.repeat(480), expected: 3 },
      ];

      testCases.forEach(({ message, expected }) => {
        expect(calculator.calculateSegments(message)).toBe(expected);
      });
    });

    it('should handle very long messages', () => {
      expect(calculator.calculateSegments('A'.repeat(1000))).toBe(7); // 1000 / 160 = 6.25, rounded up to 7
    });

    it('should handle unicode characters correctly', () => {
      const unicodeMessage = '👋 Hello! 🌟'; // Unicode characters may take more space
      const segments = calculator.calculateSegments(unicodeMessage);
      expect(segments).toBeGreaterThanOrEqual(1);
    });
  });

  describe('calculateBroadcastCost', () => {
    it('should calculate cost for single segment broadcast', () => {
      const message = 'Hello subscribers!';
      const subscriberCount = 1500;
      
      const cost = calculator.calculateBroadcastCost(message, subscriberCount);
      
      // 1 segment × 1500 subscribers × $0.0083 = $12.45
      expect(cost).toBeCloseTo(12.45, 2);
    });

    it('should calculate cost for multi-segment broadcast', () => {
      const message = 'A'.repeat(320); // 2 segments
      const subscriberCount = 1000;
      
      const cost = calculator.calculateBroadcastCost(message, subscriberCount);
      
      // 2 segments × 1000 subscribers × $0.0083 = $16.60
      expect(cost).toBeCloseTo(16.60, 2);
    });

    it('should calculate cost for zero subscribers', () => {
      const message = 'Hello!';
      const subscriberCount = 0;
      
      const cost = calculator.calculateBroadcastCost(message, subscriberCount);
      
      expect(cost).toBe(0);
    });

    it('should handle large subscriber counts', () => {
      const message = 'Newsletter update';
      const subscriberCount = 50000;
      
      const cost = calculator.calculateBroadcastCost(message, subscriberCount);
      
      // 1 segment × 50000 subscribers × $0.0083 = $415.00
      expect(cost).toBeCloseTo(415.00, 2);
    });
  });

  describe('getSMSPricing', () => {
    it('should return current SMS pricing information', () => {
      const pricing = calculator.getSMSPricing();
      
      expect(pricing).toEqual({
        costPerSegment: 0.0083,
        segmentLength: 160,
        currency: 'USD',
      });
    });
  });

  describe('calculateMonthlyCost', () => {
    it('should calculate monthly cost for weekly broadcasts', () => {
      const messageLength = 150; // 1 segment
      const subscriberCount = 1500;
      const broadcastsPerMonth = 4; // weekly
      
      const monthlyCost = calculator.calculateMonthlyCost(
        messageLength,
        subscriberCount,
        broadcastsPerMonth
      );
      
      // 1 segment × 1500 × $0.0083 × 4 = $49.80
      expect(monthlyCost).toBeCloseTo(49.80, 2);
    });

    it('should calculate monthly cost for daily broadcasts', () => {
      const messageLength = 80;
      const subscriberCount = 500;
      const broadcastsPerMonth = 30;
      
      const monthlyCost = calculator.calculateMonthlyCost(
        messageLength,
        subscriberCount,
        broadcastsPerMonth
      );
      
      // 1 segment × 500 × $0.0083 × 30 = $124.50
      expect(monthlyCost).toBeCloseTo(124.50, 2);
    });
  });

  describe('getCostBreakdown', () => {
    it('should provide detailed cost breakdown', () => {
      const message = 'A'.repeat(200); // 2 segments
      const subscriberCount = 1000;
      
      const breakdown = calculator.getCostBreakdown(message, subscriberCount);
      
      expect(breakdown).toEqual({
        message: message,
        characterCount: 200,
        segmentCount: 2,
        subscriberCount: 1000,
        costPerSegment: 0.0083,
        totalCost: 16.60,
        costPerSubscriber: 0.0166,
      });
    });

    it('should handle edge cases in breakdown', () => {
      const message = '';
      const subscriberCount = 0;
      
      const breakdown = calculator.getCostBreakdown(message, subscriberCount);
      
      expect(breakdown.segmentCount).toBe(1);
      expect(breakdown.totalCost).toBe(0);
      expect(breakdown.costPerSubscriber).toBe(0);
    });
  });

  describe('estimateWithGrowth', () => {
    it('should estimate costs with subscriber growth', () => {
      const baseMessage = 'Monthly update';
      const currentSubscribers = 1000;
      const monthlyGrowthRate = 0.1; // 10% growth
      const months = 6;
      const broadcastsPerMonth = 4;
      
      const estimates = calculator.estimateWithGrowth(
        baseMessage,
        currentSubscribers,
        monthlyGrowthRate,
        months,
        broadcastsPerMonth
      );
      
      expect(estimates).toHaveLength(6);
      expect(estimates[0].subscriberCount).toBe(1000);
      expect(estimates[5].subscriberCount).toBeCloseTo(1611, 0); // 1000 * 1.1^5
      expect(estimates[0].monthlyCost).toBeCloseTo(33.20, 2);
      expect(estimates[5].monthlyCost).toBeGreaterThan(estimates[0].monthlyCost);
    });
  });
});