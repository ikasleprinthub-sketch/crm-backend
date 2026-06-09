import { prisma } from '../../lib/prisma';

export async function getConfig(key: string, defaultValue: string): Promise<string> {
  const config = await prisma.systemConfig.findUnique({ where: { key } });
  return config ? config.value : defaultValue;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function setConfigBatch(entries: { key: string; value: string }[]): Promise<void> {
  await Promise.all(entries.map(({ key, value }) =>
    prisma.systemConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    })
  ));
}

export async function getAllConfigs() {
  return prisma.systemConfig.findMany();
}

export const CONFIG_DEFAULTS: Record<string, string> = {
  // Attendance
  officeStartTime:       '10:00',
  gracePeriodMinutes:    '15',
  officeEndTime:         '18:00',
  fullDayHours:          '8',
  halfDayHours:          '4',
  autoAbsentTime:        '12:00',
  countLateAsPresent:    'true',
  allowAdminOverride:    'true',
  allowTLOverride:       'false',
  // Permission
  maxPermissionHours:    '2',
  approvalRequired:      'true',
  allowBackdated:        'false',
  reasonMandatory:       'true',
  permissionAffects:     'true',
  // Notification
  notifyLateCheckIn:     'true',
  notifyMissedCheckIn:   'true',
  notifyCheckOutReminder:'true',
  notifyPermSubmitted:   'true',
  notifyPermApproved:    'true',
  notifyPermRejected:    'true',
  notifyTaskAssigned:    'true',
  notifyTaskDueToday:    'true',
  notifyTaskOverdue:     'true',
  notifyTaskCompleted:   'false',
  notifyLeadAssigned:    'true',
  notifyLeadConverted:   'true',
  notifyLeadLost:        'false',
  enableInApp:           'true',
  enableEmail:           'false',
};
