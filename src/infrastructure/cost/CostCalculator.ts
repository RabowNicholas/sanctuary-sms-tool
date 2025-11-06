export interface SMSPricing {
  costPerSegment: number;
  segmentLength: number;
  currency: string;
}

export interface CostBreakdown {
  message: string;
  characterCount: number;
  segmentCount: number;
  subscriberCount: number;
  costPerSegment: number;
  totalCost: number;
  costPerSubscriber: number;
}

export interface GrowthEstimate {
  month: number;
  subscriberCount: number;
  monthlyCost: number;
}

export class CostCalculator {
  private readonly SMS_COST_PER_SEGMENT = 0.0083; // Twilio US SMS cost
  private readonly SMS_SEGMENT_LENGTH = 160; // Standard SMS segment length

  calculateSegments(message: string): number {
    if (message.length === 0) return 1; // Empty message still counts as 1 segment
    return Math.ceil(message.length / this.SMS_SEGMENT_LENGTH);
  }

  calculateBroadcastCost(message: string, subscriberCount: number): number {
    if (subscriberCount === 0) return 0;
    
    const segments = this.calculateSegments(message);
    const totalCost = segments * subscriberCount * this.SMS_COST_PER_SEGMENT;
    
    return Math.round(totalCost * 100) / 100; // Round to 2 decimal places
  }

  getSMSPricing(): SMSPricing {
    return {
      costPerSegment: this.SMS_COST_PER_SEGMENT,
      segmentLength: this.SMS_SEGMENT_LENGTH,
      currency: 'USD',
    };
  }

  calculateMonthlyCost(
    messageLength: number,
    subscriberCount: number,
    broadcastsPerMonth: number
  ): number {
    const segments = Math.ceil(messageLength / this.SMS_SEGMENT_LENGTH);
    const costPerBroadcast = segments * subscriberCount * this.SMS_COST_PER_SEGMENT;
    const monthlyCost = costPerBroadcast * broadcastsPerMonth;
    
    return Math.round(monthlyCost * 100) / 100;
  }

  getCostBreakdown(message: string, subscriberCount: number): CostBreakdown {
    const characterCount = message.length;
    const segmentCount = this.calculateSegments(message);
    const totalCost = this.calculateBroadcastCost(message, subscriberCount);
    const costPerSubscriber = subscriberCount > 0 
      ? Math.round((segmentCount * this.SMS_COST_PER_SEGMENT) * 10000) / 10000 // More precision for rounding
      : 0;

    return {
      message,
      characterCount,
      segmentCount,
      subscriberCount,
      costPerSegment: this.SMS_COST_PER_SEGMENT,
      totalCost,
      costPerSubscriber,
    };
  }

  estimateWithGrowth(
    message: string,
    currentSubscribers: number,
    monthlyGrowthRate: number,
    months: number,
    broadcastsPerMonth: number
  ): GrowthEstimate[] {
    const estimates: GrowthEstimate[] = [];
    const segments = this.calculateSegments(message);
    
    for (let month = 0; month < months; month++) {
      const subscriberCount = Math.round(currentSubscribers * Math.pow(1 + monthlyGrowthRate, month));
      const monthlyCost = this.calculateMonthlyCost(
        message.length,
        subscriberCount,
        broadcastsPerMonth
      );
      
      estimates.push({
        month: month + 1,
        subscriberCount,
        monthlyCost,
      });
    }
    
    return estimates;
  }
}