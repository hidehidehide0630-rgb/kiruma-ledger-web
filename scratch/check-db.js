
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.ingredientMaster.count();
  console.log('IngredientMaster count:', count);
  const samples = await prisma.ingredientMaster.findMany({ take: 5 });
  console.log('Samples:', JSON.stringify(samples, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
