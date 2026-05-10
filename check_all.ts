import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const recipes = await prisma.recipe.findMany();
  recipes.forEach(r => {
    try {
      const ing = JSON.parse(r.ingredients);
      ing.forEach((i: any) => {
        if (!i.price) {
          console.log(' -> NO PRICE for ingredient:', i.name, 'in recipe:', r.name);
        }
      });
    } catch(e) {
      console.log(' -> ERROR PARSING:', r.name);
    }
  });
}
main().catch(console.error).finally(()=>prisma.$disconnect());
