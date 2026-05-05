import { prisma } from '../../lib/prisma';

export async function getConfig(key: string, defaultValue: string): Promise<string> {
  const config = await prisma.systemConfig.findUnique({
    where: { key },
  });
  return config ? config.value : defaultValue;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getAllConfigs() {
  return prisma.systemConfig.findMany();
}
