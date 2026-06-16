import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const technicians = await prisma.user.findMany({
    where: {
      role: 'technician',
    },
    select: {
      id: true,
      name: true,
      email: true,
      isAvailable: true,
      isApproved: true,
      currentLocationLat: true,
      currentLocationLng: true,
    },
  });

  console.log('All Technicians:', JSON.stringify(technicians, null, 2));
  
  const available = technicians.filter(t => t.isAvailable && t.isApproved);
  console.log('\nAvailable Technicians Count:', available.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
