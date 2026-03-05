import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HOME_SITES = [
  { name: 'Carmel Valley', isHomeSite: true },
  { name: 'Robot Garage (Busboom)', isHomeSite: true },
];

const HOST_NAMES = [
  'Babbage', 'Berners-Lee', 'Boole', 'Brin', 'Cerf',
  'Church', 'Dijkstra', 'Euler', 'Gosling', 'Hopper',
  'Kernighan', 'Knuth', 'Lamport', 'Lovelace', 'McCarthy',
  'Minsky', 'Neumann', 'Page', 'Ritchie', 'Shannon',
  'Stallman', 'Stroustrup', 'Thompson', 'Torvalds', 'Turing',
  'Wozniak', 'Zuse',
];

async function main() {
  console.log('Seeding home sites...');
  for (const site of HOME_SITES) {
    await prisma.site.upsert({
      where: { name: site.name },
      update: { isHomeSite: site.isHomeSite },
      create: { name: site.name, isHomeSite: site.isHomeSite },
    });
  }

  console.log('Seeding host names...');
  for (const name of HOST_NAMES) {
    await prisma.hostName.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
