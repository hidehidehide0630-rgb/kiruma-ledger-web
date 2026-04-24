const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/Users/Hideyuki Naganuma/OneDrive/Desktop/tools/tax-affairs-for-blue-return/prisma/prisma/dev_v2.db'
    }
  }
});

async function main() {
  const transactionCount = await prisma.transaction.count();
  const entryCount = await prisma.journalEntry.count();
  const accountCount = await prisma.account.count();

  console.log(`Transaction count: ${transactionCount}`);
  console.log(`Entry count: ${entryCount}`);
  console.log(`Account count: ${accountCount}`);
  
  const entries = await prisma.journalEntry.findMany({
    include: { transaction: true, account: true }
  });
  
  console.log('--- ALL ENTRIES ---');
  entries.forEach(e => {
    console.log(`[${e.transaction.date.toISOString()}] ${e.transaction.description}: ${e.account.name} ¥${e.amount} (${e.entryType}) [Tag: ${e.tag}]`);
  });
}

main().finally(() => prisma.$disconnect());
