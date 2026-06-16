import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Delete seed technicians (those with seed IDs)
  const result = await prisma.user.deleteMany({
    where: {
      id: {
        in: ['tech-seed-1', 'tech-seed-2', 'tech-seed-3']
      }
    }
  });

  console.log(`Deleted ${result.count} seed technicians`);
  
  // Verify remaining technicians
  const remaining = await prisma.user.findMany({
    where: { role: 'technician' },
    select: {
      id: true,
      name: true,
      email: true,
      isAvailable: true,
    },
  });
  
  console.log('Remaining technicians:', JSON.stringify(remaining, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
