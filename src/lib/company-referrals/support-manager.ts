import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SUPPORT_MANAGER_SHARE_PERCENT = 1;

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export async function pickCompanySupportManager(db: PrismaLike = prisma) {
  const candidates = await db.user.findMany({
    where: {
      role: { in: ["MANAGER", "ADMIN", "SUPER_ADMIN"] },
      accountStatus: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
      _count: { select: { supportedCompanies: true } },
    },
    orderBy: [{ role: "asc" }, { id: "asc" }],
  });

  const rolePriority = new Map([
    ["MANAGER", 0],
    ["ADMIN", 1],
    ["SUPER_ADMIN", 2],
  ]);

  return candidates.sort((a, b) => {
    const roleDelta = (rolePriority.get(a.role) ?? 99) - (rolePriority.get(b.role) ?? 99);
    if (roleDelta !== 0) return roleDelta;
    const loadDelta = a._count.supportedCompanies - b._count.supportedCompanies;
    if (loadDelta !== 0) return loadDelta;
    return a.id - b.id;
  })[0] ?? null;
}

export async function supportManagerConnectData(db: PrismaLike = prisma) {
  const manager = await pickCompanySupportManager(db);
  if (!manager) return {};
  return {
    supportManagerId: manager.id,
    supportManagerAssignedAt: new Date(),
  };
}

export function supportManagerSharePercent() {
  return SUPPORT_MANAGER_SHARE_PERCENT;
}
