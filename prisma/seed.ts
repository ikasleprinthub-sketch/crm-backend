import { PrismaClient, Role, Priority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing existing data for a clean start...');

  // Delete in order to avoid foreign key violations
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.taskSOPStep.deleteMany();
  await prisma.task.deleteMany();
  await prisma.sOPStep.deleteMany();
  await prisma.sOPTemplate.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.taskType.deleteMany();
  await prisma.department.deleteMany();
  await prisma.sourceOfLead.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.note.deleteMany();
  await prisma.user.deleteMany();

  console.log('✨ Database cleared.\n');

  console.log('🌱 Starting database seed with Excel data...\n');

  // ─── Passwords ───────────────────────────────────────────────────────────────
  const adminPass = await bcrypt.hash('admin123', 12);
  const managerPass = await bcrypt.hash('manager123', 12);
  const employeePass = await bcrypt.hash('employee123', 12);

  // ─── USERS ──────────────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'superadmin@crm.com',
      password: adminPass,
      role: 'SUPER_ADMIN' as any,
      status: 'ACTIVE' as any,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@crm.com',
      password: adminPass,
      role: 'ADMIN' as any,
      status: 'ACTIVE' as any,
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: 'Team Lead / Manager',
      email: 'manager@crm.com',
      password: managerPass,
      role: 'MANAGER' as any,
      status: 'ACTIVE' as any,
    },
  });

  const employee = await prisma.user.create({
    data: {
      name: 'Employee User',
      email: 'employee@crm.com',
      password: employeePass,
      role: 'EMPLOYEE' as any,
      status: 'ACTIVE' as any,
      managerId: manager.id,
    },
  });
  console.log('✅ 4 Users prepared: superadmin@crm.com, admin@crm.com, manager@crm.com, employee@crm.com');

  // ─── DEPARTMENTS (Major Heads) ───────────────────────────────────────────────
  const departmentsData = [
    'BOOK KEEPING TEAM',
    'GST TEAM',
    'INCOME TAX TEAM',
    'REGISTRATION TEAM',
    'STATUTORY COMPLIANCES TEAM',
    'PRIVATE LIMITED FORMATION TEAM',
    'OTHERS'
  ];

  const depts: Record<string, any> = {};
  for (const name of departmentsData) {
    depts[name] = await prisma.department.create({
      data: { name }
    });
  }
  console.log('✅ Departments created');

  // ─── SOURCES OF LEAD ─────────────────────────────────────────────────────────
  const sourcesData = [
    'WALK IN',
    'CLIENT REFERRAL',
    'CRM',
    'JUST DIAL',
    'INSTAGRAM',
    'YOUTUBE',
    'CONSULTANT',
    'BNI LANDMARK',
    'BNI REFERENCE',
    'MARKETING ACTIVITY',
    'REPEATED BUSINESS'
  ];

  for (const name of sourcesData) {
    await prisma.sourceOfLead.create({
      data: { name }
    });
  }
  console.log('✅ Sources of lead created');

  // ─── TASK TYPES (Sub-Heads) ──────────────────────────────────────────────────
  const taskGroups = [
    {
      dept: 'BOOK KEEPING TEAM',
      tasks: [
        'BOOK-KEEPING SERVICES - DATA ENTRY',
        'BOOK-KEEPING SERVICES - REPORT PREPARATION',
        'BOOK-KEEPING SERVICES - RECONCILIATION',
        'BOOK -KEEPING SERVICES - COMPANY CREATION'
      ]
    },
    {
      dept: 'GST TEAM',
      tasks: [
        'GST REGISTRATION',
        'GST - OTHERS',
        'GSTR - 1 FILING',
        'GSTR - 3B FILING',
        'GSTR - 9 FILING',
        'GSTR - 9C FILING',
        'GSTR- 10 FILING',
        'GST - AUDIT',
        'GST NOTICE ISSUE',
        'GST - SURRENDER',
        'E WAY BILL - OTHERS'
      ]
    },
    {
      dept: 'INCOME TAX TEAM',
      tasks: [
        'INCOME TAX FILING',
        'INCOME TAX - OTHERS',
        'INCOME TAX - PROJECTION',
        'INCOME TAX - PROVISONAL',
        'INCOME TAX - NOTICE',
        'TDS FILING',
        'TDS PAYMENTS',
        'TDS REPORT',
        'NEW PAN APPLY - FIRM',
        'NEW PAN APPLY - TRUST',
        'TAN - APPLICATION'
      ]
    },
    {
      dept: 'STATUTORY COMPLIANCES TEAM',
      tasks: [
        'ESI REGISTRATION',
        'ESI - OTHERS',
        'ESI PAYMENTS',
        'PF REGISTRATION',
        'PF - OTHERS',
        'PF PAYMENTS',
        'LABOUR WELFARE FUND - REGISTRATION',
        'PROFESSIONAL TAX REGISTRATION',
        'TRADE LICENSE REGISTRATION',
        'SHOP & ESTABLISHMENT ACT REGISTRATION'
      ]
    },
    {
      dept: 'REGISTRATION TEAM',
      tasks: [
        'MSME REGISTRATION',
        'MSME - OTHERS',
        'FSSAI REGISTRATION',
        'FSSAI OTHERS',
        'GEM - REGISTRATION',
        'START-UP REGISTRATION',
        '80G REGISTRATION',
        'IMPORT & EXPORT CODE',
        'DARBAN REGISTRATION',
        'ISO CERTIFICATION',
        'TRADEMARK REGISTRATION',
        'LUT REGISTRATION'
      ]
    },
    {
      dept: 'PRIVATE LIMITED FORMATION TEAM',
      tasks: [
        'PRIVATE LIMITED REGISTRATION',
        'ROC - COORDINATION',
        'DIGITAL SIGNATURE',
        'DIGITAL SIGNATURE - ORGANISATION',
        'SUPPORTING WORKS',
        'DOCUMENTATION WORKS'
      ]
    },
    {
      dept: 'OTHERS',
      tasks: [
        'OTHERS',
        'STOCK AUDIT VISIT',
        'STOCK AUDIT - REPORT PREPARATION'
      ]
    }
  ];

  for (const group of taskGroups) {
    const deptId = depts[group.dept].id;
    for (const taskName of group.tasks) {
      await prisma.taskType.create({
        data: {
          id: `tt-${taskName.replace(/\s+/g, '-').toLowerCase()}`,
          name: taskName,
          departmentId: deptId
        }
      });
    }
  }
  console.log('✅ Task types created');

  console.log('\n🎉 Seed complete! CRM is now clean and updated with ONLY your Excel data.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
