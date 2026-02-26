import { prisma } from '../lib/prisma';
import { randomBytes } from 'crypto';
import path from 'path';
import dotenv from 'dotenv';

// Load env from apps/api/.env so script can run from repo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

function makeCode() {
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `NW-${rand}`;
}

async function generateUniqueAccountCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = makeCode();
    const existing = await prisma.user.findUnique({ where: { accountCode: code } });
    if (!existing) return code;
  }
  return `NW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
}

async function main() {
  const users = await prisma.user.findMany({ where: { accountCode: null } });
  console.log(`Users without accountCode: ${users.length}`);

  for (const user of users) {
    const code = await generateUniqueAccountCode();
    await prisma.user.update({ where: { id: user.id }, data: { accountCode: code } });
    console.log(`Set accountCode for ${user.username}: ${code}`);
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
