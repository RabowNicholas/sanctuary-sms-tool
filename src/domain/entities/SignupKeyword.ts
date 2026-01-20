export class SignupKeyword {
  public readonly id: string;
  public keyword: string;
  public autoResponse: string;
  public isActive: boolean;
  public listId: string | null;
  public readonly createdAt: Date;

  private constructor(
    id: string,
    keyword: string,
    autoResponse: string,
    isActive: boolean = true,
    listId: string | null = null,
    createdAt: Date = new Date()
  ) {
    this.id = id;
    this.keyword = keyword.toUpperCase();
    this.autoResponse = autoResponse;
    this.isActive = isActive;
    this.listId = listId;
    this.createdAt = createdAt;
  }

  static create(keyword: string, autoResponse: string, listId?: string): SignupKeyword {
    if (!keyword || keyword.trim().length === 0) {
      throw new Error('Keyword cannot be empty');
    }
    if (!autoResponse || autoResponse.trim().length === 0) {
      throw new Error('Auto response message cannot be empty');
    }

    const id = this.generateId();
    return new SignupKeyword(id, keyword.toUpperCase(), autoResponse, true, listId || null);
  }

  static fromPersistence(
    id: string,
    keyword: string,
    autoResponse: string,
    isActive: boolean,
    listId: string | null,
    createdAt: Date
  ): SignupKeyword {
    return new SignupKeyword(id, keyword, autoResponse, isActive, listId, createdAt);
  }

  private static generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }

  setAutoResponse(message: string): void {
    if (!message || message.trim().length === 0) {
      throw new Error('Auto response message cannot be empty');
    }
    this.autoResponse = message;
  }

  setListId(listId: string | null): void {
    this.listId = listId;
  }

  matches(input: string): boolean {
    return input.trim().toUpperCase() === this.keyword;
  }
}
