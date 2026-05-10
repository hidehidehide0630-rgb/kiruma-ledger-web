import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const recipes = await prisma.recipe.findMany({
    select: { name: true, ingredients: true, estimatedPrice: true }
  });
  console.log("Recipes count:", recipes.length);
  for (const r of recipes) {
    if (r.name.includes("生姜焼き") || r.name.includes("肉じゃが")) {
       console.log(r.name, r.ingredients);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
