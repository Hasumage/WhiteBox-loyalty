import {
  resolveEffectivePermissions,
  type AdminPermissionAction,
  type AdminPermissionScope,
} from "@/lib/admin/access-control";
import { prisma } from "@/lib/prisma";
import type { AdminAiActor } from "@/lib/admin-ai/types";

export async function loadAdminAiActor(userId: number): Promise<AdminAiActor | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      uuid: true,
      role: true,
      email: true,
      name: true,
      permissions: { select: { scope: true, canView: true, canEdit: true, canApprove: true } },
    },
  });
  if (!user) return null;

  const permissions = resolveEffectivePermissions(user.role, user.permissions);
  return {
    id: user.id,
    uuid: user.uuid,
    role: user.role,
    email: user.email,
    name: user.name,
    permissions,
    can: (scope: AdminPermissionScope, action: AdminPermissionAction = "canView") => {
      const permission = permissions.find((item) => item.scope === scope);
      return permission?.[action] === true;
    },
  };
}

export function denied(scope: AdminPermissionScope) {
  return {
    reply: `Нет доступа к разделу «${scope}». Я вижу только то, что разрешено вашему аккаунту.`,
    intent: "permission_denied",
    suggestions: ["Откройте страницу прав пользователя", "Попросите SUPER_ADMIN выдать нужный доступ"],
  };
}
