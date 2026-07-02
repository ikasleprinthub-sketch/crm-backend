import { prisma } from './src/lib/prisma';
import jwt from 'jsonwebtoken';

async function main() {
  const user = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!user) {
    console.log("No SUPER_ADMIN found.");
    return;
  }
  
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  
  try {
    const res = await fetch('http://localhost:5000/api/attendance/permission/team', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data: any = await res.json();
    console.log(`SUPER_ADMIN Response Length: ${data?.data?.length}`);
    console.log(`SUPER_ADMIN Full Data:`, JSON.stringify(data));
  } catch (e: any) {
    console.error("Error fetching as SUPER_ADMIN:", e.message);
  }
  
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (admin) {
    const token2 = jwt.sign({ id: admin.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    try {
      const res = await fetch('http://localhost:5000/api/attendance/permission/team', {
        headers: { Authorization: `Bearer ${token2}` }
      });
      const data: any = await res.json();
      console.log(`ADMIN Response Length: ${data?.data?.length}`);
    } catch (e: any) {
      console.error("Error fetching as ADMIN:", e.message);
    }
  }

  const manager = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
  if (manager) {
    const token3 = jwt.sign({ id: manager.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    try {
      const res = await fetch('http://localhost:5000/api/attendance/permission/team', {
        headers: { Authorization: `Bearer ${token3}` }
      });
      const data: any = await res.json();
      console.log(`MANAGER Response Length: ${data?.data?.length}`);
    } catch (e: any) {
      console.error("Error fetching as MANAGER:", e.message);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
