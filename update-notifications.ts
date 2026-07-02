import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.notification.updateMany({
    where: {
      type: { in: ['PERMISSION_SENT', 'PERMISSION_REQUEST', 'PERMISSION_APPROVED', 'PERMISSION_REJECTED'] },
      link: { startsWith: '/attendance' }
    },
    data: { link: '/permissions' },
  });
  console.log('Updated existing notifications:', updated.count);
}
main().catch(console.error).finally(() => prisma.$disconnect());
