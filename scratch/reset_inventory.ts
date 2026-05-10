import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.inventory.deleteMany({});
  console.log(`Deleted ${deleted.count} inventory items.`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
