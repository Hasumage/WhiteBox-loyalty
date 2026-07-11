import { prisma } from "@/lib/prisma";
import type { AdminAiModule } from "@/lib/admin-ai/types";
import { denied } from "@/lib/admin-ai/permissions";
import { compactText, hasAny, lines } from "@/lib/admin-ai/modules/shared";

const activeStatuses = ["OPEN", "IN_PROGRESS"] as const;

export const adminAiTasksModule: AdminAiModule = {
  id: "tasks",
  description: "Задачи, критические алерты и рабочая очередь админки.",
  async handle({ actor, message }) {
    if (!hasAny(message, ["горит", "задач", "алерт", "критич", "инцидент", "что делать", "очеред"])) return null;
    if (!actor.can("AUDIT") && !actor.can("FINANCE") && !actor.can("COMPANY_VERIFICATIONS")) return denied("AUDIT");

    if (hasAny(message, ["создай задачу", "создать задачу", "добавь задачу", "поставь задачу"])) {
      const source = actor.can("AUDIT", "canEdit")
        ? "AUDIT"
        : actor.can("FINANCE", "canEdit")
          ? "FINANCE"
          : actor.can("COMPANY_VERIFICATIONS", "canEdit")
            ? "COMPANY_VERIFICATION"
            : null;
      if (!source) {
        return {
          intent: "task_create_denied",
          reply: "Задачу вижу, но у вашего аккаунта нет права создавать задачи в доступных разделах.",
        };
      }
      const title = compactText(
        message.replace(/создай задачу|создать задачу|добавь задачу|поставь задачу/gi, "").trim(),
        "Задача из admin AI",
        120,
      );
      return {
        intent: "task_create_prepare",
        reply: `Могу создать задачу «${title}» в источнике ${source}. Подтвердите — и она появится на доске.`,
        pendingAction: {
          type: "CREATE_ADMIN_TASK",
          title: "Создать задачу",
          description: title,
          payload: {
            title,
            description: `Создано из admin AI по запросу: ${message}`,
            priority: hasAny(message, ["критич", "срочно", "горит"]) ? "CRITICAL" : "NORMAL",
            source,
          },
        },
      };
    }

    const allowedSources = [
      actor.can("AUDIT") ? "AUDIT" : null,
      actor.can("FINANCE") ? "FINANCE" : null,
      actor.can("COMPANY_VERIFICATIONS") ? "COMPANY_VERIFICATION" : null,
    ].filter(Boolean) as Array<"AUDIT" | "FINANCE" | "COMPANY_VERIFICATION">;

    const [critical, active, latest] = await Promise.all([
      prisma.adminTask.count({
        where: { source: { in: allowedSources }, status: { in: [...activeStatuses] }, priority: "CRITICAL" },
      }),
      prisma.adminTask.count({
        where: { source: { in: allowedSources }, status: { in: [...activeStatuses] } },
      }),
      prisma.adminTask.findMany({
        where: { source: { in: allowedSources }, status: { in: [...activeStatuses] } },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        take: 5,
        include: { assignedTo: { select: { name: true, email: true } } },
      }),
    ]);

    return {
      intent: "tasks_summary",
      reply: lines([
        `Видимая вам очередь: ${active} активных задач, из них критичных — ${critical}.`,
        latest.length ? "" : "Сейчас в вашей зоне доступа нет активных задач.",
        ...latest.map((task, index) => (
          `${index + 1}. ${task.priority} · ${task.status} · ${compactText(task.title, "Задача")} ${
            task.assignedTo ? `— ${task.assignedTo.name || task.assignedTo.email}` : "— без ответственного"
          }`
        )),
      ]),
      suggestions: ["Открой /admin/tasks", "Покажи только критичные", "Создай задачу для менеджера"],
    };
  },
};
