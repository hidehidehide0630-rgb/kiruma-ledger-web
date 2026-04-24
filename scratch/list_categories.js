const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const categories = await prisma.householdCategory.findMany();
    console.log('--- Categories ---');
    console.log(JSON.stringify(categories, null, 2));
    
    const budgets = await prisma.householdBudget.findMany();
    console.log('--- Budgets ---');
    console.log(JSON.stringify(budgets, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
