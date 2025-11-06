// Clean up test phone numbers from production database
import { config } from 'dotenv';
import { PrismaClient } from '@/generated/prisma';

config();

async function cleanTestNumbers() {
  const prisma = new PrismaClient();

  try {
    console.log('🧹 Cleaning test phone numbers from database...\n');

    // Common test number patterns
    const testPatterns = [
      '+1555', // 555 area code (common test numbers)
      '+15551112222', // Specific test number from our tests
      '+15553334444', // Bulk import test number
      '+15555556666', // Bulk import test number  
      '+15557778888', // Bulk import test number
    ];

    // First, let's see what's currently in the database
    const allSubscribers = await prisma.subscriber.findMany({
      orderBy: { joinedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    console.log(`📊 Current database state:`);
    console.log(`   Total subscribers: ${allSubscribers.length}`);
    
    if (allSubscribers.length > 0) {
      console.log('\n📱 Current subscribers:');
      allSubscribers.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.phoneNumber} (${sub.isActive ? 'Active' : 'Inactive'}) - ${sub._count.messages} messages`);
      });
    }

    // Identify test numbers
    const testNumbers = allSubscribers.filter(sub => 
      testPatterns.some(pattern => sub.phoneNumber.startsWith(pattern))
    );

    if (testNumbers.length === 0) {
      console.log('\n✅ No test numbers found in database!');
      return;
    }

    console.log(`\n🎯 Found ${testNumbers.length} test numbers to delete:`);
    testNumbers.forEach((sub, index) => {
      console.log(`   ${index + 1}. ${sub.phoneNumber} (${sub._count.messages} messages)`);
    });

    // Delete test numbers and their associated messages
    console.log('\n🗑️  Deleting test numbers...');
    
    let deletedCount = 0;
    for (const testSub of testNumbers) {
      try {
        // First delete all messages for this subscriber
        const deletedMessages = await prisma.message.deleteMany({
          where: { phoneNumber: testSub.phoneNumber },
        });
        
        // Then delete the subscriber
        await prisma.subscriber.delete({
          where: { id: testSub.id },
        });
        
        console.log(`   ✅ Deleted ${testSub.phoneNumber} and its ${deletedMessages.count} messages`);
        deletedCount++;
      } catch (error: any) {
        console.log(`   ❌ Failed to delete ${testSub.phoneNumber}: ${error.message}`);
      }
    }

    // Show final state
    const remainingSubscribers = await prisma.subscriber.findMany({
      orderBy: { joinedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    console.log(`\n🎉 Cleanup complete!`);
    console.log(`   Deleted: ${deletedCount} test subscribers`);
    console.log(`   Remaining: ${remainingSubscribers.length} real subscribers`);
    
    if (remainingSubscribers.length > 0) {
      console.log('\n📱 Remaining subscribers:');
      remainingSubscribers.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.phoneNumber} (${sub.isActive ? 'Active' : 'Inactive'}) - ${sub._count.messages} messages`);
      });
    }

  } catch (error: any) {
    console.error('❌ Cleanup failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanTestNumbers();