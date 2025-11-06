export class Subscriber {
  public readonly id: string;
  public readonly phoneNumber: string;
  public isActive: boolean;
  public readonly joinedAt: Date;
  public slackThreadTs?: string;

  private constructor(
    id: string,
    phoneNumber: string,
    isActive: boolean = true,
    joinedAt: Date = new Date(),
    slackThreadTs?: string
  ) {
    this.id = id;
    this.phoneNumber = phoneNumber;
    this.isActive = isActive;
    this.joinedAt = joinedAt;
    this.slackThreadTs = slackThreadTs;
  }

  static isValidPhoneNumber(phoneNumber: string): boolean {
    // US phone number format: +1XXXXXXXXXX (11 digits total)
    const usPhoneRegex = /^\+1\d{10}$/;
    return usPhoneRegex.test(phoneNumber);
  }

  static formatPhoneNumber(phoneNumber: string): string {
    // Format +11234567890 to (123) 456-7890
    if (phoneNumber.startsWith('+1') && phoneNumber.length === 12) {
      const cleaned = phoneNumber.replace('+1', '');
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phoneNumber;
  }

  static create(phoneNumber: string): Subscriber {
    if (!this.isValidPhoneNumber(phoneNumber)) {
      throw new Error('Invalid US phone number');
    }

    const id = this.generateId();
    return new Subscriber(id, phoneNumber);
  }

  static fromPersistence(
    id: string,
    phoneNumber: string,
    isActive: boolean,
    joinedAt: Date,
    slackThreadTs?: string
  ): Subscriber {
    return new Subscriber(id, phoneNumber, isActive, joinedAt, slackThreadTs);
  }

  private static generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  deactivate(): void {
    this.isActive = false;
  }

  activate(): void {
    this.isActive = true;
  }

  get formattedPhoneNumber(): string {
    // Format +11234567890 to (123) 456-7890
    const cleaned = this.phoneNumber.replace('+1', '');
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  setSlackThreadTs(threadTs: string): void {
    this.slackThreadTs = threadTs;
  }

  equals(other: Subscriber): boolean {
    return this.phoneNumber === other.phoneNumber;
  }
}