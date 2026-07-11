import { prisma } from "@/lib/prisma";
import { getCompanyReferralLiabilityReport } from "@/lib/company-referrals/company-referrals";
import type { AdminAiModule } from "@/lib/admin-ai/types";
import { denied } from "@/lib/admin-ai/permissions";
import { formatRub, hasAny, lines } from "@/lib/admin-ai/modules/shared";

function wantsPrDebt(message: string) {
  return (
    hasAny(message, ["агент", "pr", "пиар", "реферал", "партнер", "партнёр"]) &&
    hasAny(message, ["долж", "долг", "невыпла", "к выплат", "баланс", "сколько денег", "сколько я должен"])
  );
}

export const adminAiPrModule: AdminAiModule = {
  id: "pr",
  description: "PR-рефералы, атрибуция и партнерская очередь.",
  async handle({ actor, message }) {
    if (!hasAny(message, ["pr", "пиар", "реферал", "партнер", "партнёр", "атрибут", "лид", "агент", "долг", "долж", "невыпла"])) return null;
    if (!actor.can("PR")) return denied("PR");

    if (wantsPrDebt(message)) {
      if (!actor.can("FINANCE")) return denied("FINANCE");
      const report = await getCompanyReferralLiabilityReport();
      const rows = report.topAgents.map((agent, index) => ({
        "#": index + 1,
        "Агент": agent.name,
        "Email": agent.email,
        "Долг": formatRub(agent.unpaidTotal),
        "На балансе": formatRub(agent.availableBalance),
        "В заявках": formatRub(agent.reserved),
        "Компаний": `${agent.activeCompanies}/${agent.companies}`,
        "Ссылка": agent.userUrl,
      }));

      return {
        intent: "pr_agent_liability_report",
        reply: lines([
          `По PR-агентам сейчас к выплате: ${formatRub(report.totalUnpaid)}.`,
          `Агентов с невыплаченной суммой: ${report.agentsWithDebt}.`,
          `Из этого на балансах доступно: ${formatRub(report.totalAvailableBalance)}, уже зарезервировано заявками: ${formatRub(report.totalReserved)}.`,
          report.agentsWithDebt > 20 ? "Ниже топ-20 агентов по сумме долга." : "Ниже все агенты с невыплаченной суммой.",
        ]),
        data: {
          generatedAt: report.generatedAt,
          agentsWithDebt: report.agentsWithDebt,
          totalUnpaid: report.totalUnpaid,
          totalAvailableBalance: report.totalAvailableBalance,
          totalReserved: report.totalReserved,
          topAgents: report.topAgents,
        },
        table: {
          title: "PR-агенты по невыплаченной сумме",
          summary: `Всего: ${formatRub(report.totalUnpaid)} · агентов: ${report.agentsWithDebt}`,
          totalRows: report.agentsWithDebt,
          columns: [
            { key: "#", label: "#", align: "right" },
            { key: "Агент", label: "Агент" },
            { key: "Email", label: "Email" },
            { key: "Долг", label: "Долг", align: "right" },
            { key: "На балансе", label: "На балансе", align: "right" },
            { key: "В заявках", label: "В заявках", align: "right" },
            { key: "Компаний", label: "Компаний", align: "right" },
            { key: "Ссылка", label: "Ссылка" },
          ],
          rows,
        },
        suggestions: ["Открой /admin/finance", "Покажи PR-выплаты", "Покажи самого дорогого PR-агента"],
      };
    }

    const seesAll = actor.role === "SUPER_ADMIN" || actor.role === "ADMIN";
    const where = seesAll ? {} : { referrerUserId: actor.id };
    const [active, lost, pipelineRows, latest] = await Promise.all([
      prisma.companyReferral.count({ where: { ...where, status: "ACTIVE" } }),
      prisma.companyReferral.count({ where: { ...where, pipelineStatus: "LOST" } }),
      prisma.companyReferral.groupBy({ by: ["pipelineStatus"], where, _count: true }),
      prisma.companyReferral.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          company: { select: { name: true, slug: true, isActive: true } },
          referrer: { select: { name: true, email: true } },
        },
      }),
    ]);
    const pipeline = Object.fromEntries(pipelineRows.map((row) => [row.pipelineStatus, row._count]));

    return {
      intent: "pr_summary",
      reply: lines([
        `PR: активных привязок — ${active}, потерянных — ${lost}. ${seesAll ? "Показываю всю платформу." : "Показываю только вашу зону."}`,
        `Воронка: лиды ${pipeline.LEAD ?? 0}, переговоры ${pipeline.NEGOTIATION ?? 0}, тест ${pipeline.TRIAL ?? 0}, подключены ${pipeline.CONNECTED ?? 0}, с выручкой ${pipeline.REVENUE_ACTIVE ?? 0}.`,
        latest.length ? "Последние изменения:" : null,
        ...latest.map((row) => `• ${row.company.name} — ${row.pipelineStatus}, PR: ${row.referrer.name || row.referrer.email}`),
      ]),
      suggestions: ["Открой /admin/pr", "Покажи рефералов с потерянной атрибуцией", "Покажи PR-выплаты"],
    };
  },
};
