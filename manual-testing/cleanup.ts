// Cleanup script for removing test data after manual testing
import { config } from 'dotenv';
import { PrismaClient } from '@/generated/prisma';
import readline from 'readline';

config();

interface CleanupOptions {
  phoneNumber?: string;
  deleteAllTestData?: boolean;
  confirmBeforeDelete?: boolean;
}

async function promptForConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function promptForPhoneNumber(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('📱 Enter phone number to remove (+1XXXXXXXXXX): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function cleanupTestData(options: CleanupOptions = {}): Promise<void> {
  const prisma = new PrismaClient();

  try {
    console.log('🧹 Test Data Cleanup\n');

    // Get phone number if not provided
    let phoneNumber = options.phoneNumber;
    if (!phoneNumber && !options.deleteAllTestData) {
      phoneNumber = await promptForPhoneNumber();
    }

    if (options.deleteAllTestData) {
      console.log('⚠️  WARNING: This will delete ALL test data!');
      console.log('   • All subscribers with test phone patterns');
      console.log('   • All associated messages');
      console.log('   • This action cannot be undone');
      
      if (options.confirmBeforeDelete !== false) {
        const confirmed = await promptForConfirmation('\n🗑️  Delete ALL test data?');
        if (!confirmed) {
          console.log('❌ Cleanup cancelled');
          return;
        }
      }

      // Delete all test subscribers and their messages
      const testPatterns = ['+1555%', '+1999%', '+1998%'];
      let totalDeleted = 0;

      for (const pattern of testPatterns) {
        // Delete messages first
        const deletedMessages = await prisma.message.deleteMany({
          where: { phoneNumber: { startsWith: pattern.replace('%', '') } },
        });

        // Delete subscribers
        const deletedSubscribers = await prisma.subscriber.deleteMany({
          where: { phoneNumber: { startsWith: pattern.replace('%', '') } },
        });

        totalDeleted += deletedSubscribers.count;
        console.log(`🗑️  Deleted ${deletedSubscribers.count} subscribers and ${deletedMessages.count} messages for pattern ${pattern}`);
      }

      console.log(`\n✅ Cleanup complete! Removed ${totalDeleted} test subscribers total`);
      
    } else if (phoneNumber) {
      // Delete specific phone number
      console.log(`🔍 Looking for subscriber: ${phoneNumber}`);

      const subscriber = await prisma.subscriber.findUnique({
        where: { phoneNumber },
        include: {
          _count: {
            select: { messages: true },
          },
        },
      });

      if (!subscriber) {
        console.log('❌ Subscriber not found');
        return;
      }

      console.log(`📱 Found subscriber:`);
      console.log(`   ID: ${subscriber.id}`);
      console.log(`   Phone: ${subscriber.phoneNumber}`);
      console.log(`   Status: ${subscriber.isActive ? 'Active' : 'Inactive'}`);
      console.log(`   Messages: ${subscriber._count.messages}`);
      console.log(`   Joined: ${subscriber.joinedAt.toLocaleDateString()}`);

      if (options.confirmBeforeDelete !== false) {
        const confirmed = await promptForConfirmation('\n🗑️  Delete this subscriber and all their messages?');
        if (!confirmed) {
          console.log('❌ Cleanup cancelled');
          return;
        }
      }

      // Delete messages first
      const deletedMessages = await prisma.message.deleteMany({
        where: { phoneNumber },
      });

      // Delete subscriber
      await prisma.subscriber.delete({
        where: { id: subscriber.id },
      });

      console.log(`✅ Deleted subscriber and ${deletedMessages.count} messages`);
    }

    // Show final database state
    const remainingStats = await Promise.all([
      prisma.subscriber.count(),
      prisma.message.count(),
      prisma.subscriber.count({ where: { isActive: true } }),
    ]);

    console.log('\n📊 Database State After Cleanup:');
    console.log(`   Total Subscribers: ${remainingStats[0]}`);
    console.log(`   Active Subscribers: ${remainingStats[2]}`);
    console.log(`   Total Messages: ${remainingStats[1]}`);

    if (remainingStats[0] > 0) {
      const recentSubscribers = await prisma.subscriber.findMany({
        take: 3,
        orderBy: { joinedAt: 'desc' },
        select: { phoneNumber: true, isActive: true, joinedAt: true },
      });

      console.log('\n📱 Recent Subscribers:');
      recentSubscribers.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.phoneNumber} (${sub.isActive ? 'Active' : 'Inactive'})`);
      });
    }

  } catch (error: any) {
    console.error('❌ Cleanup failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function runCleanup(): Promise<void> {
  console.log('🧹 Manual Testing Cleanup Tool\n');
  console.log('This tool helps remove test data after manual testing.\n');

  try {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const choice = await new Promise<string>((resolve) => {
      console.log('🎯 Cleanup Options:');
      console.log('   1. Remove specific phone number');
      console.log('   2. Remove all test data (test patterns)');
      console.log('   3. Exit');
      console.log('');
      rl.question('Select option (1-3): ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    switch (choice) {
      case '1':
        await cleanupTestData({ confirmBeforeDelete: true });
        break;
      case '2':
        await cleanupTestData({ deleteAllTestData: true, confirmBeforeDelete: true });
        break;
      case '3':
        console.log('👋 Cleanup cancelled');
        break;
      default:
        console.log('❌ Invalid option');
        break;
    }

  } catch (error: any) {
    console.error('\n❌ Cleanup error:', error.message);
    console.log('\n💡 Common issues:');
    console.log('   • Database connection problems');
    console.log('   • Invalid phone number format');
    console.log('   • Subscriber not found');
    console.log('\n🔧 Try running health-check.ts first');
  }
}

// Command line interface
if (require.main === module) {
  const phoneArg = process.argv[2];
  const deleteAllFlag = process.argv.includes('--all');
  
  if (deleteAllFlag) {
    cleanupTestData({ deleteAllTestData: true }).catch(console.error);
  } else if (phoneArg) {
    cleanupTestData({ phoneNumber: phoneArg }).catch(console.error);
  } else {
    runCleanup().catch(console.error);
  }
}

export { cleanupTestData, runCleanup };