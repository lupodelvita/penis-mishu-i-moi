import { PrismaClient, LicenseTier } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tier = LicenseTier.CEO;
  
  // 1. Delete previous MASTER keys for CEO (to prevent clutter/security leak)
  const deleted = await prisma.license.deleteMany({
    where: {
      tier: tier,
      key: {
        contains: 'MASTER'
      }
    }
  });
  
  console.log(`🧹 Deleted ${deleted.count} old master key(s).`);

  // 2. Generate new one
  const key = `NW-${tier}-${Date.now().toString(36).toUpperCase()}-MASTER`;
  
  await prisma.license.create({
    data: {
      key,
      tier,
      isActive: true
    }
  });

  console.log('====================================');
  console.log('🚀 NEW MASTER CEO KEY GENERATED');
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
