import { NextResponse } from "next/server";
import type { AdminSession } from "@/lib/admin/require-admin-session";
import {
  resolveEffectivePermission,
  type AdminPermissionAction,
  type AdminPermissionScope,
} from "@/lib/admin/access-control";
import { prisma } from "@/lib/prisma";

export async function requireAdminScope(
  session: AdminSession,
  scope: AdminPermissionScope,
  action: AdminPermissionAction,
) {
  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      uuid: true,
      role: true,
      email: true,
      name: true,
      permissions: {
        select: { scope: true, canView: true, canEdit: true, canApprove: true },
      },
    },
  });
  const isPrWorkspaceManager =
    actor?.role === "MANAGER" && actor.permissions.some((permission) => permission.scope === "PR" && permission.canView);
  if (isPrWorkspaceManager && scope !== "PR") {
    return {
      ok: false as const,
      response: NextResponse.json({ message: `${scope} ${action.replace("can", "").toLowerCase()} access is not allowed` }, { status: 403 }),
    };
  }

  const explicitPermission = actor?.permissions.find((permission) => permission.scope === scope) ?? null;
  const permission = resolveEffectivePermission(actor?.role ?? "CLIENT", explicitPermission, scope);
  if (!actor || !permission[action]) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: `${scope} ${action.replace("can", "").toLowerCase()} access is not allowed` }, { status: 403 }),
    };
  }
  return { ok: true as const, actor, permission };
}
