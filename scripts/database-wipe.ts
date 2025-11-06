// Complete database wipe for testing - removes ALL subscribers and messages
import { config } from 'dotenv';
import { PrismaClient } from '@/generated/prisma';

config();

async function wipeDatabase(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    console.log('🧹 Complete Database Wipe Starting...\n');

    // Get current state
    const [currentSubscribers, currentMessages] = await Promise.all([
      prisma.subscriber.count(),
      prisma.message.count(),
    ]);

    console.log('📊 Current Database State:');
    console.log(`   Subscribers: ${currentSubscribers}`);
    console.log(`   Messages: ${currentMessages}\n`);

    console.log('⚠️  WARNING: This will DELETE ALL DATA!');
    console.log('   • All subscribers will be removed');
    console.log('   • All messages will be removed');
    console.log('   • This action CANNOT be undone\n');

    // Delete all messages first (due to foreign key constraints)
    console.log('🗑️  Deleting all messages...');
    const deletedMessages = await prisma.message.deleteMany({});
    console.log(`✅ Deleted ${deletedMessages.count} messages`);

    // Delete all subscribers
    console.log('🗑️  Deleting all subscribers...');
    const deletedSubscribers = await prisma.subscriber.deleteMany({});
    console.log(`✅ Deleted ${deletedSubscribers.count} subscribers`);

    // Verify cleanup
    const [finalSubscribers, finalMessages] = await Promise.all([
      prisma.subscriber.count(),
      prisma.message.count(),
    ]);

    console.log('\n📊 Final Database State:');
    console.log(`   Subscribers: ${finalSubscribers}`);
    console.log(`   Messages: ${finalMessages}`);

    if (finalSubscribers === 0 && finalMessages === 0) {
      console.log('\n✅ Database successfully wiped clean!');
      console.log('🚀 Ready for fresh testing with only your phone number');
    } else {
      console.log('\n⚠️  Warning: Some data may remain');
    }

  } catch (error: any) {
    console.error('❌ Database wipe failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the wipe
if (require.main === module) {
  wipeDatabase().catch(console.error);
}

export { wipeDatabase };