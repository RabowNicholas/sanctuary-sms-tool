import { PrismaClient } from '@/generated/prisma';

export class PrismaAppConfigRepository {
  constructor(private prisma: PrismaClient) {}

  async getWelcomeMessage(): Promise<string> {
    const config = await this.prisma.appConfig.findUnique({
      where: { id: 'config' },
    });

    if (!config) {
      // Return default if config doesn't exist
      return 'Welcome to SANCTUARY!';
    }

    return config.welcomeMessage;
  }

  async updateWelcomeMessage(message: string): Promise<void> {
    await this.prisma.appConfig.upsert({
      where: { id: 'config' },
      update: { welcomeMessage: message },
      create: {
        id: 'config',
        optInKeyword: 'TRIBE',
        autoResponse: "Welcome! You're subscribed. Reply STOP to unsubscribe.",
        alreadySubbed: "You're already in the tribe!",
        welcomeMessage: message,
      },
    });
  }

  async getConfig() {
    return await this.prisma.appConfig.findUnique({
      where: { id: 'config' },
    });
  }
}
