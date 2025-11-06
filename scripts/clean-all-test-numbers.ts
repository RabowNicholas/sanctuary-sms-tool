// Clean ALL test numbers from production database in batches
import { config } from 'dotenv';
import { PrismaClient } from '@/generated/prisma';

config();

async function cleanAllTestNumbers() {
  const prisma = new PrismaClient();

  try {
    console.log('🧹 Cleaning ALL test phone numbers from database...\n');

    // Delete all subscribers with test number patterns in batches
    let totalDeleted = 0;
    let batchSize = 100;
    
    while (true) {
      // Find a batch of test numbers
      const testSubscribers = await prisma.subscriber.findMany({
        where: {
          OR: [
            { phoneNumber: { startsWith: '+1555' } },  // 555 area code
            { phoneNumber: { startsWith: '+1556' } },  // 556 area code  
            { phoneNumber: { startsWith: '+1557' } },  // 557 area code
          ]
        },
        take: batchSize,
        include: {
          _count: {
            select: { messages: true },
          },
        },
      });

      if (testSubscribers.length === 0) {
        break; // No more test numbers
      }

      console.log(`🗑️  Deleting batch of ${testSubscribers.length} test numbers...`);

      // Delete messages first, then subscribers
      for (const subscriber of testSubscribers) {
        try {
          // Delete messages for this subscriber
          await prisma.message.deleteMany({
            where: { phoneNumber: subscriber.phoneNumber },
          });

          // Delete the subscriber
          await prisma.subscriber.delete({
            where: { id: subscriber.id },
          });

          totalDeleted++;
          
          if (totalDeleted % 50 === 0) {
            console.log(`   Progress: ${totalDeleted} deleted so far...`);
          }
        } catch (error: any) {
          console.log(`   ❌ Failed to delete ${subscriber.phoneNumber}: ${error.message}`);
        }
      }
    }

    // Show final state
    const remainingSubscribers = await prisma.subscriber.findMany({
      orderBy: { joinedAt: 'desc' },
    });

    console.log(`\n🎉 Cleanup complete!`);
    console.log(`   Total test numbers deleted: ${totalDeleted}`);
    console.log(`   Remaining subscribers: ${remainingSubscribers.length}`);
    
    if (remainingSubscribers.length > 0) {
      console.log('\n📱 Remaining subscribers (first 10):');
      remainingSubscribers.slice(0, 10).forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.phoneNumber} (${sub.isActive ? 'Active' : 'Inactive'})`);
      });
      if (remainingSubscribers.length > 10) {
        console.log(`   ... and ${remainingSubscribers.length - 10} more`);
      }
    } else {
      console.log('\n✅ Database is completely clean - ready for TRIBE CSV import!');
    }

    console.log('\n📋 Summary:');
    console.log(`   Test patterns cleaned: +1555*, +1556*, +1557*`);
    console.log(`   Database ready for production import`);
    console.log(`   Max import limit: 5000 contacts`);

  } catch (error: any) {
    console.error('❌ Cleanup failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanAllTestNumbers();