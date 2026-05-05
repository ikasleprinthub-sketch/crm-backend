
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const records = await prisma.attendance.findMany({
    orderBy: { date: 'desc' },
    take: 10,
    select: {
      id: true,
      userId: true,
      date: true,
      status: true,
      checkIn: true,
      checkOut: true
    }
  });
  console.log('Recent Attendance Records:');
  console.log(JSON.stringify(records, null, 2));
  
  const now = new Date();
  console.log('Current Server Time:', now.toISOString());
  console.log('Current Server Local Date:', now.toString());
  
  await prisma.$disconnect();
}

check();
