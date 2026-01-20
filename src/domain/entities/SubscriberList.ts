export interface ListMembership {
  subscriberId: string;
  joinedAt: Date;
  joinedVia: string | null;
}

export class SubscriberList {
  public readonly id: string;
  public name: string;
  public description: string | null;
  public readonly createdAt: Date;
  private _memberCount: number;

  private constructor(
    id: string,
    name: string,
    description: string | null = null,
    createdAt: Date = new Date(),
    memberCount: number = 0
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.createdAt = createdAt;
    this._memberCount = memberCount;
  }

  static create(name: string, description?: string): SubscriberList {
    if (!name || name.trim().length === 0) {
      throw new Error('List name cannot be empty');
    }

    const id = this.generateId();
    return new SubscriberList(id, name.trim(), description?.trim() || null);
  }

  static fromPersistence(
    id: string,
    name: string,
    description: string | null,
    createdAt: Date,
    memberCount: number = 0
  ): SubscriberList {
    return new SubscriberList(id, name, description, createdAt, memberCount);
  }

  private static generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  get memberCount(): number {
    return this._memberCount;
  }

  setMemberCount(count: number): void {
    this._memberCount = count;
  }

  setName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('List name cannot be empty');
    }
    this.name = name.trim();
  }

  setDescription(description: string | null): void {
    this.description = description?.trim() || null;
  }
}
