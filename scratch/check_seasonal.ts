import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const currentMonth = new Date().getMonth() + 1;
  console.log(`Current Month: ${currentMonth}`);
  
  const allIngredients = await prisma.ingredientMaster.findMany();
  console.log(`Total Ingredients in Master: ${allIngredients.length}`);
  
  const seasonal = await prisma.ingredientMaster.findMany({
    where: {
      seasonalMonths: {
        has: currentMonth
      }
    }
  });
  
  console.log(`Seasonal Ingredients for Month ${currentMonth}: ${seasonal.length}`);
  seasonal.forEach(i => {
    console.log(`- ${i.name} (${i.category}) - Vitality: ${i.isVitality}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
