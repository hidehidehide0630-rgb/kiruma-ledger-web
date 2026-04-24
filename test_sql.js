const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/Users/Hideyuki Naganuma/OneDrive/Desktop/tools/tax-affairs-for-blue-return/prisma/prisma/dev_v2.db'
    }
  }
});

async function main() {
  const year = 2026;
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31`);

  console.log(`Checking for ${year}...`);
  console.log(`Start: ${startDate.toISOString()}`);
  console.log(`End: ${endDate.toISOString()}`);

  const entries = await prisma.$queryRaw`
    SELECT 
      JournalEntry.amount, 
      "Transaction".description, 
      Account.name as accountName,
      "Transaction".date
    FROM JournalEntry
    JOIN "Transaction" ON JournalEntry.transactionId = "Transaction".id
    JOIN Account ON JournalEntry.accountId = Account.id
    WHERE (JournalEntry.tag = '源泉徴収税' 
           OR (Account.name = '事業主貸' AND "Transaction".description LIKE '%源泉%'))
    AND "Transaction".isDeleted = false
  `;

  console.log(`Found ${entries.length} entries:`);
  entries.forEach(e => {
    console.log(`- ${e.description}: ${e.accountName} ¥${e.amount} [Date: ${e.date}]`);
  });
}

main().finally(() => prisma.$disconnect());
