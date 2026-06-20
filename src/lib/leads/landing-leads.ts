import { createHash } from "node:crypto";
import type { LandingLeadStatus, NotificationDeliveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildLeadInlineKeyboard,
  renderLandingLeadHtmlMessage,
  sendTelegramMessage,
  type LandingLead,
  type TelegramRecipient,
} from "@/lib/telegram/telegram-service";
import { adminTelegramRecipients as sharedAdminTelegramRecipients } from "@/lib/telegram/admin-chat";
import { checkTelegramDeliveryFire } from "@/lib/telegram/telegram-queue";

export const LANDING_LEAD_MAX_FIELD_LENGTH = 1200;
export const LANDING_LEAD_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
export const LANDING_LEAD_MIN_FORM_TIME_MS = 2500;

export type LandingLeadPayload = LandingLead & {
  website?: string;
  url?: string;
  companyWebsite?: string;
  startedAt?: number;
};

export type LandingLeadRequestMeta = {
  ipAddress: string;
  userAgent?: string | null;
};

export function normalizeLeadField(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function readLeadField(payload: Record<string, unknown>, key: string, required = false) {
  const value = normalizeLeadField(payload[key]);

  if (required && value.length === 0) {
    throw new Error("Please fill in the required fields.");
  }

  if (value.length > LANDING_LEAD_MAX_FIELD_LENGTH) {
    throw new Error("Message is too long.");
  }

  return value;
}

export function hasHoneypotValue(payload: Record<string, unknown>) {
  return ["website", "url", "companyWebsite"].some((key) => normalizeLeadField(payload[key]).length > 0);
}

export function assertHumanTiming(startedAt: unknown, now = Date.now()) {
  if (typeof startedAt !== "number" || startedAt <= 0) return;

  if (now - startedAt < LANDING_LEAD_MIN_FORM_TIME_MS) {
    throw new Error("Form was submitted too fast. Please try again.");
  }
}

export function parseLandingLeadPayload(payload: Record<string, unknown>): LandingLead {
  return {
    name: readLeadField(payload, "name", true),
    company: readLeadField(payload, "company"),
    contact: readLeadField(payload, "contact", true),
    business: readLeadField(payload, "business"),
    message: readLeadField(payload, "message", true),
  };
}

export function buildLeadFingerprint(lead: LandingLead, meta: LandingLeadRequestMeta) {
  const raw = [lead.contact.toLowerCase(), lead.message.toLowerCase(), meta.ipAddress, meta.userAgent ?? ""].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

export function calculateSpamScore(lead: LandingLead, meta: LandingLeadRequestMeta) {
  let score = 0;
  const message = lead.message.toLowerCase();

  if (!lead.contact.includes("@") && !lead.contact.startsWith("@")) score += 1;
  if (/https?:\/\//i.test(message)) score += 2;
  if (message.length < 12) score += 1;
  if (/(.)\1{8,}/.test(message)) score += 1;
  if (meta.ipAddress === "unknown") score += 1;

  return score;
}

export function nextRetryAt(attempts: number, now = new Date()) {
  const minutes = attempts <= 1 ? 1 : attempts === 2 ? 5 : 15;
  return new Date(now.getTime() + minutes * 60 * 1000);
}

export function publicLeadUrl(leadUuid: string) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.FRONTEND_ORIGIN ||
    process.env.NEXT_PUBLIC_FRONTEND_URL;

  if (!origin) return undefined;

  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local");

    if (isLocal) return undefined;

    return `${origin.replace(/\/$/, "")}/admin/leads/${leadUuid}`;
  } catch {
    return undefined;
  }
}

export async function adminTelegramRecipients(): Promise<TelegramRecipient[]> {
  return sharedAdminTelegramRecipients();
}

export async function isDuplicateLead(
  fingerprint: string,
  since = new Date(Date.now() - LANDING_LEAD_DUPLICATE_WINDOW_MS),
) {
  const count = await prisma.landingLead.count({
    where: {
      fingerprint,
      createdAt: { gte: since },
      status: { not: "SPAM" },
    },
  });

  return count > 0;
}

export async function createLandingLead(params: {
  lead: LandingLead;
  meta: LandingLeadRequestMeta;
  source?: string;
}) {
  const fingerprint = buildLeadFingerprint(params.lead, params.meta);
  const spamScore = calculateSpamScore(params.lead, params.meta);
  const duplicate = await isDuplicateLead(fingerprint);

  if (duplicate) {
    throw new Error("This request has already been sent recently. I will not spam Telegram.");
  }

  return prisma.landingLead.create({
    data: {
      ...params.lead,
      company: params.lead.company || null,
      business: params.lead.business || null,
      source: params.source ?? "landing",
      ipAddress: params.meta.ipAddress,
      userAgent: params.meta.userAgent,
      fingerprint,
      spamScore,
      status: spamScore >= 4 ? "SPAM" : "NEW",
    },
  });
}

export async function notifyLandingLead(params: {
  leadRecord: {
    id: number;
    uuid: string;
    name: string;
    company: string | null;
    contact: string;
    business: string | null;
    message: string;
    createdAt: Date;
  };
  recipients: TelegramRecipient[];
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken || params.recipients.length === 0) {
    await createMissingTelegramDeliveries(params.leadRecord.id, params.recipients);
    return { sent: 0, failed: params.recipients.length, configured: false };
  }

  const text = renderLandingLeadHtmlMessage({
    lead: {
      name: params.leadRecord.name,
      company: params.leadRecord.company ?? undefined,
      contact: params.leadRecord.contact,
      business: params.leadRecord.business ?? undefined,
      message: params.leadRecord.message,
    },
    leadUuid: params.leadRecord.uuid,
    createdAt: params.leadRecord.createdAt,
  });
  const replyMarkup = buildLeadInlineKeyboard({
    leadUuid: params.leadRecord.uuid,
    leadUrl: publicLeadUrl(params.leadRecord.uuid),
    contact: params.leadRecord.contact,
  });

  let sent = 0;
  let failed = 0;

  for (const recipient of params.recipients) {
    try {
      const response = await sendTelegramMessage({
        botToken,
        chatId: recipient.chatId,
        text,
        parseMode: "HTML",
        replyMarkup,
        proxyUrl: process.env.TELEGRAM_PROXY_URL,
      });

      await prisma.notificationDelivery.create({
        data: {
          leadId: params.leadRecord.id,
          recipientRole: recipient.role ?? "owner",
          recipientChatId: recipient.chatId,
          recipientLabel: recipient.label,
          status: "SENT",
          attempts: 1,
          telegramMessageId: response.result.message_id,
          sentAt: new Date(),
        },
      });
      sent += 1;
    } catch (error) {
      await prisma.notificationDelivery.create({
        data: {
          leadId: params.leadRecord.id,
          recipientRole: recipient.role ?? "owner",
          recipientChatId: recipient.chatId,
          recipientLabel: recipient.label,
          status: "FAILED",
          attempts: 1,
          lastError: error instanceof Error ? error.message : String(error),
          nextRetryAt: nextRetryAt(1),
        },
      });
      await checkTelegramDeliveryFire().catch(() => undefined);
      failed += 1;
    }
  }

  return { sent, failed, configured: true };
}

async function createMissingTelegramDeliveries(leadId: number, recipients: TelegramRecipient[]) {
  const rows = recipients.length ? recipients : [{ chatId: "not-configured", role: "owner", label: "not-configured" }];

  await prisma.notificationDelivery.createMany({
    data: rows.map((recipient) => ({
      leadId,
      recipientRole: recipient.role ?? "owner",
      recipientChatId: recipient.chatId,
      recipientLabel: recipient.label,
      status: "FAILED" as NotificationDeliveryStatus,
      attempts: 0,
      lastError: "Telegram notifications are not configured.",
      nextRetryAt: nextRetryAt(1),
    })),
  });
  await checkTelegramDeliveryFire().catch(() => undefined);
}

export async function retryLeadNotifications(leadUuid: string) {
  const lead = await prisma.landingLead.findUnique({
    where: { uuid: leadUuid },
    include: { deliveries: { where: { status: "FAILED" } } },
  });

  if (!lead) throw new Error("Lead not found.");

  const recipients = lead.deliveries.length
    ? lead.deliveries.map((delivery) => ({
        chatId: delivery.recipientChatId,
        label: delivery.recipientLabel ?? undefined,
        role: delivery.recipientRole,
      }))
    : await adminTelegramRecipients();

  await prisma.notificationDelivery.deleteMany({ where: { leadId: lead.id, status: "FAILED" } });

  return notifyLandingLead({ leadRecord: lead, recipients });
}

export async function processLandingLeadRetryQueue(now = new Date(), limit = 20) {
  const failedDeliveries = await prisma.notificationDelivery.findMany({
    where: {
      status: "FAILED",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    select: {
      lead: { select: { uuid: true } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const leadUuids = Array.from(new Set(failedDeliveries.map((delivery) => delivery.lead.uuid)));
  const results = [];

  for (const leadUuid of leadUuids) {
    try {
      results.push({ leadUuid, ok: true as const, result: await retryLeadNotifications(leadUuid) });
    } catch (error) {
      results.push({
        leadUuid,
        ok: false as const,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    processed: results.length,
    results,
  };
}

export async function updateLandingLeadStatus(params: {
  leadUuid: string;
  status: LandingLeadStatus;
  notes?: string;
}) {
  return prisma.landingLead.update({
    where: { uuid: params.leadUuid },
    data: {
      status: params.status,
      notes: params.notes,
      processedAt: params.status === "CLOSED" || params.status === "SPAM" ? new Date() : null,
    },
  });
}
