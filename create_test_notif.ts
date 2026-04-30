import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'superadmin@crm.com' }
  });

  if (!user) {
    console.log('Super Admin user not found. Please run npm run seed first.');
    return;
  }

  const notif = await prisma.notification.create({
    data: {
      userId: user.id,
      title: 'Test Notification',
      message: 'This is a manual test to verify the API is working at ' + new Date().toLocaleTimeString(),
      type: 'TEST',
      isRead: false
    }
  });

  console.log('✅ Created test notification for ' + user.email);
  console.log('ID:', notif.id);
  console.log('Refresh your browser at http://localhost:5000/api/notifications to see it!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
