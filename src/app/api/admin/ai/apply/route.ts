import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { applyAdminAiAction } from "@/lib/admin-ai/admin-ai-service";
import { loadAdminAiActor } from "@/lib/admin-ai/permissions";
import type { AdminAiPendingAction } from "@/lib/admin-ai/types";

export const runtime = "nodejs";

function isPendingAction(value: unknown): value is AdminAiPendingAction {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  const payload = (value as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object") return false;
  if (type === "EXTEND_COMPANY_BILLING") {
    const row = payload as Record<string, unknown>;
    return (
      typeof row.ownerUserUuid === "string" &&
      typeof row.companyName === "string" &&
      typeof row.months === "number" &&
      (row.notifyTelegram === undefined || typeof row.notifyTelegram === "boolean")
    );
  }
  if (type === "CREATE_ADMIN_TASK") {
    const row = payload as Record<string, unknown>;
    return (
      typeof row.title === "string" &&
      (row.priority === "NORMAL" || row.priority === "HIGH" || row.priority === "CRITICAL") &&
      (row.source === "AUDIT" || row.source === "COMPANY_VERIFICATION" || row.source === "FINANCE")
    );
  }
  return false;
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const actor = await loadAdminAiActor(session.userId);
  if (!actor) return NextResponse.json({ message: "Admin actor not found." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { action?: unknown };
  if (!isPendingAction(body.action)) {
    return NextResponse.json({ message: "Invalid AI action." }, { status: 400 });
  }

  const result = await applyAdminAiAction({ actor, action: body.action });
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });

  return NextResponse.json(result.result);
}
