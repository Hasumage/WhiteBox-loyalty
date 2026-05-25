import type { AdminTaskPriority, AdminTaskSource, AuditEvent, CompanyVerificationApplication, FinanceOperation } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ACTIVE_ADMIN_TASK_STATUSES = ["OPEN", "IN_PROGRESS"] as const;
const RESOLVED_TAG = "RESOLVED";

type AuditSignal = Pick<
  AuditEvent,
  "id" | "workspace" | "level" | "category" | "action" | "details" | "linkUrl" | "linkLabel" | "createdAt"
>;

function priorityForAudit(event: AuditSignal): AdminTaskPriority {
  return event.level === "CRITICAL" ? "CRITICAL" : event.level === "WARN" ? "HIGH" : "NORMAL";
}

function taskScope(source: AdminTaskSource) {
  if (source === "COMPANY_VERIFICATION") return "COMPANY_VERIFICATIONS" as const;
  if (source === "FINANCE") return "FINANCE" as const;
  return "AUDIT" as const;
}

export function requiredScopeForAdminTask(source: AdminTaskSource) {
  return taskScope(source);
}

export async function upsertAdminTaskForAuditEvent(event: AuditSignal) {
  return prisma.adminTask.upsert({
    where: { sourceKey: `audit:${event.id}` },
    update: {
      title: event.action,
      description: event.details,
      priority: priorityForAudit(event),
      targetUrl: event.linkUrl || "/admin/system-health",
      targetLabel: event.linkLabel || "Открыть источник алерта",
    },
    create: {
      source: "AUDIT",
      sourceKey: `audit:${event.id}`,
      title: event.action,
      description: event.details,
      priority: priorityForAudit(event),
      targetUrl: event.linkUrl || "/admin/system-health",
      targetLabel: event.linkLabel || "Открыть источник алерта",
    },
  });
}

type VerificationSignal = Pick<CompanyVerificationApplication, "uuid" | "companyName" | "contactName" | "status">;

export async function upsertAdminTaskForVerification(application: VerificationSignal) {
  return prisma.adminTask.upsert({
    where: { sourceKey: `verification:${application.uuid}` },
    update: {
      title: `Проверить компанию: ${application.companyName}`,
      description: `Заявка ${application.status.toLowerCase()} от ${application.contactName}.`,
      priority: "HIGH",
      targetUrl: `/admin/company-verifications/${application.uuid}`,
      targetLabel: "Открыть заявку",
    },
    create: {
      source: "COMPANY_VERIFICATION",
      sourceKey: `verification:${application.uuid}`,
      title: `Проверить компанию: ${application.companyName}`,
      description: `Заявка ${application.status.toLowerCase()} от ${application.contactName}.`,
      priority: "HIGH",
      targetUrl: `/admin/company-verifications/${application.uuid}`,
      targetLabel: "Открыть заявку",
    },
  });
}

type FinanceSignal = Pick<FinanceOperation, "uuid" | "title" | "amount" | "currency">;

export async function upsertAdminTaskForFinance(operation: FinanceSignal) {
  return prisma.adminTask.upsert({
    where: { sourceKey: `finance:${operation.uuid}` },
    update: {
      title: operation.title,
      description: `Требуется финансовое решение: ${operation.amount.toString()} ${operation.currency}.`,
      priority: "CRITICAL",
      targetUrl: "/admin/finance",
      targetLabel: "Открыть финансы",
    },
    create: {
      source: "FINANCE",
      sourceKey: `finance:${operation.uuid}`,
      title: operation.title,
      description: `Требуется финансовое решение: ${operation.amount.toString()} ${operation.currency}.`,
      priority: "CRITICAL",
      targetUrl: "/admin/finance",
      targetLabel: "Открыть финансы",
    },
  });
}

async function closeInactiveDomainTasks(source: "COMPANY_VERIFICATION" | "FINANCE", activeKeys: string[]) {
  const where = {
    source,
    status: { in: [...ACTIVE_ADMIN_TASK_STATUSES] },
    ...(activeKeys.length ? { sourceKey: { notIn: activeKeys } } : {}),
  };
  await prisma.adminTask.updateMany({
    where,
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
}

export async function syncAdminTasksFromSignals() {
  const [auditSignals, applications, financeOperations] = await Promise.all([
    prisma.auditEvent.findMany({
      where: {
        NOT: { tags: { has: RESOLVED_TAG } },
        OR: [
          { level: "CRITICAL" },
          { tags: { has: "TELEGRAM_FIRE" } },
          { tags: { has: "REVIEW_REQUIRED" } },
          { category: "SYSTEM", level: "WARN" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.companyVerificationApplication.findMany({
      where: { status: { in: ["SUBMITTED", "REVIEWING"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { uuid: true, companyName: true, contactName: true, status: true },
    }),
    prisma.financeOperation.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { uuid: true, title: true, amount: true, currency: true },
    }),
  ]);

  await Promise.all([
    ...auditSignals.map((event) => upsertAdminTaskForAuditEvent(event)),
    ...applications.map((application) => upsertAdminTaskForVerification(application)),
    ...financeOperations.map((operation) => upsertAdminTaskForFinance(operation)),
  ]);

  await Promise.all([
    closeInactiveDomainTasks("COMPANY_VERIFICATION", applications.map((application) => `verification:${application.uuid}`)),
    closeInactiveDomainTasks("FINANCE", financeOperations.map((operation) => `finance:${operation.uuid}`)),
  ]);
}
