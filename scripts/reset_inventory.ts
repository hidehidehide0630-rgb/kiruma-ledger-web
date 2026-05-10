import { prisma } from '../src/lib/prisma';

async function main() {
  await prisma.inventory.deleteMany({});
  console.log('Inventory table has been successfully reset.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
