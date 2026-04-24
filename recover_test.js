const { PrismaClient } = require('./src/generated/client');
const fs = require('fs');

async function checkOldDb() {
  const oldDbPath = 'C:/Users/Hideyuki Naganuma/OneDrive/Desktop/tools/tax-affairs-for-blue-return/prisma/prisma/dev.db';
  if (!fs.existsSync(oldDbPath)) {
    console.log('Old database not found at:', oldDbPath);
    return;
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${oldDbPath}`
      }
    }
  });

  try {
    console.log('Checking old database integrity...');
    const integrity = await prisma.$queryRawUnsafe('PRAGMA integrity_check;');
    console.log('Integrity:', integrity);

    console.log('Attempting to fetch some counts...');
    const accounts = await prisma.account.count();
    const journalEntries = await prisma.journalEntry.count();
    const transactions = await prisma.transaction.count();
    
    console.log(`Summary: Accounts=${accounts}, Entries=${journalEntries}, Transactions=${transactions}`);
  } catch (error) {
    console.error('Failed to read old database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkOldDb();
