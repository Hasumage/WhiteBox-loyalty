import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { processTelegramMessageQueue } from "@/lib/telegram/telegram-queue";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const access = await requireAdminScope(session, "TELEGRAM", "canEdit");
  if (!access.ok) return access.response;

  const result = await processTelegramMessageQueue();
  return NextResponse.json({ ok: true, result });
}
