import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('Checking attendance for date:', today);
    const count = await prisma.attendance.count();
    console.log('Total attendance records:', count);
    const first = await prisma.attendance.findFirst();
    console.log('First record:', first);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
