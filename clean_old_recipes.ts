import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.mealPlan.deleteMany();
  await prisma.recipe.deleteMany({
    where: { id: { startsWith: 'rec0' } }
  });
  console.log('Cleaned up meal plans and old recipes');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
