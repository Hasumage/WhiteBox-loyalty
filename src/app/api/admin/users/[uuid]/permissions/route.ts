import { NextResponse, type NextRequest } from "next/server";
import type { PermissionScope } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import {
  ADMIN_PERMISSION_SCOPES,
  ADMIN_WORKSPACE_ROLES,
  canAssignWorkspaceRole,
  canConfigureScope,
  canConfigureTargetRole,
  canManageAccess,
  clampPermissionToRole,
  defaultPermissionForRole,
  resolveEffectivePermission,
  resolveEffectivePermissions,
  type AdminPermissionScope,
} from "@/lib/admin/access-control";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SCOPES = ADMIN_PERMISSION_SCOPES as unknown as PermissionScope[];

async function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  return (await Promise.resolve(params)).uuid ?? "";
}

async function getActor(session: Awaited<ReturnType<typeof requireAdminSession>>) {
  if (isAuthResponse(session)) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      role: true,
      email: true,
      name: true,
      permissions: {
        where: { scope: "SETTINGS" },
        select: { scope: true, canView: true, canEdit: true, canApprove: true },
      },
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const uuid = await readUuid(context.params);
  const user = await prisma.user.findUnique({
    where: { uuid },
    select: { id: true, uuid: true, name: true, email: true, role: true, permissions: true },
  });

  if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

  const permissions = resolveEffectivePermissions(user.role, user.permissions);
  const actor = await getActor(session);
  const actorSettings = actor
    ? resolveEffectivePermission(actor.role, actor.permissions[0] ?? null, "SETTINGS")
    : defaultPermissionForRole("CLIENT", "SETTINGS");
  const editableScopes =
    actor && canManageAccess(actor.role, actorSettings)
      ? ADMIN_PERMISSION_SCOPES.filter((scope) => canConfigureScope(actor.role, actorSettings, user.role, scope))
      : [];
  const assignableRoles =
    actor && canManageAccess(actor.role, actorSettings) && user.role !== "SUPER_ADMIN"
      ? ADMIN_WORKSPACE_ROLES.filter((role) => canAssignWorkspaceRole(actor.role, actorSettings, role))
      : [];

  return NextResponse.json({
    user: { uuid: user.uuid, name: user.name, email: user.email, role: user.role },
    scopes: SCOPES,
    permissions,
    policy: {
      canManage: editableScopes.length > 0,
      targetLocked: user.role === "SUPER_ADMIN",
      editableScopes,
      assignableRoles,
    },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const actor = await getActor(session);
  const actorSettings = actor
    ? resolveEffectivePermission(actor.role, actor.permissions[0] ?? null, "SETTINGS")
    : defaultPermissionForRole("CLIENT", "SETTINGS");
  if (!actor || !canManageAccess(actor.role, actorSettings)) {
    return NextResponse.json({ message: "Access settings permission is required" }, { status: 403 });
  }

  const uuid = await readUuid(context.params);
  const body = (await request.json().catch(() => ({}))) as {
    permissions?: Array<{ scope: PermissionScope; canView?: boolean; canEdit?: boolean; canApprove?: boolean }>;
  };

  const user = await prisma.user.findUnique({
    where: { uuid },
    select: { id: true, uuid: true, email: true, role: true, permissions: true },
  });
  if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });
  if (!canConfigureTargetRole(actor.role, actorSettings, user.role)) {
    return NextResponse.json({ message: "This role is protected from individual access edits by your account" }, { status: 403 });
  }

  const permissions = Array.isArray(body.permissions) ? body.permissions : [];
  const incoming = new Map(
    permissions
      .filter((permission) => SCOPES.includes(permission.scope))
      .map((permission) => [permission.scope as AdminPermissionScope, permission]),
  );
  const current = new Map(user.permissions.map((permission) => [permission.scope as AdminPermissionScope, permission]));
  let normalized: ReturnType<typeof resolveEffectivePermissions>;
  try {
    normalized = ADMIN_PERMISSION_SCOPES.map((scope) => {
      const requested = incoming.get(scope) ?? current.get(scope) ?? defaultPermissionForRole(user.role, scope);
      const next = clampPermissionToRole(user.role, { ...requested, scope });
      if (!canConfigureScope(actor.role, actorSettings, user.role, scope)) {
        const currentEffective = resolveEffectivePermission(user.role, current.get(scope), scope);
        const changed =
          next.canView !== currentEffective.canView ||
          next.canEdit !== currentEffective.canEdit ||
          next.canApprove !== currentEffective.canApprove;
        if (changed) {
          throw new Error(`Scope ${scope} cannot be changed by this account`);
        }
        return currentEffective;
      }
      return next;
    });
    await prisma.$transaction(async (tx) => {
      for (const permission of normalized) {
        if (permission.source === "locked") continue;
        await tx.adminUserPermission.upsert({
          where: { userId_scope: { userId: user.id, scope: permission.scope } },
          create: {
            userId: user.id,
            scope: permission.scope,
            canView: permission.canView === true,
            canEdit: permission.canEdit === true,
            canApprove: permission.canApprove === true,
          },
          update: {
            canView: permission.canView === true,
            canEdit: permission.canEdit === true,
            canApprove: permission.canApprove === true,
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          workspace: "DEVELOPER",
          level: "WARN",
          category: "SECURITY",
          action: "Admin permissions updated",
          actorUserId: actor.id,
          actorLabel: actor.email,
          targetUserId: user.id,
          targetEmail: user.email,
          targetUuid: user.uuid,
          tags: ["#SECURITY", "#RBAC"],
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("cannot be changed")) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }

  return GET(request, context);
}
