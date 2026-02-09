import { PrismaClient, LicenseTier } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tier = LicenseTier.CEO;
  const key = `NW-${tier}-${Date.now().toString(36).toUpperCase()}-MASTER`;
  
  await prisma.license.create({
    data: {
      key,
      tier,
      isActive: true
    }
  });

  console.log('====================================');
  console.log('🚀 MASTER CEO KEY GENERATED');
  console.log(`KEY: ${key}`);
  console.log('Use this key during registration or in the License Hub.');
  console.log('====================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
