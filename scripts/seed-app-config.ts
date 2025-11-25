import { PrismaClient } from '../src/generated/prisma';

async function main() {
  const prisma = new PrismaClient();

  try {
    const config = await prisma.appConfig.upsert({
      where: { id: 'config' },
      update: {
        welcomeMessage: 'Welcome to SANCTUARY!',
      },
      create: {
        id: 'config',
        optInKeyword: 'TRIBE',
        autoResponse: "Welcome! You're subscribed. Reply STOP to unsubscribe.",
        alreadySubbed: "You're already in the tribe!",
        welcomeMessage: 'Welcome to SANCTUARY!',
      },
    });

    console.log('✅ AppConfig seeded:', config);
  } catch (error) {
    console.error('❌ Error seeding AppConfig:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
