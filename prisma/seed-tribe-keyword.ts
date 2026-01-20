import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting TRIBE keyword migration...');

  // Check if TRIBE keyword already exists
  const existingKeyword = await prisma.signupKeyword.findUnique({
    where: { keyword: 'TRIBE' },
  });

  if (existingKeyword) {
    console.log('TRIBE keyword already exists, skipping migration.');
    return;
  }

  // Get the welcome message from AppConfig
  const config = await prisma.appConfig.findUnique({
    where: { id: 'config' },
  });

  const welcomeMessage = config?.welcomeMessage || 'Welcome to SANCTUARY!';

  // Create the TRIBE keyword
  const tribeKeyword = await prisma.signupKeyword.create({
    data: {
      keyword: 'TRIBE',
      autoResponse: welcomeMessage,
      isActive: true,
    },
  });

  console.log(`Created TRIBE keyword with ID: ${tribeKeyword.id}`);
  console.log(`Auto-response: ${tribeKeyword.autoResponse}`);
  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
