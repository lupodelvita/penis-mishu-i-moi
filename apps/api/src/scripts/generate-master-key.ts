import { PrismaClient, LicenseTier } from '@prisma/client';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

const VALID_TIERS = Object.values(LicenseTier);

async function main() {
  const arg = process.argv[2]?.toUpperCase() as LicenseTier | undefined;
  const tier: LicenseTier = arg && VALID_TIERS.includes(arg as LicenseTier)
    ? (arg as LicenseTier)
    : LicenseTier.CEO;

  if (arg && !VALID_TIERS.includes(arg as LicenseTier)) {
    console.warn(`⚠️  Unknown tier "${arg}", defaulting to CEO.`);
    console.warn(`   Valid tiers: ${VALID_TIERS.join(', ')}`);
  }

  const key = `NW-${tier}-${Date.now().toString(36).toUpperCase()}-MASTER`;

  await prisma.license.create({
    data: { key, tier, isActive: true }
  });

  console.log('====================================');
  console.log(`🚀 MASTER ${tier} KEY GENERATED`);
  console.log(`KEY: ${key}`);
  console.log('Use this key during registration or in the License Hub.');
  console.log('====================================');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

