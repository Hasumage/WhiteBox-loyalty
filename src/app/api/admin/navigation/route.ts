import { NextResponse, type NextRequest } from "next/server";
import {
  isAdminPermissionScope,
  resolveEffectivePermissions,
  type AdminPermissionScope,
} from "@/lib/admin/access-control";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type NavigationWorkspace = "ADMIN" | "PR" | "SUPPORT";

function detectWorkspace(role: string, permissions: Array<{ scope: string; canView: boolean }>): NavigationWorkspace {
  if (role === "SUPPORT") return "SUPPORT";
  if (role === "MANAGER" && permissions.some((permission) => permission.scope === "PR" && permission.canView)) {
    return "PR";
  }
  return "ADMIN";
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      role: true,
      permissions: {
        select: {
          scope: true,
          canView: true,
          canEdit: true,
          canApprove: true,
        },
      },
    },
  });

  if (!actor) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const explicitPermissions = actor.permissions.filter((permission) => isAdminPermissionScope(permission.scope));
  const workspace = detectWorkspace(actor.role, explicitPermissions);
  const effectivePermissions = resolveEffectivePermissions(actor.role, explicitPermissions);

  return NextResponse.json({
    role: actor.role,
    workspace,
    permissions: effectivePermissions.map((permission) => ({
      scope: permission.scope as AdminPermissionScope,
      canView: permission.canView,
      canEdit: permission.canEdit,
      canApprove: permission.canApprove,
      source: permission.source,
    })),
  });
}
