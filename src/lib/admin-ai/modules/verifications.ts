import { prisma } from "@/lib/prisma";
import type { AdminAiModule } from "@/lib/admin-ai/types";
import { denied } from "@/lib/admin-ai/permissions";
import { formatDate, hasAny, lines } from "@/lib/admin-ai/modules/shared";

export const adminAiVerificationsModule: AdminAiModule = {
  id: "verifications",
  description: "Очередь верификаций компаний без раскрытия паспортных данных.",
  async handle({ actor, message }) {
    if (!hasAny(message, ["вериф", "провер", "kyc", "паспорт", "заявк"])) return null;
    if (!actor.can("COMPANY_VERIFICATIONS")) return denied("COMPANY_VERIFICATIONS");

    const [submitted, reviewing, latest] = await Promise.all([
      prisma.companyVerificationApplication.count({ where: { status: "SUBMITTED" } }),
      prisma.companyVerificationApplication.count({ where: { status: "REVIEWING" } }),
      prisma.companyVerificationApplication.findMany({
        where: { status: { in: ["SUBMITTED", "REVIEWING"] } },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: { uuid: true, companyName: true, contactEmail: true, status: true, createdAt: true },
      }),
    ]);

    return {
      intent: "verifications_summary",
      reply: lines([
        `Верификация компаний: новых — ${submitted}, в работе — ${reviewing}.`,
        latest.length ? "Ближайшие к разбору:" : "Очередь верификаций сейчас пустая.",
        ...latest.map((item) => `• ${item.status}: ${item.companyName} · ${item.contactEmail} · ${formatDate(item.createdAt)}`),
      ]),
      suggestions: ["Открой /admin/company-verifications", "Покажи заявки REVIEWING", "Покажи старые заявки"],
    };
  },
};
