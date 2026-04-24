const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking database connection...');
    const result = await prisma.$queryRaw`PRAGMA integrity_check;`;
    console.log('Integrity Check Result:', result);
    
    const count = await prisma.account.count();
    console.log('Account count:', count);
  } catch (error) {
    console.error('Database Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
