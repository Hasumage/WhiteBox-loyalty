import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { upsertAdminTaskForAuditEvent } from "@/lib/admin/admin-tasks";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const RECENT_LIMIT = 8;
const RESOLVED_TAG = "RESOLVED";

const unresolvedDeveloperIncidentWhere = {
  workspace: "DEVELOPER" as const,
  NOT: [{ tags: { has: RESOLVED_TAG } }, { tags: { has: "GIT" } }],
  OR: [
    { level: "CRITICAL" as const },
    { tags: { has: "TELEGRAM_FIRE" } },
    { tags: { has: "SYSTEM_INCIDENT" } },
    { tags: { has: "INCIDENT" } },
    { category: "SYSTEM" as const, level: "WARN" as const },
  ],
};

function clip(value: string | null | undefined, max = 420) {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function maskChatId(value: string) {
  if (value.length <= 4) return value;
  return `...${value.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const access = await requireAdminScope(session, "AUDIT", "canView");
  if (!access.ok) return access.response;

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    queueTotal,
    queueFailed,
    queueDue,
    queueSent,
    queueRecent,
    leadTelegramFailed,
    leadTelegramSent,
    leadTelegramPending,
    leadRecentFailures,
    developerIncidents,
  ] = await Promise.all([
    prisma.telegramMessageQueue.count(),
    prisma.telegramMessageQueue.count({ where: { status: "FAILED" } }),
    prisma.telegramMessageQueue.count({
      where: {
        status: "FAILED",
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
    }),
    prisma.telegramMessageQueue.count({ where: { status: "SENT" } }),
    prisma.telegramMessageQueue.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: RECENT_LIMIT,
    }),
    prisma.notificationDelivery.count({
      where: { channel: "telegram", status: "FAILED", createdAt: { gte: since24h } },
    }),
    prisma.notificationDelivery.count({
      where: { channel: "telegram", status: "SENT", createdAt: { gte: since24h } },
    }),
    prisma.notificationDelivery.count({
      where: { channel: "telegram", status: "PENDING", createdAt: { gte: since24h } },
    }),
    prisma.notificationDelivery.findMany({
      where: { channel: "telegram", status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        lead: {
          select: { uuid: true, name: true, company: true },
        },
      },
    }),
    prisma.auditEvent.findMany({
      where: unresolvedDeveloperIncidentWhere,
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const criticalIncidents = developerIncidents.filter((event) => event.level === "CRITICAL").length;
  const openIssues = queueFailed + leadTelegramFailed + developerIncidents.length;
  const incidentTasks = await Promise.all(
    developerIncidents.map((event) => upsertAdminTaskForAuditEvent(event).catch(() => null)),
  );
  const taskUuidBySource = new Map(
    incidentTasks
      .filter((task): task is NonNullable<typeof task> => task !== null)
      .map((task) => [task.sourceKey, task.uuid]),
  );

  return NextResponse.json({
    generatedAt: now.toISOString(),
    summary: {
      openIssues,
      criticalIncidents,
      telegramQueueFailed: queueFailed,
      telegramQueueDue: queueDue,
      leadTelegramFailed24h: leadTelegramFailed,
    },
    telegram: {
      botConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      proxyConfigured: Boolean(process.env.TELEGRAM_PROXY_URL),
      queue: {
        total: queueTotal,
        failed: queueFailed,
        due: queueDue,
        sent: queueSent,
        recent: queueRecent.map((item) => ({
          id: item.id,
          status: item.status,
          recipientRole: item.recipientRole,
          recipientLabel: item.recipientLabel,
          recipientChatId: maskChatId(item.recipientChatId),
          textPreview: clip(item.text, 180),
          source: item.source,
          sourceId: item.sourceId,
          priority: item.priority,
          attempts: item.attempts,
          telegramMessageId: item.telegramMessageId,
          lastError: clip(item.lastError, 700),
          nextRetryAt: item.nextRetryAt?.toISOString() ?? null,
          sentAt: item.sentAt?.toISOString() ?? null,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
      },
      landingLeadDelivery24h: {
        sent: leadTelegramSent,
        failed: leadTelegramFailed,
        pending: leadTelegramPending,
        recentFailures: leadRecentFailures.map((delivery) => ({
          id: delivery.id,
          recipientRole: delivery.recipientRole,
          recipientLabel: delivery.recipientLabel,
          recipientChatId: maskChatId(delivery.recipientChatId),
          attempts: delivery.attempts,
          lastError: clip(delivery.lastError, 700),
          nextRetryAt: delivery.nextRetryAt?.toISOString() ?? null,
          createdAt: delivery.createdAt.toISOString(),
          updatedAt: delivery.updatedAt.toISOString(),
          lead: delivery.lead,
        })),
      },
    },
    developerIncidents: developerIncidents.map((event) => ({
      id: event.id,
      level: event.level,
      category: event.category,
      action: event.action,
      details: clip(event.details, 900),
      actorLabel: event.actorLabel,
      targetLabel: event.targetLabel,
      result: event.result,
      tags: event.tags,
      linkUrl: event.linkUrl,
      linkLabel: event.linkLabel,
      taskUuid: taskUuidBySource.get(`audit:${event.id}`) ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const access = await requireAdminScope(session, "AUDIT", "canEdit");
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => null)) as { action?: string; id?: string } | null;
  if (body?.action !== "resolveDeveloperIncident" || !body.id) {
    return NextResponse.json({ message: "Invalid system health action." }, { status: 400 });
  }

  const event = await prisma.auditEvent.findFirst({
    where: {
      id: body.id,
      workspace: "DEVELOPER",
    },
    select: {
      id: true,
      tags: true,
      details: true,
    },
  });

  if (!event) {
    return NextResponse.json({ message: "Developer incident not found." }, { status: 404 });
  }

  const resolvedAt = new Date().toISOString();
  const actorLabel = session.email || `admin:${session.userId}`;
  const detailsSuffix = `\n\nResolved from System Health at ${resolvedAt} by ${actorLabel}.`;

  const updated = await prisma.$transaction(async (tx) => {
    const incident = await tx.auditEvent.update({
      where: { id: event.id },
      data: {
        level: "INFO",
        tags: Array.from(new Set([...event.tags, RESOLVED_TAG])),
        details: `${event.details ?? ""}${detailsSuffix}`.trim(),
      },
      select: { id: true, tags: true },
    });
    await tx.adminTask.updateMany({
      where: {
        sourceKey: `audit:${event.id}`,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      data: {
        status: "RESOLVED",
        resolvedById: session.userId,
        resolvedAt: new Date(),
      },
    });
    return incident;
  });

  return NextResponse.json({ ok: true, incident: updated });
}
