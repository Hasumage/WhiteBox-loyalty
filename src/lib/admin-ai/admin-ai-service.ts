import type { AdminTaskSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extendCompanyBillingWithoutPayment } from "@/lib/admin/company-billing-extension";
import { adminAiAuditModule } from "@/lib/admin-ai/modules/audit";
import { adminAiCompaniesModule } from "@/lib/admin-ai/modules/companies";
import { adminAiFinanceModule } from "@/lib/admin-ai/modules/finance";
import { adminAiOverviewModule } from "@/lib/admin-ai/modules/overview";
import { adminAiPaymentsModule } from "@/lib/admin-ai/modules/payments";
import { adminAiPrModule } from "@/lib/admin-ai/modules/pr";
import { adminAiTasksModule } from "@/lib/admin-ai/modules/tasks";
import { adminAiTelegramModule } from "@/lib/admin-ai/modules/telegram";
import { adminAiUsersModule } from "@/lib/admin-ai/modules/users";
import { adminAiVerificationsModule } from "@/lib/admin-ai/modules/verifications";
import { askAdminAiOpenAi, type AdminAiOpenAiContextItem } from "@/lib/admin-ai/openai";
import type {
  AdminAiActor,
  AdminAiAssistResult,
  AdminAiChatMessage,
  AdminAiModule,
  AdminAiPendingAction,
} from "@/lib/admin-ai/types";

const modules: AdminAiModule[] = [
  adminAiVerificationsModule,
  adminAiPrModule,
  adminAiFinanceModule,
  adminAiCompaniesModule,
  adminAiPaymentsModule,
  adminAiTasksModule,
  adminAiUsersModule,
  adminAiTelegramModule,
  adminAiAuditModule,
  adminAiOverviewModule,
];

export function sanitizeAdminAiMessages(messages: unknown): AdminAiChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((message) => {
      if (!message || typeof message !== "object") return null;
      const role = (message as { role?: unknown }).role;
      const content = (message as { content?: unknown }).content;
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
      return { role, content: content.trim().slice(0, 2200) };
    })
    .filter((message): message is AdminAiChatMessage => Boolean(message?.content))
    .slice(-12);
}

function compactContext(items: Array<{ mod: AdminAiModule; result: AdminAiAssistResult }>): AdminAiOpenAiContextItem[] {
  return items.slice(0, 8).map(({ mod, result }) => ({
    moduleId: mod.id,
    moduleDescription: mod.description,
    intent: result.intent,
    reply: result.reply.slice(0, 4500),
    data: result.data,
    table: result.table
      ? {
          title: result.table.title,
          summary: result.table.summary,
          totalRows: result.table.totalRows,
        }
      : undefined,
    pendingAction: result.pendingAction
      ? {
          type: result.pendingAction.type,
          title: result.pendingAction.title,
          description: result.pendingAction.description,
        }
      : null,
  }));
}

async function collectAdminAiContext(params: {
  actor: AdminAiActor;
  message: string;
  history: AdminAiChatMessage[];
}) {
  const collected: Array<{ mod: AdminAiModule; result: AdminAiAssistResult }> = [];

  for (const mod of modules) {
    try {
      const result = await mod.handle({
        actor: params.actor,
        message: params.message,
        history: params.history,
      });
      if (result) collected.push({ mod, result });
    } catch (error) {
      collected.push({
        mod,
        result: {
          intent: "source_error",
          reply: `Источник «${mod.description}» не ответил: ${error instanceof Error ? error.message : "неизвестная ошибка"}.`,
        },
      });
    }
  }

  return collected;
}

export async function assistAdminAi(params: {
  actor: AdminAiActor;
  message: string;
  history: AdminAiChatMessage[];
  imageDataUrl?: string;
}): Promise<AdminAiAssistResult> {
  const message = params.message.trim().slice(0, 1500);
  if (!message) {
    return {
      intent: "empty",
      reply: "Напишите, что нужно проверить, объяснить или подготовить. Я подтяну только те данные, к которым у вас есть доступ.",
    };
  }

  const collected = await collectAdminAiContext({
    actor: params.actor,
    message,
    history: params.history,
  });
  const pendingAction = collected.find((item) => item.result.pendingAction)?.result.pendingAction ?? null;
  const table = collected.find((item) => item.result.table)?.result.table;
  const data = collected.find((item) => item.result.data)?.result.data;
  const context = compactContext(collected);

  const aiReply = await askAdminAiOpenAi({
    actor: params.actor,
    message,
    history: params.history,
    context,
    imageDataUrl: params.imageDataUrl,
  }).catch((error) => {
    console.error("[admin-ai] OpenAI failed", error);
    return null;
  });

  if (!aiReply) {
    return {
      intent: "openai_unavailable",
      reply:
        "Помощник временно не получил ответ. Попробуйте ещё раз через минуту — данные и настройки не изменились.",
      table,
      data,
    };
  }

  return {
    intent: pendingAction ? "openai_proposed_action" : "openai_answer",
    reply: aiReply,
    data,
    table,
    pendingAction,
  };
}

function requiredScopeForTaskSource(source: AdminTaskSource) {
  if (source === "FINANCE") return "FINANCE";
  if (source === "COMPANY_VERIFICATION") return "COMPANY_VERIFICATIONS";
  return "AUDIT";
}

export async function applyAdminAiAction(params: {
  actor: AdminAiActor;
  action: AdminAiPendingAction;
}) {
  if (params.action.type === "EXTEND_COMPANY_BILLING") {
    if ((params.actor.role !== "SUPER_ADMIN" && params.actor.role !== "ADMIN") || !params.actor.can("COMPANIES", "canApprove")) {
      return { ok: false as const, status: 403, message: "No permission to extend company billing." };
    }
    const result = await extendCompanyBillingWithoutPayment({
      ownerUserUuid: params.action.payload.ownerUserUuid,
      actor: params.actor,
      months: params.action.payload.months,
      comment: params.action.payload.comment,
      notificationText: params.action.payload.notificationText,
      notifyTelegram: params.action.payload.notifyTelegram,
    });
    return {
      ok: true as const,
      result: {
        reply: `Готово. Подписка «${params.action.payload.companyName}» продлена до ${new Intl.DateTimeFormat("ru-RU").format(new Date(result.billing.account.currentPeriodEndsAt))}. Telegram: отправлено ${result.notification.telegram.delivered}, в очереди ${result.notification.telegram.queued}.`,
        data: result,
      },
    };
  }

  if (params.action.type === "CREATE_ADMIN_TASK") {
    const scope = requiredScopeForTaskSource(params.action.payload.source);
    if (!params.actor.can(scope, "canEdit")) {
      return { ok: false as const, status: 403, message: "No permission to create this task." };
    }
    const task = await prisma.adminTask.create({
      data: {
        source: params.action.payload.source,
        sourceKey: `admin-ai:${crypto.randomUUID()}`,
        title: params.action.payload.title.slice(0, 160),
        description: params.action.payload.description?.slice(0, 8000) || null,
        priority: params.action.payload.priority,
        status: "OPEN",
        assignedToId: params.actor.id,
        assignedAt: new Date(),
      },
    });
    return {
      ok: true as const,
      result: {
        reply: `Задача создана и назначена на вас: «${task.title}».`,
        data: { taskUuid: task.uuid },
      },
    };
  }

  return { ok: false as const, status: 400, message: "Unsupported admin AI action." };
}
