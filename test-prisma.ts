import { prisma } from './src/lib/prisma';

async function main() {
  const all = await prisma.attendance.findMany({
    where: { permission: { not: 'NONE' } }
  });
  console.log("All non-NONE:", all.length);
  const pending = await prisma.attendance.findMany({
    where: { permission: 'PENDING' }
  });
  console.log("Pending:", pending.length);
  const approved = await prisma.attendance.findMany({
    where: { permission: 'APPROVED' }
  });
  console.log("Approved:", approved.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
