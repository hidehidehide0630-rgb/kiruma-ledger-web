import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting inventory and related data...');
  
  // 依存関係を考慮して削除
  await prisma.shoppingItem.deleteMany({});
  await prisma.mealPlan.deleteMany({});
  await prisma.recipe.deleteMany({});
  await prisma.shoppingList.deleteMany({});
  await prisma.inventory.deleteMany({});
  
  console.log('Reset complete. Inventory is now empty.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
