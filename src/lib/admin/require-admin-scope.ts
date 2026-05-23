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
        where: { scope },
        select: { scope: true, canView: true, canEdit: true, canApprove: true },
      },
    },
  });
  const permission = resolveEffectivePermission(actor?.role ?? "CLIENT", actor?.permissions[0] ?? null, scope);
  if (!actor || !permission[action]) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: `${scope} ${action.replace("can", "").toLowerCase()} access is not allowed` }, { status: 403 }),
    };
  }
  return { ok: true as const, actor, permission };
}
