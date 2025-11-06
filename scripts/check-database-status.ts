// Check database status without making changes
import { config } from 'dotenv';
import { PrismaClient } from '@/generated/prisma';

config();

async function checkDatabaseStatus() {
  const prisma = new PrismaClient();

  try {
    console.log('📊 Database Status Check...\n');

    const subscribers = await prisma.subscriber.findMany({
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    const totalMessages = await prisma.message.count();

    console.log(`📈 Current Database State:`);
    console.log(`   Total subscribers: ${subscribers.length}`);
    console.log(`   Total messages: ${totalMessages}`);
    
    const activeCount = subscribers.filter(s => s.isActive).length;
    const inactiveCount = subscribers.filter(s => !s.isActive).length;
    
    console.log(`   Active subscribers: ${activeCount}`);
    console.log(`   Inactive subscribers: ${inactiveCount}`);

    // Check for test numbers
    const testNumbers = subscribers.filter(s => 
      s.phoneNumber.startsWith('+1555') || 
      s.phoneNumber.startsWith('+1556') || 
      s.phoneNumber.startsWith('+1557') ||
      s.phoneNumber.startsWith('+1999') ||
      s.phoneNumber.startsWith('+1998')
    );

    if (testNumbers.length > 0) {
      console.log(`\n⚠️  Test Numbers Found: ${testNumbers.length}`);
      console.log('   These should be cleaned before production import');
    } else {
      console.log('\n✅ No test numbers found - database is clean');
    }

    // Show recent subscribers (non-test numbers only)
    const realSubscribers = subscribers.filter(s => 
      !s.phoneNumber.startsWith('+1555') && 
      !s.phoneNumber.startsWith('+1556') && 
      !s.phoneNumber.startsWith('+1557') &&
      !s.phoneNumber.startsWith('+1999') &&
      !s.phoneNumber.startsWith('+1998')
    );

    if (realSubscribers.length > 0) {
      console.log(`\n📱 Real Subscribers (${realSubscribers.length}):`);
      realSubscribers.slice(0, 5).forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.phoneNumber} (${sub.isActive ? 'Active' : 'Inactive'}) - ${sub._count.messages} messages`);
      });
      if (realSubscribers.length > 5) {
        console.log(`   ... and ${realSubscribers.length - 5} more`);
      }
    }

    console.log('\n🎯 TRIBE CSV Import Readiness:');
    console.log(`   Import limit: 5000 contacts`);
    console.log(`   TRIBE CSV active contacts: 1684`);
    console.log(`   Status: ${testNumbers.length === 0 ? '✅ Ready' : '⚠️  Clean test numbers first'}`);

  } catch (error: any) {
    console.error('❌ Database check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkDatabaseStatus();